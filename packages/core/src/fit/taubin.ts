import type { Vec2 } from '../model';

export interface CircleFit {
  cx: number;
  cy: number;
  r: number;
}

function moments(points: Vec2[]) {
  const n = points.length;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let Mxx = 0,
    Myy = 0,
    Mxy = 0,
    Mxz = 0,
    Myz = 0,
    Mzz = 0;
  for (const p of points) {
    const X = p.x - mx;
    const Y = p.y - my;
    const Z = X * X + Y * Y;
    Mxx += X * X;
    Myy += Y * Y;
    Mxy += X * Y;
    Mxz += X * Z;
    Myz += Y * Z;
    Mzz += Z * Z;
  }
  Mxx /= n;
  Myy /= n;
  Mxy /= n;
  Mxz /= n;
  Myz /= n;
  Mzz /= n;
  return { mx, my, Mxx, Myy, Mxy, Mxz, Myz, Mzz, Mz: Mxx + Myy };
}

/** Fit di Kåsa (minimi quadrati algebrici): stima iniziale, meno accurata su archi corti. */
export function fitCircleKasa(points: Vec2[]): CircleFit | null {
  if (points.length < 3) return null;
  const { mx, my, Mxx, Myy, Mxy, Mxz, Myz, Mz } = moments(points);
  const det = Mxx * Myy - Mxy * Mxy;
  if (Math.abs(det) < 1e-18 * (Mz * Mz + 1e-300)) return null;
  const xc = (Mxz * Myy - Myz * Mxy) / det / 2;
  const yc = (Myz * Mxx - Mxz * Mxy) / det / 2;
  const r = Math.sqrt(xc * xc + yc * yc + Mz);
  return Number.isFinite(r) ? { cx: xc + mx, cy: yc + my, r } : null;
}

/**
 * Fit di Taubin con il metodo di Newton sul polinomio caratteristico (Chernov),
 * senza SVD. Più accurato di Kåsa sugli archi corti; nullo se i punti sono allineati.
 */
export function fitCircleTaubin(points: Vec2[]): CircleFit | null {
  if (points.length < 3) return null;
  const { mx, my, Mxx, Myy, Mxy, Mxz, Myz, Mzz, Mz } = moments(points);
  const covXY = Mxx * Myy - Mxy * Mxy;
  const A3 = 4 * Mz;
  const A2 = -3 * Mz * Mz - Mzz;
  const A1 = Mzz * Mz + 4 * covXY * Mz - Mxz * Mxz - Myz * Myz - Mz * Mz * Mz;
  const A0 =
    Mxz * Mxz * Myy + Myz * Myz * Mxx - Mzz * covXY - 2 * Mxz * Myz * Mxy + Mz * Mz * covXY;
  const A22 = A2 + A2;
  const A33 = A3 + A3 + A3;
  let x = 0;
  let y = A0;
  for (let it = 0; it < 99; it++) {
    const Dy = A1 + x * (A22 + A33 * x);
    const xnew = x - y / Dy;
    if (!Number.isFinite(xnew) || xnew === x) break;
    const ynew = A0 + xnew * (A1 + xnew * (A2 + xnew * A3));
    if (Math.abs(ynew) >= Math.abs(y)) break;
    x = xnew;
    y = ynew;
  }
  const det = x * x - x * Mz + covXY;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-18 * (Mz * Mz + 1e-300)) return null;
  const xc = (Mxz * (Myy - x) - Myz * Mxy) / det / 2;
  const yc = (Myz * (Mxx - x) - Mxz * Mxy) / det / 2;
  const r = Math.sqrt(xc * xc + yc * yc + Mz - 2 * x);
  if (!Number.isFinite(r) || r <= 0) return null;
  return { cx: xc + mx, cy: yc + my, r };
}

/** Scarto radiale massimo |dist(p, centro) − r| tra i punti e il cerchio. */
export function maxRadialDeviation(points: Vec2[], c: CircleFit): number {
  let worst = 0;
  for (const p of points) {
    const d = Math.abs(Math.hypot(p.x - c.cx, p.y - c.cy) - c.r);
    if (d > worst) worst = d;
  }
  return worst;
}
