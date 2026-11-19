// Ricalco di uno schizzo: dall'immagine a tracciati puliti col minimo di anchor.
//
//  immagine → inchiostro (soglia adattiva) → tratti fusi (chiusura) → macchie tolte →
//  linee centrali (scheletro) oppure contorni delle forme piene → per ogni tratto:
//  punti ricampionati a passo costante → spigoli dal cambio di direzione → media gaussiana
//  tra spigoli → minimo di curve di Bézier → orientamento (forme esterne in senso orario,
//  buchi antiorario) → coordinate del documento.

import type { DocumentGeometry, PathData, Segment, Vec2 } from '../model';
import { isoContours } from './contour';
import { corners, fitCubic, fitLoop, fitPiece, resample, smooth, smoothCurves } from './fit';
import {
  adaptiveThreshold,
  clean,
  close,
  fillEnclosed,
  fillThinHoles,
  signedField,
  upscale,
  type Mask,
  type RasterImage,
} from './raster';
import { strokes, thin } from './skeleton';
import { perfectTrace, PERFECT_DEFAULTS, type PerfectOptions, type PerfectReport } from './perfect';

export type TraceMode = 'lines' | 'shapes' | 'perfect';

export interface TraceOptions {
  /** `lines`: la linea centrale dei tratti. `shapes`: il contorno delle zone piene. */
  mode: TraceMode;
  /** Quanto un pixel deve essere più scuro dei vicini per contare come matita (0–80). */
  sensitivity: number;
  /** Raggio (px) entro cui i tratti vicini si fondono in uno solo. */
  merge: number;
  /** Area minima (px²) di un segno: sotto è sporco o puntinatura. */
  minArea: number;
  /** Levigatezza: raggio della media tra punti, in multipli dello spessore del tratto. */
  smooth: number;
  /**
   * Scarto massimo tra le curve e il disegno, in multipli dello spessore del tratto
   * (più alto = meno anchor). Il tratto a matita oscilla di circa il suo spessore.
   */
  tolerance: number;
  /** Angolo minimo (gradi) perché un cambio di direzione sia uno spigolo. */
  cornerAngle: number;
  /**
   * Forme: i contorni chiusi da un tratto diventano forme piene (non anelli). Di base acceso.
   */
  fill?: boolean;
  /**
   * Forme: dove sta il bordo rispetto al tratto, da 0 (linea centrale) a 1 (filo esterno, di base).
   */
  edge?: number;
  /** Perfeziona: tolleranza, simmetria e morbidezza (docs/PERFEZIONA.md). */
  perfect?: Partial<PerfectOptions>;
}

/**
 * Parti del metodo che si possono spegnere una alla volta, per misurare quanto contano
 * (banco di prova `pnpm bench:trace`). Nel pannello sono sempre tutte accese.
 */
export interface TraceTuning {
  /** Punti ricampionati a passo costante (la distanza media) invece dei pixel grezzi. */
  resample: boolean;
  /** Media pesata dei punti con i vicini (levigatezza). */
  average: boolean;
  /** La media conserva le curve (parabola locale) invece di appiattirle (media semplice). */
  keepCurves: boolean;
  /** Finestra della media che conserva le curve, rispetto a quella semplice. */
  curveWindow: number;
  /** Spigoli dal cambio di direzione. */
  corners: boolean;
  /** Rette ai minimi quadrati che si incontrano nello spigolo esatto, punte acute ricostruite. */
  exactCorners: boolean;
  /** Ricucitura dei tratti che quasi si toccano. */
  joinGaps: boolean;
  /** Verso: forme in senso orario, buchi antiorario. */
  orient: boolean;
  /** Immagini piccole (< 450 px) ingrandite prima del ricalco: linee senza scalini. */
  upscale: boolean;
}
export const FULL_TUNING: TraceTuning = {
  resample: true,
  average: true,
  keepCurves: true,
  curveWindow: 1.5,
  corners: true,
  exactCorners: true,
  joinGaps: true,
  orient: true,
  upscale: true,
};

/** Dove va il risultato: angolo in alto a sinistra e pt per pixel. */
export interface TracePlacement {
  x: number;
  y: number;
  scale: number;
}

export interface TraceOutput {
  geometry: DocumentGeometry;
  /** Spessore medio del tratto di matita, in pt (per i tracciati a linea). */
  strokeWidth: number;
  stats: { paths: number; anchors: number; ms: number };
  /** Maschera dell'inchiostro dopo pulizia (per l'anteprima). */
  mask: Mask;
  /** Perfeziona: cosa è stato fatto (coordinate del documento). */
  perfect?: PerfectReport;
}

/** Valori predefiniti proporzionati all'immagine. */
export function traceDefaults(width: number, height: number): TraceOptions {
  const s = Math.max(width, height);
  return {
    mode: 'lines',
    sensitivity: 14,
    merge: Math.max(2, Math.round(s / 300)),
    minArea: Math.max(12, Math.round((s / 120) ** 2)),
    smooth: 1.5,
    tolerance: 0.6,
    cornerAngle: 55,
    fill: true,
    edge: 1,
  };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function signedArea(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
function inside(p: Vec2, poly: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function reverseSegs(segs: Segment[]): Segment[] {
  return [...segs]
    .reverse()
    .map((s) =>
      s.kind === 'line'
        ? { kind: 'line', p0: s.p1, p1: s.p0 }
        : { kind: 'cubic', p0: s.p1, c1: s.c2, c2: s.c1, p1: s.p0 },
    );
}

/**
 * Ricuce i tratti che quasi si toccano: due estremi liberi a meno di `gap` px si uniscono (prima
 * le coppie più vicine). Un tratto i cui estremi si toccano diventa chiuso. Negli schizzi la
 * matita spesso non chiude la forma per un soffio.
 */
export function joinGaps(
  lines: { pts: Vec2[]; closed: boolean }[],
  gap: number,
): { pts: Vec2[]; closed: boolean }[] {
  const out = lines.map((l) => ({ pts: [...l.pts], closed: l.closed, dead: false }));
  const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
  // direzione "in uscita" da un estremo (dal tratto verso l'esterno), misurata qualche px indietro
  const outward = (pts: Vec2[], atEnd: boolean): Vec2 => {
    const n = pts.length;
    const k = Math.min(n - 1, Math.max(3, Math.round(gap)));
    const e = atEnd ? pts[n - 1]! : pts[0]!;
    const q = atEnd ? pts[n - 1 - k]! : pts[k]!;
    const l = d(e, q) || 1;
    return { x: (e.x - q.x) / l, y: (e.y - q.y) / l };
  };
  for (let guard = 0; guard < 1000; guard++) {
    // costo = distanza + quanto i due tratti NON proseguono l'uno nell'altro. Dove si incontrano
    // più estremi (es. una gamba che arriva su un contorno spezzato) si uniscono quelli che
    // continuano dritti; la gamba resta un incontro a T e non devia il contorno.
    let best: { i: number; ei: 0 | 1; j: number; ej: 0 | 1; cost: number } | null = null;
    for (let i = 0; i < out.length; i++) {
      const A = out[i]!;
      if (A.dead || A.closed) continue;
      const aEnds = [A.pts[0]!, A.pts[A.pts.length - 1]!];
      // estremi dello stesso tratto: chiusura
      const self = d(aEnds[0]!, aEnds[1]!);
      if (A.pts.length > 8 && self <= gap && (!best || self < best.cost))
        best = { i, ei: 1, j: i, ej: 0, cost: self };
      for (let j = i + 1; j < out.length; j++) {
        const B = out[j]!;
        if (B.dead || B.closed) continue;
        const bEnds = [B.pts[0]!, B.pts[B.pts.length - 1]!];
        for (const ei of [0, 1] as const)
          for (const ej of [0, 1] as const) {
            const dist = d(aEnds[ei]!, bEnds[ej]!);
            if (dist > gap) continue;
            const ua = outward(A.pts, ei === 1);
            const ub = outward(B.pts, ej === 1);
            const cost = dist + gap * (1 + (ua.x * ub.x + ua.y * ub.y));
            if (!best || cost < best.cost) best = { i, ei, j, ej, cost };
          }
      }
    }
    if (!best) break;
    const A = out[best.i]!;
    if (best.i === best.j) {
      A.closed = true;
      continue;
    }
    const B = out[best.j]!;
    const a = best.ei === 1 ? A.pts : [...A.pts].reverse(); // A termina all'estremo vicino
    const b = best.ej === 0 ? B.pts : [...B.pts].reverse(); // B parte dall'estremo vicino
    A.pts = [...a, ...b];
    B.dead = true;
  }
  const live = out.filter((l) => !l.dead);
  // estremi liberi vicini a un tratto (non a un estremo): se è l'inizio dello stesso tratto la
  // forma si chiude (punta acuta: la matita ripassa sullo stesso segno); se è un altro tratto,
  // l'estremo si aggancia lì (incontro a T)
  for (const A of live) {
    if (A.closed || A.pts.length < 8) continue;
    for (const atEnd of [true, false]) {
      if (A.closed) break;
      const e = atEnd ? A.pts[A.pts.length - 1]! : A.pts[0]!;
      let best: { line: (typeof live)[number]; idx: number; dist: number } | null = null;
      for (const B of live) {
        const n = B.pts.length;
        for (let k = 0; k < n; k++) {
          // sul tratto stesso si salta la parte vicina all'estremo
          if (B === A && (atEnd ? k > n - 1 - 3 * gap : k < 3 * gap)) continue;
          const dist = d(e, B.pts[k]!);
          if (dist <= gap && (!best || dist < best.dist)) best = { line: B, idx: k, dist };
        }
      }
      if (!best) continue;
      if (best.line === A) {
        // punta acuta: la fine tocca il tratto vicino al suo inizio, e chiudere vuol dire
        // proseguire dritti fino all'inizio (la punta). Solo se il pezzo scavalcato è corto e
        // la chiusura continua la direzione della fine; altrimenti è un incontro a T.
        const n = A.pts.length;
        const start = atEnd ? A.pts[0]! : A.pts[n - 1]!;
        const skipped = atEnd ? best.idx : n - 1 - best.idx;
        const k = Math.min(n - 1, Math.max(3, Math.round(gap)));
        const back = atEnd ? A.pts[n - 1 - k]! : A.pts[k]!;
        const ox = e.x - back.x;
        const oy = e.y - back.y;
        const cx = start.x - e.x;
        const cy = start.y - e.y;
        const cos = (ox * cx + oy * cy) / ((Math.hypot(ox, oy) || 1) * (Math.hypot(cx, cy) || 1));
        if (skipped <= 3 * gap && cos > Math.cos((35 * Math.PI) / 180)) A.closed = true;
        else {
          const target = { ...A.pts[best.idx]! };
          if (atEnd) A.pts.push(target);
          else A.pts.unshift(target);
        }
      } else {
        const target = { ...best.line.pts[best.idx]! };
        if (atEnd) A.pts.push(target);
        else A.pts.unshift(target);
      }
    }
  }
  return live.map((l) => ({ pts: l.pts, closed: l.closed }));
}

/** Spessore medio del tratto: area dell'inchiostro / lunghezza della linea centrale. */
function widthOf(mask: Mask, sk: Mask): number {
  let ink = 0;
  let skel = 0;
  for (let i = 0; i < mask.data.length; i++) {
    ink += mask.data[i]!;
    skel += sk.data[i]!;
  }
  return skel > 0 ? ink / skel : 1;
}

const polyLength = (pts: Vec2[], closed: boolean) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  if (closed && pts.length > 1)
    l += Math.hypot(pts[0]!.x - pts[pts.length - 1]!.x, pts[0]!.y - pts[pts.length - 1]!.y);
  return l;
};

/** Tracciati degeneri: chiusi con un solo lato o minuscoli, aperti più corti di 3 spessori. */
function degenerate(segs: Segment[], closed: boolean, unit: number): boolean {
  const pts = segs.map((s) => s.p0);
  pts.push(segs[segs.length - 1]!.p1);
  const l = polyLength(pts, false);
  return closed ? segs.length < 2 || l < 6 * unit : l < 3 * unit;
}

/**
 * Tratti doppioni: un tratto aperto che corre tutto (≥ 90% dei punti) a meno di `near` px da
 * un altro tratto è la stessa linea ripassata. Si controllano dal più corto.
 */
export function dropDoubles(
  lines: { pts: Vec2[]; closed: boolean }[],
  near: number,
): { pts: Vec2[]; closed: boolean }[] {
  const order = lines
    .map((l, i) => ({ l, i, len: polyLength(l.pts, l.closed) }))
    .sort((a, b) => a.len - b.len);
  const dead = new Set<number>();
  for (const { l, i } of order) {
    if (l.closed) continue;
    const others = lines.filter((_, j) => j !== i && !dead.has(j));
    if (!others.length) continue;
    let close = 0;
    for (const p of l.pts) {
      let ok = false;
      for (const o of others) {
        for (const q of o.pts)
          if (
            Math.abs(q.x - p.x) <= near &&
            Math.abs(q.y - p.y) <= near &&
            Math.hypot(q.x - p.x, q.y - p.y) <= near
          ) {
            ok = true;
            break;
          }
        if (ok) break;
      }
      if (ok) close++;
    }
    if (close >= 0.9 * l.pts.length) dead.add(i);
  }
  return lines.filter((_, i) => !dead.has(i));
}

/**
 * Le linee aperte arrivano fino in fondo: la linea centrale accorcia gli estremi (l'inchiostro
 * va oltre il centro della punta della matita di mezzo spessore). Si prosegue nella direzione
 * dell'estremo finché c'è inchiostro, poi si torna indietro di mezzo spessore.
 */
export function extendEnds(
  lines: { pts: Vec2[]; closed: boolean }[],
  mask: Mask,
  width: number,
): { pts: Vec2[]; closed: boolean }[] {
  const ink = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    return (
      xi >= 0 &&
      yi >= 0 &&
      xi < mask.width &&
      yi < mask.height &&
      mask.data[yi * mask.width + xi] === 1
    );
  };
  const k = Math.max(3, Math.round(2 * width));
  return lines.map((l) => {
    if (l.closed || l.pts.length < k + 2) return l;
    const pts = [...l.pts];
    for (const atEnd of [false, true]) {
      const e = atEnd ? pts[pts.length - 1]! : pts[0]!;
      const q = atEnd ? pts[pts.length - 1 - k]! : pts[k]!;
      const dx = e.x - q.x;
      const dy = e.y - q.y;
      const dl = Math.hypot(dx, dy) || 1;
      let t = 0;
      // al massimo ~2 spessori: oltre, l'inchiostro è di un'altra linea (es. una punta che
      // passa lì vicino) e il prolungamento porterebbe il tracciato fuori dal disegno
      while (t < 2 * width && ink(e.x + (dx / dl) * (t + 0.5), e.y + (dy / dl) * (t + 0.5)))
        t += 0.5;
      const ext = t - width / 2;
      if (ext > 1) {
        const p = { x: e.x + (dx / dl) * ext, y: e.y + (dy / dl) * ext };
        if (atEnd) pts.push(p);
        else pts.unshift(p);
      }
    }
    return { pts, closed: false };
  });
}

/** Un tratto di punti → segmenti puliti. `unit` = spessore del tratto (px). */
function fitStroke(
  raw: Vec2[],
  closed: boolean,
  o: TraceOptions,
  unit: number,
  tu: TraceTuning,
): Segment[] {
  const pts = tu.resample ? resample(raw, 1, closed) : raw.map((p) => ({ ...p }));
  if (pts.length < (closed ? 6 : 2)) return [];
  const sigma = tu.average ? Math.max(0, o.smooth * unit) : 0;
  const tol = Math.max(0.5, o.tolerance * unit);
  const k = Math.max(3, Math.round(sigma * 1.5 + o.merge));
  const probe = smooth(pts, Math.max(1, unit / 2), closed);
  const cs = tu.corners ? corners(probe, k, (o.cornerAngle * Math.PI) / 180, closed) : [];
  const tk = Math.max(2, Math.round(sigma * 2));
  const avg = (p: Vec2[], c: boolean) =>
    tu.keepCurves ? smoothCurves(p, sigma * tu.curveWindow, c) : smooth(p, sigma, c);
  if (closed && cs.length === 0) return fitLoop(avg(pts, true), tol);
  // pezzi tra gli spigoli (per i chiusi si parte dal primo spigolo e si fa il giro)
  const pieces: Vec2[][] = [];
  if (closed) {
    for (let c = 0; c < cs.length; c++) {
      const a = cs[c]!;
      const b = cs[(c + 1) % cs.length]!;
      const piece: Vec2[] = [];
      for (let i = a; ; i = (i + 1) % pts.length) {
        piece.push(pts[i]!);
        if (i === b && piece.length > 1) break;
        if (piece.length > pts.length + 1) break;
      }
      pieces.push(piece);
    }
  } else {
    const cuts = [0, ...cs, pts.length - 1];
    for (let c = 0; c + 1 < cuts.length; c++) pieces.push(pts.slice(cuts[c]!, cuts[c + 1]! + 1));
  }
  const segs: Segment[] = [];
  for (const piece of pieces) {
    if (piece.length < 2) continue;
    // vicino agli spigoli (soprattutto se acuti) il segno si arrotonda: per decidere se il
    // pezzo è una retta si guarda la sua parte centrale
    const a = piece[0]!;
    const b = piece[piece.length - 1]!;
    const trim = Math.max(2.5 * unit, 0.15 * Math.hypot(b.x - a.x, b.y - a.y));
    segs.push(...fitPiece(avg(piece, false), tol, tk, trim));
  }
  const tiny = reduceAnchors(dropTiny(segs, closed, Math.max(4, 2 * unit)), closed, tol);
  if (!tu.exactCorners) return tiny;
  return snapCorners(sharpenTips(tiny, closed, 2.5 * unit, 5 * unit), closed, 4 * unit);
}

const bezAt = (s: Segment, t: number): Vec2 => {
  if (s.kind === 'line')
    return { x: s.p0.x + (s.p1.x - s.p0.x) * t, y: s.p0.y + (s.p1.y - s.p0.y) * t };
  const u = 1 - t;
  return {
    x: u * u * u * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p1.x,
    y: u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p1.y,
  };
};
/** Direzione della curva all'inizio (atStart) o alla fine, verso l'esterno del segmento. */
function tangent(s: Segment, atStart: boolean): Vec2 {
  const a = atStart ? s.p0 : s.p1;
  let b: Vec2;
  if (s.kind === 'line') b = atStart ? s.p1 : s.p0;
  else {
    const h = atStart ? s.c1 : s.c2;
    b = Math.hypot(h.x - a.x, h.y - a.y) > 1e-6 ? h : atStart ? s.c2 : s.c1;
  }
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

/**
 * Meno anchor: un punto dove la curva non fa spigolo (le tangenti si scostano meno di 25°)
 * si toglie se le due curve accanto si possono sostituire con una sola entro la precisione.
 * Due rette quasi allineate diventano una retta. Così i pezzi divisi da falsi spigoli o dagli
 * incroci tornano interi.
 */
function reduceAnchors(segs: Segment[], closed: boolean, tol: number): Segment[] {
  const out = segs.map((s) => ({ ...s }) as Segment);
  const smoothJoint = (a: Segment, b: Segment) => {
    const u = tangent(a, false); // verso l'indietro dalla fine di a
    const v = tangent(b, true); // verso l'avanti dall'inizio di b
    return -(u.x * v.x + u.y * v.y) > Math.cos((25 * Math.PI) / 180);
  };
  let changed = true;
  while (changed) {
    changed = false;
    const n = out.length;
    const joints = closed ? n : n - 1;
    if (n < (closed ? 3 : 2)) break;
    for (let j = 0; j < joints; j++) {
      const a = out[j]!;
      const b = out[(j + 1) % n]!;
      if (!smoothJoint(a, b)) continue;
      const pts: Vec2[] = [];
      for (let k = 0; k <= 16; k++) pts.push(bezAt(a, k / 16));
      for (let k = 1; k <= 16; k++) pts.push(bezAt(b, k / 16));
      let merged: Segment;
      if (a.kind === 'line' && b.kind === 'line') merged = { kind: 'line', p0: a.p0, p1: b.p1 };
      else {
        const c = fitCubic(pts, tangent(a, true), tangent(b, false));
        merged = { kind: 'cubic', p0: a.p0, c1: c[1], c2: c[2], p1: b.p1 };
      }
      let err = 0;
      for (const q of pts) {
        let best = Infinity;
        for (let k = 0; k <= 48; k++) {
          const r = bezAt(merged, k / 48);
          best = Math.min(best, Math.hypot(r.x - q.x, r.y - q.y));
        }
        err = Math.max(err, best);
      }
      if (err > tol) continue;
      if (j + 1 < n) out.splice(j, 2, merged);
      else {
        // giunto tra l'ultimo e il primo (chiuso): il nuovo segmento prende il posto del primo
        out.splice(n - 1, 1);
        out[0] = merged;
      }
      changed = true;
      break;
    }
  }
  return out;
}

/** Intersezione delle rette per (a0,a1) e (b0,b1), o null se parallele. */
function cross(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): Vec2 | null {
  const r = { x: a1.x - a0.x, y: a1.y - a0.y };
  const s = { x: b1.x - b0.x, y: b1.y - b0.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b0.x - a0.x) * s.y - (b0.y - a0.y) * s.x) / den;
  return { x: a0.x + r.x * t, y: a0.y + r.y * t };
}

/**
 * Punte acute smussate: un lato corto (< `short`, circa lo spessore del tratto: è quanto la
 * linea centrale "taglia" una punta) tra due rette che si incontrano entro `reach` sparisce, e
 * le due rette si uniscono nella punta. Un lato vero (es. la cima piatta di una A) è più lungo.
 */
function sharpenTips(segs: Segment[], closed: boolean, shortMax: number, reach: number): Segment[] {
  const out = segs.map((s) => ({ ...s }) as Segment);
  for (let i = 0; i < out.length && out.length > 3;) {
    const n = out.length;
    const s = out[i]!;
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    const prev = out[(i - 1 + n) % n]!;
    const next = out[(i + 1) % n]!;
    const short = Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y) < shortMax;
    if (!(hasPrev && hasNext && short && prev.kind === 'line' && next.kind === 'line')) {
      i++;
      continue;
    }
    const x = cross(prev.p0, prev.p1, next.p0, next.p1);
    const mid = { x: (s.p0.x + s.p1.x) / 2, y: (s.p0.y + s.p1.y) / 2 };
    if (!x || Math.hypot(x.x - mid.x, x.y - mid.y) > reach) {
      i++;
      continue;
    }
    prev.p1 = { ...x };
    next.p0 = { ...x };
    out.splice(i, 1);
  }
  return out;
}

/**
 * Spigoli esatti: due rette consecutive si incontrano nel loro punto d'intersezione (come le
 * disegnerebbe un designer), se è vicino (`max`) allo spigolo trovato sul disegno. Tra una retta
 * e una curva l'anchor resta in comune.
 */
function snapCorners(segs: Segment[], closed: boolean, max: number): Segment[] {
  const n = segs.length;
  const out = segs.map((s) => ({ ...s }) as Segment);
  for (let i = 0; i < n; i++) {
    if (!closed && i === n - 1) break;
    const a = out[i]!;
    const b = out[(i + 1) % n]!;
    if (a.kind !== 'line' || b.kind !== 'line' || a === b) continue;
    const r = { x: a.p1.x - a.p0.x, y: a.p1.y - a.p0.y };
    const s = { x: b.p1.x - b.p0.x, y: b.p1.y - b.p0.y };
    const den = r.x * s.y - r.y * s.x;
    // rette quasi parallele (< 12°): l'intersezione è lontana e instabile, non si usa
    if (
      Math.abs(den) <
      Math.sin((12 * Math.PI) / 180) * Math.hypot(r.x, r.y) * Math.hypot(s.x, s.y)
    )
      continue;
    const t = ((b.p0.x - a.p0.x) * s.y - (b.p0.y - a.p0.y) * s.x) / den;
    const x = { x: a.p0.x + r.x * t, y: a.p0.y + r.y * t };
    const here = { x: (a.p1.x + b.p0.x) / 2, y: (a.p1.y + b.p0.y) / 2 };
    const p = Math.hypot(x.x - here.x, x.y - here.y) <= max ? x : here;
    a.p1 = { ...p };
    b.p0 = { ...p };
  }
  // tra pezzi non rette: anchor in comune (punto medio), così il tracciato è continuo
  for (let i = 0; i < n; i++) {
    if (!closed && i === n - 1) break;
    const a = out[i]!;
    const b = out[(i + 1) % n]!;
    if (a.p1.x === b.p0.x && a.p1.y === b.p0.y) continue;
    const m = { x: (a.p1.x + b.p0.x) / 2, y: (a.p1.y + b.p0.y) / 2 };
    const mv = (sg: Segment, end: 'p0' | 'p1') => {
      const dx = m.x - sg[end].x;
      const dy = m.y - sg[end].y;
      if (sg.kind === 'cubic') {
        const c = end === 'p0' ? 'c1' : 'c2';
        sg[c] = { x: sg[c].x + dx, y: sg[c].y + dy };
      }
      sg[end] = { ...m };
    };
    mv(a, 'p1');
    mv(b, 'p0');
  }
  return out;
}

/** Segmenti più corti di `min` (residui di spigoli doppi): i due estremi si fondono a metà. */
function dropTiny(segs: Segment[], closed: boolean, min: number): Segment[] {
  const out = segs.map((s) => ({ ...s }) as Segment);
  const shift = (s: Segment, end: 'p0' | 'p1', to: Vec2) => {
    const from = s[end];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (s.kind === 'cubic') {
      const c = end === 'p0' ? 'c1' : 'c2';
      s[c] = { x: s[c].x + dx, y: s[c].y + dy };
    }
    s[end] = { ...to };
  };
  for (let i = 0; i < out.length && out.length > (closed ? 3 : 1);) {
    const s = out[i]!;
    const len = Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y);
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < out.length - 1;
    if (len >= min || !(hasPrev && hasNext)) {
      i++;
      continue;
    }
    const mid = { x: (s.p0.x + s.p1.x) / 2, y: (s.p0.y + s.p1.y) / 2 };
    const prev = out[(i - 1 + out.length) % out.length]!;
    const next = out[(i + 1) % out.length]!;
    shift(prev, 'p1', mid);
    shift(next, 'p0', mid);
    out.splice(i, 1);
  }
  return out;
}

/** Linee centrali dei tratti (modalità a linee): polilinee, spessore del tratto, maschera rifinita. */
function centerlines(
  input: Mask,
  o: TraceOptions,
  tu: TraceTuning,
): { polylines: { pts: Vec2[]; closed: boolean }[]; strokeWidthPx: number; mask: Mask } {
  let mask = input;
  let sk = thin(mask);
  let strokeWidthPx = widthOf(mask, sk);
  // buchetti dentro la traccia (più piccoli di ~2,5 spessori): passate che non si toccano.
  // Lasciati lì diventerebbero minuscoli anelli; si riempiono e si rifà la linea centrale.
  const refilled = clean(mask, 0, (2.5 * strokeWidthPx) ** 2);
  if (refilled.data.some((v, i) => v !== mask.data[i])) {
    mask = refilled;
    sk = thin(mask);
    strokeWidthPx = widthOf(mask, sk);
  }
  const spur = Math.max(4, Math.round(o.merge * 2 + strokeWidthPx));
  const found = strokes(sk, spur, Math.max(spur * 4, Math.round(strokeWidthPx * 25)))
    .filter((s) => s.points.length >= Math.max(4, spur))
    .map((s) => ({ pts: s.points, closed: s.closed }));
  const joined = tu.joinGaps
    ? joinGaps(found, Math.max(5 * o.merge, 5 * strokeWidthPx, 10))
    : found;
  const polylines = extendEnds(dropDoubles(joined, 1.5 * strokeWidthPx), mask, strokeWidthPx);
  return { polylines, strokeWidthPx, mask };
}

export function trace(
  source: RasterImage,
  opts: TraceOptions,
  where: TracePlacement,
  tuning: Partial<TraceTuning> = {},
): TraceOutput {
  const tu: TraceTuning = { ...FULL_TUNING, ...tuning };
  // foto piccole (< 450 px): con pochi pixel per tratto la linea centrale è a scalini e gli
  // spigoli si spostano. Si ingrandisce (bilineare) fino a ~900 px; le misure in px crescono
  // insieme. Sulle immagini più grandi non serve (misurato con pnpm bench:trace) e rallenta.
  const long = Math.max(source.width, source.height);
  const up = tu.upscale && long < 450 ? Math.min(3, Math.ceil(900 / long)) : 1;
  const img = upscale(source, up);
  const o: TraceOptions = { ...opts, merge: opts.merge * up, minArea: opts.minArea * up * up };
  const place: TracePlacement = { ...where, scale: where.scale / up };
  const t0 = now();
  const win = Math.max(15, Math.round(Math.max(img.width, img.height) / 20) | 1);
  let mask: Mask;
  let strokeWidthPx = 1;
  let fitted: { closed: boolean; segs: Segment[]; poly: Vec2[] }[];
  let perfectOut: PerfectReport | undefined;
  if (o.mode === 'perfect') {
    // Perfeziona: contorni dal grigio, simmetria, archi tangenti (niente maschera binaria)
    // il campo sfumato smussa un po' le punte: soglia dello spigolo più bassa
    // i dettagli piccoli (artigli, pois) contano: filtro dello sporco più permissivo
    const res = perfectTrace(
      img,
      { ...PERFECT_DEFAULTS, ...o.perfect },
      o.minArea / 4,
      o.cornerAngle * 0.8,
      up,
    );
    mask = res.mask;
    fitted = res.contours.map((c) => ({ closed: true, segs: c.segs, poly: c.poly }));
    const r = res.report;
    const k = place.scale;
    perfectOut = {
      ...r,
      axis:
        r.axis === null
          ? null
          : r.symmetry === 'vertical'
            ? place.x + r.axis * k
            : place.y + r.axis * k,
      maxDeviation: r.maxDeviation * k,
      circles: r.circles.map((c) => ({
        cx: place.x + c.cx * k,
        cy: place.y + c.cy * k,
        r: c.r * k,
      })),
    };
  } else {
    mask = adaptiveThreshold(img, o.sensitivity, win);
    mask = close(mask, Math.round(o.merge));
    mask = clean(mask, o.minArea, Math.max(o.minArea, (2 * o.merge + 2) ** 2));
    // asole tra passate parallele: più strette di ~3 volte il raggio di fusione
    mask = fillThinHoles(mask, Math.max(2, o.merge * 1.5 + 1));

    let polylines: { pts: Vec2[]; closed: boolean }[];
    if (o.mode === 'lines') {
      const c = centerlines(mask, o, tu);
      mask = c.mask;
      strokeWidthPx = c.strokeWidthPx;
      polylines = c.polylines;
    } else {
      // forme intere: spessore del tratto, buchi chiusi dal tratto riempiti, bordo sotto il pixel
      // spostato tra il filo esterno (edge = 1) e la linea centrale (edge = 0)
      const sw = Math.max(1, widthOf(mask, thin(mask)));
      strokeWidthPx = sw;
      // anelli disegnati (linee centrali chiuse): servono a capire cosa è dentro una forma
      const loops = () =>
        centerlines(mask, o, tu)
          .polylines.filter((p) => p.closed)
          .map((p) => p.pts);
      const shape = o.fill === false ? mask : fillEnclosed(mask, sw, 4, loops);
      const edge = Math.max(0, Math.min(1, o.edge ?? 1));
      const level = ((1 - edge) * sw) / 2;
      polylines = isoContours(signedField(shape, 1), shape.width, shape.height, level)
        .filter((l) => Math.abs(signedArea(l)) >= o.minArea)
        .map((l) => ({ pts: l, closed: true }));
    }

    // unità di misura del disegno: lo spessore del tratto (forme piene: il raggio di fusione)
    const unit = o.mode === 'lines' ? Math.max(1.5, strokeWidthPx) : Math.max(2, o.merge + 1);
    // tratti → segmenti in px
    fitted = polylines
      .map((pl) => ({
        closed: pl.closed,
        segs: fitStroke(pl.pts, pl.closed, o, unit, tu),
        poly: pl.pts,
      }))
      .filter((f) => f.segs.length > 0 && !degenerate(f.segs, f.closed, unit));
  }

  // orientamento: profondità di annidamento pari → senso orario (y in giù: area > 0)
  const closedIdx = fitted.map((f, i) => (f.closed ? i : -1)).filter((i) => i >= 0);
  const depth = new Map<number, number>();
  const root = new Map<number, number>();
  for (const i of closedIdx) {
    const p = fitted[i]!.poly[0]!;
    let d = 0;
    let best = -1;
    let bestArea = Infinity;
    for (const j of closedIdx) {
      if (j === i) continue;
      const poly = fitted[j]!.poly;
      if (inside(p, poly)) {
        d++;
        const a = Math.abs(signedArea(poly));
        if (a > Math.abs(signedArea(fitted[i]!.poly)) && a < bestArea) {
          bestArea = a;
          best = j;
        }
      }
    }
    depth.set(i, d);
    root.set(i, best);
  }
  const topOf = (i: number): number => {
    let cur = i;
    for (let g = 0; g < 50; g++) {
      const r = root.get(cur) ?? -1;
      if (r < 0) return cur;
      cur = r;
    }
    return cur;
  };

  const T = (p: Vec2): Vec2 => ({ x: place.x + p.x * place.scale, y: place.y + p.y * place.scale });
  const tp = (s: Segment): Segment =>
    s.kind === 'line'
      ? { kind: 'line', p0: T(s.p0), p1: T(s.p1) }
      : { kind: 'cubic', p0: T(s.p0), c1: T(s.c1), c2: T(s.c2), p1: T(s.p1) };

  const paths: PathData[] = fitted.map((f, i) => {
    let segs = f.segs;
    if (f.closed && tu.orient) {
      const cw = signedArea(f.poly) > 0;
      const wantCw = (depth.get(i) ?? 0) % 2 === 0;
      if (cw !== wantCw) segs = reverseSegs(segs);
    }
    const path: PathData = {
      id: `t${i}`,
      closed: f.closed,
      filled: o.mode !== 'lines',
      stroked: o.mode === 'lines',
      segments: segs.map(tp),
    };
    if (o.mode === 'lines') path.strokeWidth = Math.round(strokeWidthPx * place.scale * 100) / 100;
    if (o.mode !== 'lines') path.glyphId = `g${topOf(i)}`;
    return path;
  });
  const anchors = paths.reduce((s, p) => s + p.segments.length + (p.closed ? 0 : 1), 0);
  return {
    geometry: { source: 'svg', paths, warnings: [] },
    strokeWidth: strokeWidthPx * place.scale,
    stats: { paths: paths.length, anchors, ms: Math.round(now() - t0) },
    mask,
    ...(perfectOut ? { perfect: perfectOut } : {}),
  };
}
