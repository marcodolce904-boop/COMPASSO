// Simmetria sulle forme: si tiene una metà del logo e l'altra diventa il suo riflesso.
// Funziona anche sui ricalchi a mano, dove gli anchor dei due lati non sono mai speculari:
// l'asse si cerca confrontando le curve (non i punti), poi ogni tracciato che attraversa l'asse
// viene tagliato sull'asse e ricomposto con la metà tenuta; i tracciati tutti da un lato prendono
// la forma riflessa del loro gemello. Il numero di tracciati non cambia mai (Illustrator scrive la
// copia corretta tracciato per tracciato).

import type { PathData, Segment, Vec2 } from '../model';

export type MirrorKeep = 'left' | 'right' | 'top' | 'bottom';

export interface MirrorAxis {
  vertical: boolean;
  c: number;
  /** Scarto medio tra il logo e il suo riflesso, in pt (0 = già simmetrico). */
  mismatch: number;
}

export interface MirrorResult {
  paths: PathData[];
  axis: MirrorAxis;
  keep: MirrorKeep;
  /** Anchor ricostruiti (tracciati ricomposti o sostituiti dal riflesso del gemello). */
  anchors: number;
  /** Tracciati rimasti com'erano (senza gemello o troppo intricati da tagliare). */
  skipped: number;
}

const EPS = 1e-9;
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

function pointAt(s: Segment, t: number): Vec2 {
  if (s.kind === 'line') return lerp(s.p0, s.p1, t);
  const u = 1 - t;
  return {
    x: u * u * u * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p1.x,
    y: u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p1.y,
  };
}

/** Divide un tratto in t (de Casteljau: forma identica). */
function splitSeg(s: Segment, t: number): [Segment, Segment] {
  if (s.kind === 'line') {
    const m = lerp(s.p0, s.p1, t);
    return [
      { kind: 'line', p0: s.p0, p1: m },
      { kind: 'line', p0: m, p1: s.p1 },
    ];
  }
  const q0 = lerp(s.p0, s.c1, t);
  const q1 = lerp(s.c1, s.c2, t);
  const q2 = lerp(s.c2, s.p1, t);
  const r0 = lerp(q0, q1, t);
  const r1 = lerp(q1, q2, t);
  const m = lerp(r0, r1, t);
  return [
    { kind: 'cubic', p0: s.p0, c1: q0, c2: r0, p1: m },
    { kind: 'cubic', p0: m, c1: r1, c2: q2, p1: s.p1 },
  ];
}

const reverseSeg = (s: Segment): Segment =>
  s.kind === 'line'
    ? { kind: 'line', p0: s.p1, p1: s.p0 }
    : { kind: 'cubic', p0: s.p1, c1: s.c2, c2: s.c1, p1: s.p0 };

function samplePath(p: PathData, step: number): Vec2[] {
  const out: Vec2[] = [];
  for (const s of p.segments) {
    const len =
      s.kind === 'line' ? dist(s.p0, s.p1) : dist(s.p0, s.c1) + dist(s.c1, s.c2) + dist(s.c2, s.p1);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) out.push(pointAt(s, k / n));
  }
  const last = p.segments[p.segments.length - 1];
  if (last && !p.closed) out.push(last.p1);
  return out;
}

/** Griglia per il punto più vicino (distanza troncata a `cap`). */
function nearestFn(pts: Vec2[], cell: number, cap: number) {
  const grid = new Map<string, Vec2[]>();
  for (const p of pts) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    const l = grid.get(k);
    if (l) l.push(p);
    else grid.set(k, [p]);
  }
  const reach = Math.ceil(cap / cell);
  return (q: Vec2) => {
    const gx = Math.floor(q.x / cell);
    const gy = Math.floor(q.y / cell);
    let best = cap;
    for (let dx = -reach; dx <= reach; dx++)
      for (let dy = -reach; dy <= reach; dy++)
        for (const p of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          const d = dist(p, q);
          if (d < best) best = d;
        }
    return best;
  };
}

function bounds(pts: Vec2[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

/**
 * Asse di simmetria verticale (o orizzontale) che rende minimo lo scarto medio tra il logo e il
 * suo riflesso. Ricerca a griglia nel 15% centrale, poi sezione aurea.
 */
export function findMirrorAxis(paths: PathData[], vertical: boolean): MirrorAxis | null {
  if (!paths.some((p) => p.segments.length)) return null;
  const b = bounds(paths.flatMap((p) => p.segments.flatMap((s) => [s.p0, s.p1])));
  const D = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) || 1;
  // al massimo ~1500 campioni: abbastanza per l'asse, veloce anche su ricalchi da migliaia di anchor
  const dense = paths.flatMap((p) => samplePath(p, D / 300));
  const every = Math.max(1, Math.ceil(dense.length / 1500));
  const pts = dense.filter((_, i) => i % every === 0);
  const cap = 0.04 * D; // oltre il 4% di D i lati sono comunque «troppo diversi»
  const near = nearestFn(pts, cap / 2, cap);
  const cost = (c: number) => {
    let s = 0;
    for (const p of pts)
      s += near(vertical ? { x: 2 * c - p.x, y: p.y } : { x: p.x, y: 2 * c - p.y });
    return s / pts.length;
  };
  const lo = vertical ? b.x0 : b.y0;
  const hi = vertical ? b.x1 : b.y1;
  const mid = (lo + hi) / 2;
  const span = 0.15 * (hi - lo);
  let best = mid;
  let bestCost = cost(mid);
  for (let k = -8; k <= 8; k++) {
    const c = mid + (span * k) / 8;
    const v = cost(c);
    if (v < bestCost) {
      bestCost = v;
      best = c;
    }
  }
  // affinamento (sezione aurea) nell'intervallo attorno al migliore
  let a = best - span / 8;
  let z = best + span / 8;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = z - g * (z - a);
  let x2 = a + g * (z - a);
  let f1 = cost(x1);
  let f2 = cost(x2);
  for (let i = 0; i < 22; i++) {
    if (f1 < f2) {
      z = x2;
      x2 = x1;
      f2 = f1;
      x1 = z - g * (z - a);
      f1 = cost(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + g * (z - a);
      f2 = cost(x2);
    }
  }
  const c = f1 < f2 ? x1 : x2;
  const v = Math.min(f1, f2);
  return v <= bestCost ? { vertical, c, mismatch: v } : { vertical, c: best, mismatch: bestCost };
}

/** Area con segno (orientamento) di un tracciato chiuso. */
function signedArea(p: PathData): number {
  const pts = p.segments.flatMap((s) => [0.25, 0.5, 0.75, 1].map((t) => pointAt(s, t)));
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const u = pts[i]!;
    const w = pts[(i + 1) % pts.length]!;
    a += u.x * w.y - w.x * u.y;
  }
  return a / 2;
}

interface Ctx {
  vertical: boolean;
  c: number;
  /** +1: si tiene il lato con coordinata maggiore (destra/sotto); −1 il minore. */
  sign: number;
  D: number;
}

const side = (ctx: Ctx, p: Vec2) => (ctx.vertical ? p.x : p.y) - ctx.c;
const reflectP = (ctx: Ctx, p: Vec2): Vec2 =>
  ctx.vertical ? { x: 2 * ctx.c - p.x, y: p.y } : { x: p.x, y: 2 * ctx.c - p.y };
function reflectSeg(ctx: Ctx, s: Segment): Segment {
  const R = (p: Vec2) => reflectP(ctx, p);
  return s.kind === 'line'
    ? { kind: 'line', p0: R(s.p0), p1: R(s.p1) }
    : { kind: 'cubic', p0: R(s.p0), c1: R(s.c1), c2: R(s.c2), p1: R(s.p1) };
}
const snap = (ctx: Ctx, p: Vec2): Vec2 =>
  ctx.vertical ? { x: ctx.c, y: p.y } : { x: p.x, y: ctx.c };

/** Parametri t in (0,1] dove il tratto attraversa l'asse (cambio di segno). */
function crossings(ctx: Ctx, s: Segment): number[] {
  const f = (t: number) => side(ctx, pointAt(s, t));
  const out: number[] = [];
  const n = s.kind === 'line' ? 1 : 48;
  let ta = 0;
  let fa = f(0);
  for (let k = 1; k <= n; k++) {
    const tb = k / n;
    const fb = f(tb);
    if (Math.abs(fb) < EPS && k === n) {
      // finisce esattamente sull'asse: conta se il tratto dopo passa dall'altra parte (vedi chiamante)
      out.push(1);
    } else if ((fa < -EPS && fb > EPS) || (fa > EPS && fb < -EPS)) {
      let lo = ta;
      let hi = tb;
      for (let i = 0; i < 50; i++) {
        const m = (lo + hi) / 2;
        if (f(m) * fa > 0) lo = m;
        else hi = m;
      }
      out.push((lo + hi) / 2);
    }
    ta = tb;
    fa = fb;
  }
  return out;
}

/** Tratti del tracciato divisi sull'asse, con i punti di taglio (indici dei tagli). */
function cutOnAxis(ctx: Ctx, segs: Segment[]): { pieces: Segment[]; cutAfter: boolean[] } {
  const pieces: Segment[] = [];
  const cutAfter: boolean[] = [];
  for (const s0 of segs) {
    const ts = crossings(ctx, s0);
    let rest = s0;
    let done = 0;
    for (const t of ts) {
      if (t >= 1 - 1e-9) {
        pieces.push(rest);
        cutAfter.push(true);
        rest = null as unknown as Segment;
        break;
      }
      const local = (t - done) / (1 - done);
      const [a, b] = splitSeg(rest, local);
      pieces.push(a);
      cutAfter.push(true);
      rest = b;
      done = t;
    }
    if (rest) {
      pieces.push(rest);
      cutAfter.push(false);
    }
  }
  return { pieces, cutAfter };
}

/** Lato di una catena di tratti: segno della media dei punti interni. */
function chainSide(ctx: Ctx, chain: Segment[]): number {
  let s = 0;
  for (const seg of chain) for (const t of [0.25, 0.5, 0.75]) s += side(ctx, pointAt(seg, t));
  return s >= 0 ? 1 : -1;
}

/**
 * All'asse la curva tenuta e il suo riflesso si incontrano: se la tangente è quasi perpendicolare
 * all'asse diventa perpendicolare esatta (giunzione liscia); altrimenti resta una punta (es. il
 * fondo di uno scudo, l'incavo di un cuore).
 */
function squareJoint(ctx: Ctx, s: Segment, atStart: boolean): Segment {
  if (s.kind !== 'cubic') return s;
  const p = atStart ? s.p0 : s.p1;
  const h = atStart ? s.c1 : s.c2;
  const v = { x: h.x - p.x, y: h.y - p.y };
  const len = Math.hypot(v.x, v.y);
  if (len < EPS) return s;
  const across = Math.abs(ctx.vertical ? v.x : v.y) / len; // coseno con la normale all'asse
  if (across < Math.cos((25 * Math.PI) / 180)) return s;
  const dir = Math.sign(ctx.vertical ? v.x : v.y) || 1;
  const nh = ctx.vertical ? { x: p.x + dir * len, y: p.y } : { x: p.x, y: p.y + dir * len };
  return atStart ? { ...s, c1: nh } : { ...s, c2: nh };
}

/** Tracciato che attraversa l'asse: metà tenuta + suo riflesso. null se non si può (più pezzi). */
function mirrorCrossing(ctx: Ctx, p: PathData): Segment[] | null {
  const { pieces, cutAfter } = cutOnAxis(ctx, p.segments);
  const cuts = cutAfter.filter(Boolean).length;
  if (!cuts) return null;
  // catene tra un taglio e l'altro
  const chains: Segment[][] = [];
  if (p.closed) {
    const start = cutAfter.findIndex(Boolean) + 1;
    let cur: Segment[] = [];
    for (let k = 0; k < pieces.length; k++) {
      const i = (start + k) % pieces.length;
      cur.push(pieces[i]!);
      if (cutAfter[i]) {
        chains.push(cur);
        cur = [];
      }
    }
    if (cur.length) chains.push(cur);
  } else {
    let cur: Segment[] = [];
    pieces.forEach((s, i) => {
      cur.push(s);
      if (cutAfter[i] && i < pieces.length - 1) {
        chains.push(cur);
        cur = [];
      }
    });
    if (cur.length) chains.push(cur);
  }
  // catene consecutive dallo stesso lato (l'asse è solo sfiorato) → una sola
  const merged: { side: number; segs: Segment[] }[] = [];
  for (const ch of chains) {
    const sd = chainSide(ctx, ch);
    const last = merged[merged.length - 1];
    if (last && last.side === sd) last.segs.push(...ch);
    else merged.push({ side: sd, segs: [...ch] });
  }
  if (p.closed && merged.length > 1 && merged[0]!.side === merged[merged.length - 1]!.side) {
    const tail = merged.pop()!;
    merged[0]!.segs.unshift(...tail.segs);
  }
  const kept = merged.filter((m) => m.side === ctx.sign);
  if (kept.length !== 1 || merged.length < 2) return null;
  const segs = kept[0]!.segs.map((s) => ({ ...s }) as Segment);
  if (p.closed) {
    // estremi esattamente sull'asse, giunzioni lisce dove la curva taglia l'asse quasi di traverso
    segs[0] = { ...segs[0]!, p0: snap(ctx, segs[0]!.p0) } as Segment;
    const n = segs.length - 1;
    segs[n] = { ...segs[n]!, p1: snap(ctx, segs[n]!.p1) } as Segment;
    segs[0] = squareJoint(ctx, segs[0]!, true);
    segs[n] = squareJoint(ctx, segs[n]!, false);
    const back = [...segs].reverse().map((s) => reverseSeg(reflectSeg(ctx, s)));
    return [...segs, ...back];
  }
  // aperto: un solo taglio. Si va dall'estremo tenuto all'asse e poi al riflesso dell'estremo.
  if (merged.length !== 2) return null;
  const startsKept = merged[0]!.side === ctx.sign;
  const half = startsKept ? segs : [...segs].reverse().map(reverseSeg);
  const n = half.length - 1;
  half[n] = squareJoint(ctx, { ...half[n]!, p1: snap(ctx, half[n]!.p1) } as Segment, false);
  const back = [...half].reverse().map((s) => reverseSeg(reflectSeg(ctx, s)));
  return [...half, ...back];
}

/**
 * Tiene la metà `keep` del logo e sostituisce l'altra con il suo riflesso rispetto a `axis`.
 * `editable` indica quali tracciati si possono cambiare (gli esclusi restano identici).
 */
export function mirrorHalf(
  paths: PathData[],
  axis: MirrorAxis,
  keep: MirrorKeep,
  editable: (p: PathData) => boolean = () => true,
): MirrorResult {
  const b = bounds(paths.flatMap((p) => p.segments.flatMap((s) => [s.p0, s.p1])));
  const D = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) || 1;
  const ctx: Ctx = {
    vertical: axis.vertical,
    c: axis.c,
    sign: keep === 'right' || keep === 'bottom' ? 1 : -1,
    D,
  };
  const margin = 0.002 * D;
  const out = paths.map((p) => p);
  let anchors = 0;
  let skipped = 0;
  // 1. lato di ogni tracciato
  const where = paths.map((p) => {
    const pts = samplePath(p, D / 200);
    let lo = Infinity;
    let hi = -Infinity;
    for (const q of pts) {
      const v = side(ctx, q);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    if (hi <= margin) return -1;
    if (lo >= -margin) return 1;
    return 0;
  });
  // 2. tracciati che attraversano l'asse
  paths.forEach((p, i) => {
    if (where[i] !== 0 || !editable(p)) return;
    const segs = mirrorCrossing(ctx, p);
    if (!segs) {
      skipped++;
      return;
    }
    out[i] = { ...p, segments: segs };
    anchors += segs.length;
  });
  // 3. tracciati tutti da un lato: quelli del lato scartato prendono la forma del gemello riflesso
  const keptIdx = paths.map((_, i) => i).filter((i) => where[i] === ctx.sign);
  const dropIdx = paths.map((_, i) => i).filter((i) => where[i] === -ctx.sign);
  const used = new Set<number>();
  const pairs: { d: number; k: number; j: number }[] = [];
  // campioni e griglie una volta sola per tracciato (non per coppia)
  const info = new Map<number, { pts: Vec2[]; cx: number; cy: number; size: number }>();
  const infoOf = (i: number, reflect: boolean) => {
    const key = reflect ? -1 - i : i;
    let v = info.get(key);
    if (!v) {
      const raw = samplePath(paths[i]!, D / 150);
      const pts = reflect ? raw.map((q) => reflectP(ctx, q)) : raw;
      const bb = bounds(pts);
      v = {
        pts,
        cx: (bb.x0 + bb.x1) / 2,
        cy: (bb.y0 + bb.y1) / 2,
        size: Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0),
      };
      info.set(key, v);
    }
    return v;
  };
  const grids = new Map<number, (q: Vec2) => number>();
  const gridOf = (key: number, pts: Vec2[], cap: number) => {
    let g = grids.get(key);
    if (!g) grids.set(key, (g = nearestFn(pts, cap / 8, cap)));
    return g;
  };
  for (const j of dropIdx) {
    if (!editable(paths[j]!)) continue;
    const J = infoOf(j, false);
    const cap = Math.max(J.size, D / 10);
    for (const k of keptIdx) {
      if (paths[k]!.closed !== paths[j]!.closed) continue;
      const K = infoOf(k, true);
      // solo forme vicine e di misura simile
      if (Math.hypot(K.cx - J.cx, K.cy - J.cy) > 0.5 * J.size + 0.02 * D) continue;
      if (K.size > 1.5 * J.size + 0.01 * D || J.size > 1.5 * K.size + 0.01 * D) continue;
      const nk = gridOf(-1 - k, K.pts, cap);
      const nj = gridOf(j, J.pts, cap);
      let s = 0;
      for (const q of J.pts) s += nk(q);
      for (const q of K.pts) s += nj(q);
      const d = s / (J.pts.length + K.pts.length);
      if (d <= Math.max(0.25 * J.size, 0.01 * D)) pairs.push({ d, k, j });
    }
  }
  pairs.sort((x, y) => x.d - y.d);
  const done = new Set<number>();
  for (const { k, j } of pairs) {
    if (used.has(k) || done.has(j)) continue;
    used.add(k);
    done.add(j);
    const src = paths[k]!;
    let segs = src.segments.map((s) => reflectSeg(ctx, s));
    // il riflesso inverte il verso: si rimette quello del tracciato sostituito (buchi corretti)
    const tgt = paths[j]!;
    if (
      tgt.closed &&
      Math.sign(signedArea({ ...tgt })) !== Math.sign(signedArea({ ...src, segments: segs }))
    ) {
      segs = [...segs].reverse().map(reverseSeg);
    }
    out[j] = { ...tgt, segments: segs, closed: src.closed };
    anchors += segs.length;
  }
  skipped += dropIdx.filter((j) => !done.has(j)).length;
  return { paths: out, axis, keep, anchors, skipped };
}

/** Metà da tenere in automatico: quella con meno anchor (di solito la più pulita). */
export function autoKeep(paths: PathData[], axis: MirrorAxis): MirrorKeep {
  let lo = 0;
  let hi = 0;
  for (const p of paths)
    for (const s of p.segments) {
      const v = (axis.vertical ? s.p0.x : s.p0.y) - axis.c;
      if (v < 0) lo++;
      else if (v > 0) hi++;
    }
  if (axis.vertical) return hi < lo ? 'right' : 'left';
  return hi < lo ? 'bottom' : 'top';
}
