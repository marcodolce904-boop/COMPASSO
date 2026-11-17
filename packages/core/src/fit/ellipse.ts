import type { Vec2 } from '../model';

/** Ellisse: centro, semiassi (rx ≥ ry) e rotazione dell'asse maggiore in [0, π) radianti. */
export interface EllipseFit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
}

/** Punto dell'ellisse al parametro t. */
export function ellipsePoint(e: EllipseFit, t: number): Vec2 {
  const c = Math.cos(e.rotation);
  const s = Math.sin(e.rotation);
  const u = e.rx * Math.cos(t);
  const v = e.ry * Math.sin(t);
  return { x: e.cx + u * c - v * s, y: e.cy + u * s + v * c };
}

/** Coordinate di p nel riferimento dell'ellisse (centrato, asse maggiore lungo u). */
export function toEllipseFrame(p: Vec2, e: EllipseFit): Vec2 {
  const c = Math.cos(e.rotation);
  const s = Math.sin(e.rotation);
  const dx = p.x - e.cx;
  const dy = p.y - e.cy;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/** Parametro t del punto dell'ellisse più vicino a p (Newton, partenza dall'angolo normalizzato). */
export function nearestParam(p: Vec2, e: EllipseFit): number {
  const { x: u, y: v } = toEllipseFrame(p, e);
  const a = e.rx;
  const b = e.ry;
  let t = Math.atan2(a * v, b * u);
  for (let i = 0; i < 12; i++) {
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const f = (a * a - b * b) * ct * st - u * a * st + v * b * ct;
    const df = (a * a - b * b) * (ct * ct - st * st) - u * a * ct - v * b * st;
    if (Math.abs(df) < 1e-15) break;
    const step = f / df;
    t -= step;
    if (Math.abs(step) < 1e-13) break;
  }
  return t;
}

/** Distanza geometrica (vera, non algebrica) di p dal contorno dell'ellisse. */
export function ellipseDistance(p: Vec2, e: EllipseFit): number {
  const q = ellipsePoint(e, nearestParam(p, e));
  return Math.hypot(p.x - q.x, p.y - q.y);
}

export function maxEllipseDeviation(points: Vec2[], e: EllipseFit): number {
  let m = 0;
  for (const p of points) m = Math.max(m, ellipseDistance(p, e));
  return m;
}

// --- algebra 3×3 ------------------------------------------------------------------------------

type M3 = number[][];
const det3 = (m: M3) =>
  m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
  m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
  m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);

function inv3(m: M3): M3 | null {
  const d = det3(m);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-300) return null;
  const a = m;
  const c = (r: number, k: number) => a[r]![k]!;
  return [
    [
      (c(1, 1) * c(2, 2) - c(1, 2) * c(2, 1)) / d,
      (c(0, 2) * c(2, 1) - c(0, 1) * c(2, 2)) / d,
      (c(0, 1) * c(1, 2) - c(0, 2) * c(1, 1)) / d,
    ],
    [
      (c(1, 2) * c(2, 0) - c(1, 0) * c(2, 2)) / d,
      (c(0, 0) * c(2, 2) - c(0, 2) * c(2, 0)) / d,
      (c(0, 2) * c(1, 0) - c(0, 0) * c(1, 2)) / d,
    ],
    [
      (c(1, 0) * c(2, 1) - c(1, 1) * c(2, 0)) / d,
      (c(0, 1) * c(2, 0) - c(0, 0) * c(2, 1)) / d,
      (c(0, 0) * c(1, 1) - c(0, 1) * c(1, 0)) / d,
    ],
  ];
}
const mul = (a: M3, b: M3): M3 =>
  a.map((row) =>
    [0, 1, 2].map((k) => row[0]! * b[0]![k]! + row[1]! * b[1]![k]! + row[2]! * b[2]![k]!),
  );
const tr = (a: M3): M3 => [0, 1, 2].map((r) => [0, 1, 2].map((k) => a[k]![r]!));

/** Radici reali di x³ + p2·x² + p1·x + p0. */
function cubicRoots(p2: number, p1: number, p0: number): number[] {
  const q = (3 * p1 - p2 * p2) / 9;
  const r = (9 * p2 * p1 - 27 * p0 - 2 * p2 * p2 * p2) / 54;
  const disc = q * q * q + r * r;
  const shift = -p2 / 3;
  if (disc > 0) {
    const s = Math.cbrt(r + Math.sqrt(disc));
    const t = Math.cbrt(r - Math.sqrt(disc));
    return [shift + s + t];
  }
  const th = Math.acos(Math.max(-1, Math.min(1, r / Math.sqrt(-q * q * q || 1e-300))));
  const m = 2 * Math.sqrt(-q);
  return [0, 1, 2].map((k) => shift + m * Math.cos((th + 2 * Math.PI * k) / 3));
}

/** Autovettore di m per l'autovalore lam (prodotto vettoriale delle righe di m − lam·I). */
function eigvec(m: M3, lam: number): number[] | null {
  const a = m.map((row, i) => row.map((v, k) => (i === k ? v - lam : v)));
  const cross = (u: number[], v: number[]) => [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
  let best: number[] | null = null;
  let bn = 0;
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const) {
    const c = cross(a[i]!, a[j]!);
    const n = Math.hypot(c[0]!, c[1]!, c[2]!);
    if (n > bn) {
      bn = n;
      best = c.map((v) => v / n);
    }
  }
  return best;
}

/**
 * Fit di un'ellisse ai minimi quadrati (metodo diretto di Fitzgibbon, forma stabile di Halíř–Flusser),
 * su punti normalizzati. Restituisce null se i punti non descrivono un'ellisse.
 */
export function fitEllipse(points: Vec2[]): EllipseFit | null {
  const n = points.length;
  if (n < 5) return null;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let s = 0;
  for (const p of points) s += (p.x - mx) ** 2 + (p.y - my) ** 2;
  s = Math.sqrt(s / n);
  if (!(s > 0)) return null;
  const S1: M3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const S2: M3 = S1.map((r) => [...r]);
  const S3: M3 = S1.map((r) => [...r]);
  for (const p of points) {
    const x = (p.x - mx) / s;
    const y = (p.y - my) / s;
    const d1 = [x * x, x * y, y * y];
    const d2 = [x, y, 1];
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 3; k++) {
        S1[i]![k]! += d1[i]! * d1[k]!;
        S2[i]![k]! += d1[i]! * d2[k]!;
        S3[i]![k]! += d2[i]! * d2[k]!;
      }
  }
  const S3i = inv3(S3);
  if (!S3i) return null;
  const T = mul(S3i, tr(S2)).map((r) => r.map((v) => -v));
  const M = mul(S2, T).map((r, i) => r.map((v, k) => v + S1[i]![k]!));
  // C1⁻¹·M con C1 = [[0,0,2],[0,−1,0],[2,0,0]]
  const Mc: M3 = [M[2]!.map((v) => v / 2), M[1]!.map((v) => -v), M[0]!.map((v) => v / 2)];
  const tr3 = Mc[0]![0]! + Mc[1]![1]! + Mc[2]![2]!;
  const minors =
    Mc[0]![0]! * Mc[1]![1]! -
    Mc[0]![1]! * Mc[1]![0]! +
    Mc[0]![0]! * Mc[2]![2]! -
    Mc[0]![2]! * Mc[2]![0]! +
    Mc[1]![1]! * Mc[2]![2]! -
    Mc[1]![2]! * Mc[2]![1]!;
  let a1: number[] | null = null;
  let bestCond = 0;
  for (const lam of cubicRoots(-tr3, minors, -det3(Mc))) {
    const v = eigvec(Mc, lam);
    if (!v) continue;
    const cond = 4 * v[0]! * v[2]! - v[1]! * v[1]!;
    if (cond > bestCond) {
      bestCond = cond;
      a1 = v;
    }
  }
  if (!a1) return null;
  const a2 = T.map((r) => r[0]! * a1![0]! + r[1]! * a1![1]! + r[2]! * a1![2]!);
  const [A, B, C] = a1 as [number, number, number];
  const [Dq, E, F] = a2 as [number, number, number];
  const det = 4 * A * C - B * B;
  if (!(det > 1e-14)) return null;
  const x0 = (B * E - 2 * C * Dq) / det;
  const y0 = (B * Dq - 2 * A * E) / det;
  const F0 = F + (Dq * x0 + E * y0) / 2;
  // autovalori della forma quadratica [[A, B/2], [B/2, C]]
  const mean = (A + C) / 2;
  const diff = Math.hypot((A - C) / 2, B / 2);
  const l1 = mean - diff; // più piccolo → asse maggiore
  const l2 = mean + diff;
  if (!(l1 * F0 < 0 && l2 * F0 < 0)) return null;
  const rx = Math.sqrt(-F0 / l1);
  const ry = Math.sqrt(-F0 / l2);
  // direzione dell'asse maggiore: autovettore di l1
  let rot = Math.abs(B) < 1e-15 && A <= C ? 0 : Math.atan2(l1 - A, B / 2);
  if (Math.abs(B) < 1e-15 && A > C) rot = Math.PI / 2;
  rot = ((rot % Math.PI) + Math.PI) % Math.PI;
  if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;
  return { cx: mx + x0 * s, cy: my + y0 * s, rx: rx * s, ry: ry * s, rotation: rot };
}
