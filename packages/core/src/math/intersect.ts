import type { Vec2 } from '../model';
import { cross, sub } from './vec2';

/**
 * Intersezione di due rette r1: a + t·da, r2: b + s·db.
 * Restituisce null se sono (quasi) parallele.
 */
export function intersectLines(a: Vec2, da: Vec2, b: Vec2, db: Vec2): Vec2 | null {
  const den = cross(da, db);
  const scaleRef = Math.hypot(da.x, da.y) * Math.hypot(db.x, db.y);
  if (scaleRef === 0 || Math.abs(den) < 1e-9 * scaleRef) return null;
  const t = cross(sub(b, a), db) / den;
  return { x: a.x + da.x * t, y: a.y + da.y * t };
}

/** Distanza di un punto dalla retta per `a` con direzione `d`. */
export function distPointLine(p: Vec2, a: Vec2, d: Vec2): number {
  const l = Math.hypot(d.x, d.y);
  if (l === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(cross(d, sub(p, a))) / l;
}
