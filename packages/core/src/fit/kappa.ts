import type { Segment } from '../model';
import { angleBetween, dist, dot, intersectLines, len, perp, sub, tangentAt } from '../math';

export interface KappaArc {
  cx: number;
  cy: number;
  r: number;
  /** Ampiezza dell'arco in radianti, in (0, π]. */
  theta: number;
}

const RADIUS_TOL = 0.005; // r0 e r1 entro lo 0,5%
const HANDLE_TOL = 0.02; // maniglie entro il 2% di h

/**
 * Test rapido in forma chiusa (§6.3.1). Interseca le normali agli estremi per trovare il
 * centro, poi confronta la lunghezza delle maniglie con h = (4/3)·tan(θ/4)·r.
 * Restituisce l'arco esatto, oppure null se il segmento non è un arco.
 */
export function kappaArc(s: Segment): KappaArc | null {
  if (s.kind !== 'cubic') return null;
  const t0 = tangentAt(s, false);
  const t1 = tangentAt(s, true);
  if (len(t0) === 0 || len(t1) === 0) return null;
  const C = intersectLines(s.p0, perp(t0), s.p1, perp(t1));
  if (!C) return null;
  const r0 = dist(s.p0, C);
  const r1 = dist(s.p1, C);
  const r = (r0 + r1) / 2;
  if (r === 0 || Math.abs(r0 - r1) / r > RADIUS_TOL) return null;
  const theta = angleBetween(sub(s.p0, C), sub(s.p1, C));
  if (theta < 1e-6) return null;
  // maniglie dalla parte giusta: devono andare verso l'altro estremo
  const chord = sub(s.p1, s.p0);
  if (dot(sub(s.c1, s.p0), chord) <= 0 || dot(sub(s.c2, s.p1), chord) >= 0) return null;
  const h = (4 / 3) * Math.tan(theta / 4) * r;
  const e0 = Math.abs(dist(s.c1, s.p0) - h);
  const e1 = Math.abs(dist(s.p1, s.c2) - h);
  if (e0 > HANDLE_TOL * h || e1 > HANDLE_TOL * h) return null;
  return { cx: C.x, cy: C.y, r, theta };
}
