import type { Vec2 } from '../model';

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function bboxOfPoints(points: Iterable<Vec2>): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** D: diagonale del bounding box. Tutte le tolleranze del core sono frazioni di D. */
export const diagonal = (b: BBox): number => Math.hypot(b.width, b.height);
