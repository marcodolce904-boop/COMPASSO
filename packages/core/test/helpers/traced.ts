import type { DocumentGeometry, PathData, Segment, Vec2 } from '../../src';

function rng(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/**
 * Tracciato chiuso "ricalcato": n punti della curva con rumore uniforme ±noise, uniti da cubiche
 * Catmull-Rom (tangenti continue), come fa un ricalco automatico.
 */
export function traced(
  fx: (t: number) => Vec2,
  n: number,
  noise: number,
  seed = 1,
  id = 'p',
): PathData {
  const r = rng(seed);
  const pts = Array.from({ length: n }, (_, i) => {
    const p = fx((i / n) * 2 * Math.PI);
    return { x: p.x + (r() - 0.5) * 2 * noise, y: p.y + (r() - 0.5) * 2 * noise };
  });
  const segs: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    segs.push({
      kind: 'cubic',
      p0: p1,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p1: p2,
    });
  }
  return { id, closed: true, filled: true, stroked: false, segments: segs };
}

export const circleFn = (cx: number, cy: number, r: number) => (t: number) => ({
  x: cx + r * Math.cos(t),
  y: cy + r * Math.sin(t),
});
export const ellipseFn =
  (cx: number, cy: number, rx: number, ry: number, rot = 0) =>
  (t: number) => {
    const u = rx * Math.cos(t);
    const v = ry * Math.sin(t);
    return {
      x: cx + u * Math.cos(rot) - v * Math.sin(rot),
      y: cy + u * Math.sin(rot) + v * Math.cos(rot),
    };
  };
export const geo = (paths: PathData[]): DocumentGeometry => ({
  source: 'svg',
  paths,
  warnings: [],
});
