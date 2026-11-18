// Curve libere → catena di archi tangenti (costruzione «a compasso» di una curva qualsiasi).
// Un arco che parte da P con tangente T e arriva a Q è unico: si allunga ogni arco finché la curva
// resta entro la tolleranza, poi il successivo parte da Q con la tangente dell'arco precedente.
// Così la catena è continua e senza spigoli (G1), con il minimo di archi che la procedura trova.

import type { Vec2 } from '../model';

export interface ArcPiece {
  cx: number;
  cy: number;
  r: number;
  from: Vec2;
  to: Vec2;
  /** Scarto massimo della curva dall'arco, nei punti che l'arco copre. */
  deviation: number;
  /** Ampiezza dell'arco (radianti) e lunghezza della curva coperta. */
  sweep: number;
  length: number;
  /** Indici dei campioni coperti, da `i0` a `i1`. */
  i0: number;
  i1: number;
}

const EPS = 1e-12;

/** Cerchio tangente a `t` in `p` che passa per `q` (null se è quasi una retta). */
function tangentCircle(
  p: Vec2,
  t: Vec2,
  q: Vec2,
): { cx: number; cy: number; r: number; k: number } | null {
  const n = { x: -t.y, y: t.x }; // normale a sinistra
  const d = { x: q.x - p.x, y: q.y - p.y };
  const den = 2 * (d.x * n.x + d.y * n.y);
  const dd = d.x * d.x + d.y * d.y;
  if (dd < EPS) return null;
  // corda allineata alla tangente: «arco» di raggio enorme (un tratto dritto)
  const k = Math.abs(den) < 1e-9 * dd ? 1e9 * Math.sqrt(dd) : dd / den; // raggio con segno
  return { cx: p.x + n.x * k, cy: p.y + n.y * k, r: Math.abs(k), k };
}

function deviationOf(
  pts: Vec2[],
  i0: number,
  i1: number,
  c: { cx: number; cy: number; r: number },
) {
  let worst = 0;
  for (let i = i0 + 1; i < i1; i++) {
    const d = Math.abs(Math.hypot(pts[i]!.x - c.cx, pts[i]!.y - c.cy) - c.r);
    if (d > worst) worst = d;
  }
  return worst;
}

function unit(v: Vec2): Vec2 | null {
  const l = Math.hypot(v.x, v.y);
  return l < EPS ? null : { x: v.x / l, y: v.y / l };
}

/** Tangente della curva campionata nel campione i (differenza centrale). */
function tangentAt(pts: Vec2[], i: number): Vec2 | null {
  const a = pts[Math.max(0, i - 1)]!;
  const b = pts[Math.min(pts.length - 1, i + 1)]!;
  return unit({ x: b.x - a.x, y: b.y - a.y });
}

function arcOf(
  pts: Vec2[],
  cum: number[],
  i0: number,
  i1: number,
  p: Vec2,
  t: Vec2,
  q: Vec2,
): ArcPiece | null {
  const c = tangentCircle(p, t, q);
  if (!c) return null;
  const a0 = Math.atan2(p.y - c.cy, p.x - c.cx);
  const a1 = Math.atan2(q.y - c.cy, q.x - c.cx);
  let sweep = Math.abs(a1 - a0);
  if (sweep > Math.PI) sweep = 2 * Math.PI - sweep;
  if ((q.x - p.x) * t.x + (q.y - p.y) * t.y < 0) sweep = 2 * Math.PI - sweep;
  return {
    cx: c.cx,
    cy: c.cy,
    r: c.r,
    from: p,
    to: q,
    deviation: deviationOf(pts, i0, i1, c),
    sweep,
    length: cum[i1]! - cum[i0]!,
    i0,
    i1,
  };
}

/**
 * Biarco tra i campioni i0 e i1: il primo arco parte con la tangente `t0` (quella dell'arco
 * precedente, così la catena non ha spigoli), il punto di passaggio è un campione della curva,
 * scelto perché il secondo arco arrivi in i1 con la direzione della curva. null se nessun
 * campione lo permette entro 3°.
 */
function biarc(pts: Vec2[], cum: number[], i0: number, i1: number, t0: Vec2): ArcPiece[] | null {
  const p0 = pts[i0]!;
  const p1 = pts[i1]!;
  const t1 = tangentAt(pts, i1);
  if (!t1) return null;
  // tra i passaggi che arrivano con la direzione giusta (entro 3°) vince quello con lo scarto minore
  const lim = (3 * Math.PI) / 180;
  let best: { arcs: ArcPiece[]; dev: number } | null = null;
  const edge = Math.max(2, Math.floor(0.1 * (i1 - i0))); // niente archi minuscoli agli estremi
  for (let j = i0 + edge; j <= i1 - edge; j++) {
    const q = pts[j]!;
    const c1 = tangentCircle(p0, t0, q);
    if (!c1) continue;
    const sg = c1.k > 0 ? 1 : -1;
    const tj = unit({ x: -(q.y - c1.cy) * sg, y: (q.x - c1.cx) * sg });
    if (!tj) continue;
    const c2 = tangentCircle(q, tj, p1);
    if (!c2) continue;
    const s2 = c2.k > 0 ? 1 : -1;
    const te = unit({ x: -(p1.y - c2.cy) * s2, y: (p1.x - c2.cx) * s2 });
    if (!te) continue;
    const miss = Math.acos(Math.max(-1, Math.min(1, te.x * t1.x + te.y * t1.y)));
    if (miss > lim) continue;
    const a = arcOf(pts, cum, i0, j, p0, t0, q);
    const b = arcOf(pts, cum, j, i1, q, tj, p1);
    if (!a || !b) continue;
    const dev = Math.max(a.deviation, b.deviation);
    if (!best || dev < best.dev) best = { arcs: [a, b], dev };
  }
  return best ? best.arcs : null;
}

/** Tangente d'arrivo di un arco (nel verso di percorrenza). */
function endTangent(a: ArcPiece, t0: Vec2): Vec2 {
  // verso di rotazione dal punto di partenza e dalla tangente iniziale
  const k = (a.from.x - a.cx) * t0.y - (a.from.y - a.cy) * t0.x;
  const sg = k < 0 ? 1 : -1;
  return unit({ x: -(a.to.y - a.cy) * sg, y: (a.to.x - a.cx) * sg }) ?? t0;
}

/**
 * Approssima la curva campionata `pts` (fitta, in ordine di percorrenza) con una catena di archi
 * tangenti entro `tol`: biarchi sulla curva intera, divisi a metà dove non bastano. Due archi
 * consecutivi quasi uguali diventano uno. null se servirebbero più di `maxArcs` archi.
 */
export function arcSpline(pts: Vec2[], tol: number, maxArcs: number): ArcPiece[] | null {
  if (pts.length < 5) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const out: ArcPiece[] = [];
  let t = tangentAt(pts, 0);
  if (!t) return null;
  // in ordine di percorrenza: ogni biarco va il più lontano possibile (ricerca binaria sulla fine)
  // e parte con la tangente d'arrivo del biarco prima (catena senza spigoli)
  const last = pts.length - 1;
  let i0 = 0;
  while (i0 < last) {
    if (out.length >= maxArcs) return null;
    const ok = (i1: number) => {
      const arcs = biarc(pts, cum, i0, i1, t!);
      return arcs && arcs.every((a) => a.deviation <= tol) ? arcs : null;
    };
    let hi = last;
    let found = ok(hi);
    if (!found) {
      let lo = Math.min(last, i0 + 6);
      let fl = ok(lo);
      if (!fl) {
        // nessun biarco corto regge (es. vicino a un flesso): un arco solo, il più lungo possibile,
        // che parte con la tangente giusta
        const one = (i1: number) => {
          const a = arcOf(pts, cum, i0, i1, pts[i0]!, t!, pts[i1]!);
          return a && a.deviation <= tol ? a : null;
        };
        let lo1 = i0 + 1;
        let f1 = one(lo1);
        if (!f1) return null;
        let hi1 = last;
        const whole = one(hi1);
        if (whole) {
          f1 = whole;
          lo1 = hi1;
        } else {
          while (hi1 - lo1 > 1) {
            const m = (lo1 + hi1) >> 1;
            const f = one(m);
            if (f) {
              lo1 = m;
              f1 = f;
            } else hi1 = m;
          }
        }
        out.push(f1);
        t = endTangent(f1, t!);
        i0 = lo1;
        continue;
      }
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        const f = ok(m);
        if (f) {
          lo = m;
          fl = f;
        } else hi = m;
      }
      found = fl;
      hi = lo;
    }
    out.push(...found);
    t = endTangent(found[1]!, endTangent(found[0]!, t!));
    i0 = hi;
  }
  // archi consecutivi sullo stesso cerchio → uno solo (es. un biarco su un arco vero)
  const merged: ArcPiece[] = [];
  for (const a of out) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      Math.hypot(prev.cx - a.cx, prev.cy - a.cy) <= tol &&
      Math.abs(prev.r - a.r) <= tol
    ) {
      merged[merged.length - 1] = {
        ...prev,
        to: a.to,
        i1: a.i1,
        sweep: prev.sweep + a.sweep,
        length: prev.length + a.length,
        deviation: Math.max(prev.deviation, a.deviation),
      };
    } else merged.push(a);
  }
  return merged.length <= maxArcs ? merged : null;
}
