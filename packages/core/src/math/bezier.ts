import type { Segment, Vec2 } from '../model';
import { dist, len, sub } from './vec2';

export function cubicAt(p0: Vec2, c1: Vec2, c2: Vec2, p1: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
}

export function segmentAt(s: Segment, t: number): Vec2 {
  if (s.kind === 'line') {
    return { x: s.p0.x + (s.p1.x - s.p0.x) * t, y: s.p0.y + (s.p1.y - s.p0.y) * t };
  }
  return cubicAt(s.p0, s.c1, s.c2, s.p1, t);
}

/** `n` punti equispaziati in t, estremi inclusi (n ≥ 2). */
export function sampleSegment(s: Segment, n: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) out.push(segmentAt(s, i / (n - 1)));
  return out;
}

/** Lunghezza approssimata (poligonale su 24 campioni per le cubiche). */
export function segmentLength(s: Segment): number {
  if (s.kind === 'line') return dist(s.p0, s.p1);
  const pts = sampleSegment(s, 24);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1] as Vec2, pts[i] as Vec2);
  return total;
}

/**
 * Direzione della tangente in uscita (`end = false`) o in entrata (`end = true`)
 * di un segmento. Gestisce le maniglie coincidenti con l'anchor.
 */
export function tangentAt(s: Segment, end: boolean): Vec2 {
  if (s.kind === 'line') return sub(s.p1, s.p0);
  const eps = 1e-9;
  if (!end) {
    for (const q of [s.c1, s.c2, s.p1]) {
      const d = sub(q, s.p0);
      if (len(d) > eps) return d;
    }
    return { x: 0, y: 0 };
  }
  for (const q of [s.c2, s.c1, s.p0]) {
    const d = sub(s.p1, q);
    if (len(d) > eps) return d;
  }
  return { x: 0, y: 0 };
}
