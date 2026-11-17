// Ricalco di uno schizzo: dall'immagine a tracciati puliti col minimo di anchor.
//
//  immagine → inchiostro (soglia adattiva) → tratti fusi (chiusura) → macchie tolte →
//  linee centrali (scheletro) oppure contorni delle forme piene → per ogni tratto:
//  punti ricampionati a passo costante → spigoli dal cambio di direzione → media gaussiana
//  tra spigoli → minimo di curve di Bézier → orientamento (forme esterne in senso orario,
//  buchi antiorario) → coordinate del documento.

import type { DocumentGeometry, PathData, Segment, Vec2 } from '../model';
import { contours } from './contour';
import { corners, fitLoop, fitPiece, resample, smooth } from './fit';
import {
  adaptiveThreshold,
  clean,
  close,
  fillThinHoles,
  type Mask,
  type RasterImage,
} from './raster';
import { strokes, thin } from './skeleton';

export type TraceMode = 'lines' | 'shapes';

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
}

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
  for (let guard = 0; guard < 1000; guard++) {
    let best: { i: number; ei: 0 | 1; j: number; ej: 0 | 1; dist: number } | null = null;
    for (let i = 0; i < out.length; i++) {
      const A = out[i]!;
      if (A.dead || A.closed) continue;
      const aEnds = [A.pts[0]!, A.pts[A.pts.length - 1]!];
      // estremi dello stesso tratto: chiusura
      const self = d(aEnds[0]!, aEnds[1]!);
      if (A.pts.length > 8 && self <= gap && (!best || self < best.dist))
        best = { i, ei: 1, j: i, ej: 0, dist: self };
      for (let j = i + 1; j < out.length; j++) {
        const B = out[j]!;
        if (B.dead || B.closed) continue;
        const bEnds = [B.pts[0]!, B.pts[B.pts.length - 1]!];
        for (const ei of [0, 1] as const)
          for (const ej of [0, 1] as const) {
            const dist = d(aEnds[ei]!, bEnds[ej]!);
            if (dist <= gap && (!best || dist < best.dist)) best = { i, ei, j, ej, dist };
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
        const n = A.pts.length;
        const nearOther = atEnd ? best.idx < n / 3 : best.idx > (2 * n) / 3;
        if (nearOther) A.closed = true;
      } else {
        const target = { ...best.line.pts[best.idx]! };
        if (atEnd) A.pts.push(target);
        else A.pts.unshift(target);
      }
    }
  }
  return live.map((l) => ({ pts: l.pts, closed: l.closed }));
}

/** Un tratto di punti → segmenti puliti. `unit` = spessore del tratto (px). */
function fitStroke(raw: Vec2[], closed: boolean, o: TraceOptions, unit: number): Segment[] {
  const pts = resample(raw, 1, closed);
  if (pts.length < (closed ? 6 : 2)) return [];
  const sigma = Math.max(0, o.smooth * unit);
  const tol = Math.max(0.5, o.tolerance * unit);
  const k = Math.max(3, Math.round(sigma * 1.5 + o.merge));
  const probe = smooth(pts, Math.max(1, unit / 2), closed);
  const cs = corners(probe, k, (o.cornerAngle * Math.PI) / 180, closed);
  const tk = Math.max(2, Math.round(sigma * 2));
  if (closed && cs.length === 0) return fitLoop(smooth(pts, sigma, true), tol);
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
    segs.push(...fitPiece(smooth(piece, sigma, false), tol, tk, trim));
  }
  const tidy = sharpenTips(dropTiny(segs, closed, Math.max(4, 2 * unit)), closed, 6 * unit);
  return snapCorners(tidy, closed, 6 * unit);
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
 * Punte acute smussate: un lato corto (< `max`) tra due rette che si incontrano poco oltre
 * sparisce, e le due rette si uniscono nella punta (il disegno voleva uno spigolo vivo).
 */
function sharpenTips(segs: Segment[], closed: boolean, max: number): Segment[] {
  const out = segs.map((s) => ({ ...s }) as Segment);
  for (let i = 0; i < out.length && out.length > 3;) {
    const n = out.length;
    const s = out[i]!;
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    const prev = out[(i - 1 + n) % n]!;
    const next = out[(i + 1) % n]!;
    const short = Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y) < max;
    if (!(hasPrev && hasNext && short && prev.kind === 'line' && next.kind === 'line')) {
      i++;
      continue;
    }
    const x = cross(prev.p0, prev.p1, next.p0, next.p1);
    const mid = { x: (s.p0.x + s.p1.x) / 2, y: (s.p0.y + s.p1.y) / 2 };
    if (!x || Math.hypot(x.x - mid.x, x.y - mid.y) > 2 * max) {
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
    if (Math.abs(den) < 1e-9) continue;
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

export function trace(img: RasterImage, o: TraceOptions, place: TracePlacement): TraceOutput {
  const t0 = now();
  const win = Math.max(15, Math.round(Math.max(img.width, img.height) / 20) | 1);
  let mask = adaptiveThreshold(img, o.sensitivity, win);
  mask = close(mask, Math.round(o.merge));
  mask = clean(mask, o.minArea, Math.max(o.minArea, (2 * o.merge + 2) ** 2));
  // asole tra passate parallele: più strette di ~3 volte il raggio di fusione
  mask = fillThinHoles(mask, Math.max(2, o.merge * 1.5 + 1));

  let polylines: { pts: Vec2[]; closed: boolean }[];
  let strokeWidthPx = 1;
  if (o.mode === 'lines') {
    const sk = thin(mask);
    let ink = 0;
    let skel = 0;
    for (let i = 0; i < mask.data.length; i++) {
      ink += mask.data[i]!;
      skel += sk.data[i]!;
    }
    strokeWidthPx = skel > 0 ? ink / skel : 1;
    const spur = Math.max(4, Math.round(o.merge * 2 + strokeWidthPx));
    polylines = joinGaps(
      strokes(sk, spur, Math.max(spur * 4, Math.round(strokeWidthPx * 25)))
        .filter((s) => s.points.length >= Math.max(4, spur))
        .map((s) => ({ pts: s.points, closed: s.closed })),
      Math.max(5 * o.merge, 5 * strokeWidthPx, 10),
    );
  } else {
    polylines = contours(mask)
      .filter((l) => Math.abs(signedArea(l)) >= o.minArea)
      .map((l) => ({ pts: l, closed: true }));
  }

  // unità di misura del disegno: lo spessore del tratto (forme piene: il raggio di fusione)
  const unit = o.mode === 'lines' ? Math.max(1.5, strokeWidthPx) : Math.max(2, o.merge + 1);
  // tratti → segmenti in px
  const fitted = polylines
    .map((pl) => ({ closed: pl.closed, segs: fitStroke(pl.pts, pl.closed, o, unit), poly: pl.pts }))
    .filter((f) => f.segs.length > 0);

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
    if (f.closed) {
      const cw = signedArea(f.poly) > 0;
      const wantCw = (depth.get(i) ?? 0) % 2 === 0;
      if (cw !== wantCw) segs = reverseSegs(segs);
    }
    const path: PathData = {
      id: `t${i}`,
      closed: f.closed,
      filled: o.mode === 'shapes',
      stroked: o.mode === 'lines',
      segments: segs.map(tp),
    };
    if (o.mode === 'lines') path.strokeWidth = Math.round(strokeWidthPx * place.scale * 100) / 100;
    if (o.mode === 'shapes') path.glyphId = `g${topOf(i)}`;
    return path;
  });
  const anchors = paths.reduce((s, p) => s + p.segments.length + (p.closed ? 0 : 1), 0);
  return {
    geometry: { source: 'svg', paths, warnings: [] },
    strokeWidth: strokeWidthPx * place.scale,
    stats: { paths: paths.length, anchors, ms: Math.round(now() - t0) },
    mask,
  };
}
