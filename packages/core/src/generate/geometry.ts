// Strumenti comuni di GENERA: tracciati come nodi (anchor + maniglie), misura dello scarto.

import type { DocumentGeometry, PathData, Segment, Vec2 } from '../model';

export interface GNode {
  p: Vec2;
  hin: Vec2;
  hout: Vec2;
}
export interface GPath {
  src: PathData;
  closed: boolean;
  nodes: GNode[];
}

const cp = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const segCount = (w: GPath) => (w.closed ? w.nodes.length : w.nodes.length - 1);

export function toNodes(p: PathData): GPath {
  const segs = p.segments;
  const n = p.closed ? segs.length : segs.length + 1;
  const nodes: GNode[] = [];
  for (let i = 0; i < n; i++) {
    const out = i < segs.length ? segs[i] : undefined;
    const inn = p.closed
      ? segs[(i - 1 + segs.length) % segs.length]
      : i > 0
        ? segs[i - 1]
        : undefined;
    const pos = out ? out.p0 : inn!.p1;
    const hout = out && out.kind === 'cubic' ? out.c1 : pos;
    const hin = inn && inn.kind === 'cubic' ? inn.c2 : pos;
    nodes.push({ p: cp(pos), hin: cp(hin), hout: cp(hout) });
  }
  return { src: p, closed: p.closed, nodes };
}

export function fromNodes(w: GPath): PathData {
  const segments: Segment[] = [];
  const n = w.nodes.length;
  for (let i = 0; i < segCount(w); i++) {
    const a = w.nodes[i]!;
    const b = w.nodes[(i + 1) % n]!;
    const straight = dist(a.hout, a.p) < 1e-7 && dist(b.hin, b.p) < 1e-7;
    segments.push(
      straight
        ? { kind: 'line', p0: cp(a.p), p1: cp(b.p) }
        : { kind: 'cubic', p0: cp(a.p), c1: cp(a.hout), c2: cp(b.hin), p1: cp(b.p) },
    );
  }
  return { ...w.src, segments };
}

/** Sposta un anchor portandosi dietro le maniglie. */
export function moveNode(n: GNode, to: Vec2) {
  const dx = to.x - n.p.x;
  const dy = to.y - n.p.y;
  n.p = { x: to.x, y: to.y };
  n.hin = { x: n.hin.x + dx, y: n.hin.y + dy };
  n.hout = { x: n.hout.x + dx, y: n.hout.y + dy };
}

export function pointAt(s: Segment, t: number): Vec2 {
  if (s.kind === 'line')
    return { x: s.p0.x + (s.p1.x - s.p0.x) * t, y: s.p0.y + (s.p1.y - s.p0.y) * t };
  const u = 1 - t;
  return {
    x: u * u * u * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p1.x,
    y: u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p1.y,
  };
}

/** Campioni lungo i contorni, circa ogni `step`. */
export function samplePaths(paths: PathData[], step: number): Vec2[] {
  const out: Vec2[] = [];
  for (const p of paths)
    for (const s of p.segments) {
      const len =
        s.kind === 'line'
          ? dist(s.p0, s.p1)
          : dist(s.p0, s.c1) + dist(s.c1, s.c2) + dist(s.c2, s.p1);
      const n = Math.max(2, Math.ceil(len / step));
      for (let k = 0; k <= n; k++) out.push(pointAt(s, k / n));
    }
  return out;
}

export function bboxOf(paths: PathData[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of samplePaths(paths, 1e9)) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, D: Math.hypot(x1 - x0, y1 - y0) || 1 };
}

/** Distanza dal punto più vicino di una nuvola (griglia per la velocità). */
function nearest(pts: Vec2[], cell: number) {
  const grid = new Map<string, Vec2[]>();
  for (const p of pts) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    const l = grid.get(k);
    if (l) l.push(p);
    else grid.set(k, [p]);
  }
  return (q: Vec2) => {
    const gx = Math.floor(q.x / cell);
    const gy = Math.floor(q.y / cell);
    for (let r = 1; r < 64; r++) {
      let best = Infinity;
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (const p of grid.get(`${gx + dx},${gy + dy}`) ?? [])
            best = Math.min(best, dist(p, q));
      if (best <= r * cell) return best;
    }
    return Infinity;
  };
}

/**
 * Scarto tra due disegni con gli stessi tracciati: per ogni tracciato, distanza di Hausdorff tra i
 * contorni (campionati); si restituisce il massimo e la media.
 */
export function driftStats(
  a: DocumentGeometry,
  b: DocumentGeometry,
): { max: number; mean: number } {
  const D = bboxOf(b.paths).D;
  const step = D / 400;
  let max = 0;
  let sum = 0;
  let count = 0;
  const byId = new Map(b.paths.map((p) => [p.id, p]));
  for (const pa of a.paths) {
    const pb = byId.get(pa.id);
    if (!pb) continue;
    const sa = samplePaths([pa], step);
    const sb = samplePaths([pb], step);
    const na = nearest(sa, D / 50);
    const nb = nearest(sb, D / 50);
    for (const q of sa) {
      const d = nb(q);
      max = Math.max(max, d);
      sum += d;
      count++;
    }
    for (const q of sb) max = Math.max(max, na(q));
  }
  return { max, mean: count ? sum / count : 0 };
}

export const geometryDrift = (a: DocumentGeometry, b: DocumentGeometry) => driftStats(a, b).max;

export const anchorCount = (g: DocumentGeometry) =>
  g.paths.reduce((s, p) => s + p.segments.length + (p.closed ? 0 : 1), 0);
