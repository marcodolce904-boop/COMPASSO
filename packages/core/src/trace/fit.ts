// Dai punti alle curve: ricampionamento a passo costante (la distanza media tra i punti),
// media gaussiana lungo il tratto, spigoli dalla variazione di direzione, curve di Bézier
// col minimo di anchor (Schneider, "An Algorithm for Automatically Fitting Digitized Curves").

import type { Segment, Vec2 } from '../model';

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const len = (a: Vec2) => Math.hypot(a.x, a.y);
const unit = (a: Vec2): Vec2 => {
  const l = len(a);
  return l > 1e-12 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 };
};

/** Punti a distanza costante `step` lungo la polilinea (chiusa o aperta). */
export function resample(pts: Vec2[], step: number, closed: boolean): Vec2[] {
  const src = closed ? [...pts, pts[0]!] : pts;
  if (src.length < 2) return [...pts];
  const out: Vec2[] = [src[0]!];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1]!;
    const b = src[i]!;
    const d = len(sub(b, a));
    let t = step - carry;
    while (t <= d) {
      out.push(add(a, mul(sub(b, a), t / d)));
      t += step;
    }
    carry = d - (t - step);
  }
  if (!closed) {
    const last = src[src.length - 1]!;
    if (len(sub(last, out[out.length - 1]!)) > step * 0.3) out.push(last);
    else out[out.length - 1] = last;
  } else if (out.length > 1 && len(sub(out[out.length - 1]!, out[0]!)) < step * 0.3) out.pop();
  return out;
}

/**
 * Media gaussiana dei punti (sigma in campioni): ogni punto diventa la media pesata dei vicini,
 * più vicini pesano di più. Aperti: gli estremi restano fermi (riflessione puntuale).
 */
export function smooth(pts: Vec2[], sigma: number, closed: boolean): Vec2[] {
  const n = pts.length;
  if (sigma <= 0 || n < 3) return pts.map((p) => ({ ...p }));
  const r = Math.ceil(sigma * 2.5);
  const wts: number[] = [];
  for (let k = -r; k <= r; k++) wts.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const at = (i: number): Vec2 => {
    if (closed) return pts[((i % n) + n) % n]!;
    if (i < 0) return sub(mul(pts[0]!, 2), pts[Math.min(n - 1, -i)]!);
    if (i >= n) return sub(mul(pts[n - 1]!, 2), pts[Math.max(0, 2 * (n - 1) - i)]!);
    return pts[i]!;
  };
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    let sx = 0,
      sy = 0,
      sw = 0;
    for (let k = -r; k <= r; k++) {
      const p = at(i + k);
      const wk = wts[k + r]!;
      sx += p.x * wk;
      sy += p.y * wk;
      sw += wk;
    }
    out.push({ x: sx / sw, y: sy / sw });
  }
  if (!closed) {
    out[0] = { ...pts[0]! };
    out[n - 1] = { ...pts[n - 1]! };
  }
  return out;
}

/**
 * Spigoli: punti dove la direzione cambia più di `angle` (radianti) tra il tratto che arriva e
 * quello che parte, misurati su `k` campioni; si tiene il massimo locale.
 */
export function corners(pts: Vec2[], k: number, angle: number, closed: boolean): number[] {
  const n = pts.length;
  const turn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (!closed && (i < k || i >= n - k)) continue;
    const a = pts[(((i - k) % n) + n) % n]!;
    const p = pts[i]!;
    const b = pts[(i + k) % n]!;
    const u = unit(sub(p, a));
    const v = unit(sub(b, p));
    turn[i] = Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (turn[i]! < angle) continue;
    let isMax = true;
    for (let j = -k; j <= k && isMax; j++) {
      if (j === 0) continue;
      const q = closed ? (((i + j) % n) + n) % n : i + j;
      if (q < 0 || q >= n) continue;
      if (turn[q]! > turn[i]! || (turn[q] === turn[i] && q < i)) isMax = false;
    }
    if (isMax) out.push(i);
  }
  return out;
}

// --- Schneider ---------------------------------------------------------------------------------

type Bez = [Vec2, Vec2, Vec2, Vec2];

function bez(b: Bez, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * u * b[0].x + 3 * u * u * t * b[1].x + 3 * u * t * t * b[2].x + t * t * t * b[3].x,
    y: u * u * u * b[0].y + 3 * u * u * t * b[1].y + 3 * u * t * t * b[2].y + t * t * t * b[3].y,
  };
}
function bezD1(b: Bez, t: number): Vec2 {
  const u = 1 - t;
  return add(
    add(mul(sub(b[1], b[0]), 3 * u * u), mul(sub(b[2], b[1]), 6 * u * t)),
    mul(sub(b[3], b[2]), 3 * t * t),
  );
}
function bezD2(b: Bez, t: number): Vec2 {
  return add(
    mul(add(sub(b[2], mul(b[1], 2)), b[0]), 6 * (1 - t)),
    mul(add(sub(b[3], mul(b[2], 2)), b[1]), 6 * t),
  );
}

function chordParams(pts: Vec2[]): number[] {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)));
  const total = u[u.length - 1]! || 1;
  return u.map((v) => v / total);
}

function generate(pts: Vec2[], u: number[], t1: Vec2, t2: Vec2): Bez {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  let c00 = 0,
    c01 = 0,
    c11 = 0,
    x0 = 0,
    x1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i]!;
    const s = 1 - t;
    const a1 = mul(t1, 3 * s * s * t);
    const a2 = mul(t2, 3 * s * t * t);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const tmp = sub(
      pts[i]!,
      add(mul(first, s * s * s + 3 * s * s * t), mul(last, 3 * s * t * t + t * t * t)),
    );
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let al = det !== 0 ? (x0 * c11 - x1 * c01) / det : 0;
  let ar = det !== 0 ? (c00 * x1 - c01 * x0) / det : 0;
  const segLen = len(sub(last, first));
  const eps = 1e-6 * segLen;
  if (al < eps || ar < eps) {
    al = ar = segLen / 3;
  }
  return [first, add(first, mul(t1, al)), add(last, mul(t2, ar)), last];
}

function maxError(pts: Vec2[], b: Bez, u: number[]): { err: number; at: number } {
  let err = 0;
  let at = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = len(sub(bez(b, u[i]!), pts[i]!));
    if (d > err) {
      err = d;
      at = i;
    }
  }
  return { err, at };
}

function reparam(pts: Vec2[], b: Bez, u: number[]): number[] {
  return u.map((t, i) => {
    const d = sub(bez(b, t), pts[i]!);
    const d1 = bezD1(b, t);
    const d2 = bezD2(b, t);
    const den = dot(d1, d1) + dot(d, d2);
    if (Math.abs(den) < 1e-12) return t;
    return Math.max(0, Math.min(1, t - dot(d, d1) / den));
  });
}

function fitRange(pts: Vec2[], t1: Vec2, t2: Vec2, tol: number, out: Bez[]) {
  if (pts.length === 2) {
    const d = len(sub(pts[1]!, pts[0]!)) / 3;
    out.push([pts[0]!, add(pts[0]!, mul(t1, d)), add(pts[1]!, mul(t2, d)), pts[1]!]);
    return;
  }
  let u = chordParams(pts);
  let b = generate(pts, u, t1, t2);
  let { err, at } = maxError(pts, b, u);
  if (err < tol) {
    out.push(b);
    return;
  }
  if (err < tol * 4) {
    for (let k = 0; k < 6; k++) {
      u = reparam(pts, b, u);
      b = generate(pts, u, t1, t2);
      ({ err, at } = maxError(pts, b, u));
      if (err < tol) {
        out.push(b);
        return;
      }
    }
  }
  const split = Math.max(1, Math.min(pts.length - 2, at));
  const tc = unit(sub(pts[split - 1]!, pts[split + 1]!));
  fitRange(pts.slice(0, split + 1), t1, tc, tol, out);
  fitRange(pts.slice(split), mul(tc, -1), t2, tol, out);
}

/**
 * Massima distanza dei punti dalla corda tra il primo e l'ultimo, ignorando i punti a meno di
 * `trim` dagli estremi (vicino agli spigoli la linea centrale della matita si arrotonda).
 */
function chordDeviation(pts: Vec2[], trim = 0): number {
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const d = sub(b, a);
  const l = len(d);
  let m = 0;
  for (const p of pts) {
    if (trim > 0 && l > 3 * trim && (len(sub(p, a)) < trim || len(sub(p, b)) < trim)) continue;
    const v = sub(p, a);
    const dist = l > 1e-9 ? Math.abs(v.x * d.y - v.y * d.x) / l : len(v);
    m = Math.max(m, dist);
  }
  return m;
}

/** Tangente stimata all'estremo, su `k` campioni. */
function endTangent(pts: Vec2[], atStart: boolean, k: number): Vec2 {
  const n = pts.length;
  const m = Math.min(n - 1, Math.max(1, k));
  return atStart ? unit(sub(pts[m]!, pts[0]!)) : unit(sub(pts[n - 1 - m]!, pts[n - 1]!));
}

/**
 * Un tratto di punti → segmenti (rette se il tratto è dritto entro `tol`, altrimenti il minimo
 * di cubiche entro `tol`). `k` = campioni per stimare le tangenti agli estremi.
 */
/**
 * Retta ai minimi quadrati (totali) sui punti interni (a più di `trim` dagli estremi): centro,
 * direzione e scarto massimo dei punti dalla retta.
 */
export function fitLine(pts: Vec2[], trim = 0): { c: Vec2; d: Vec2; dev: number } {
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const long = len(sub(b, a)) > 3 * trim;
  const use = pts.filter((p) => !long || (len(sub(p, a)) >= trim && len(sub(p, b)) >= trim));
  const src = use.length >= 2 ? use : pts;
  let cx = 0,
    cy = 0;
  for (const p of src) {
    cx += p.x;
    cy += p.y;
  }
  cx /= src.length;
  cy /= src.length;
  let sxx = 0,
    sxy = 0,
    syy = 0;
  for (const p of src) {
    sxx += (p.x - cx) ** 2;
    sxy += (p.x - cx) * (p.y - cy);
    syy += (p.y - cy) ** 2;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const d = { x: Math.cos(ang), y: Math.sin(ang) };
  let dev = 0;
  for (const p of src) dev = Math.max(dev, Math.abs((p.x - cx) * d.y - (p.y - cy) * d.x));
  return { c: { x: cx, y: cy }, d, dev };
}

const project = (p: Vec2, c: Vec2, d: Vec2): Vec2 => {
  const t = (p.x - c.x) * d.x + (p.y - c.y) * d.y;
  return { x: c.x + d.x * t, y: c.y + d.y * t };
};

export function fitPiece(pts: Vec2[], tol: number, k: number, trim = 0): Segment[] {
  if (pts.length < 2) return [];
  const ln = fitLine(pts, trim);
  if (ln.dev <= tol || chordDeviation(pts, trim) <= tol)
    return [
      {
        kind: 'line',
        p0: project(pts[0]!, ln.c, ln.d),
        p1: project(pts[pts.length - 1]!, ln.c, ln.d),
      },
    ];
  const out: Bez[] = [];
  fitRange(pts, endTangent(pts, true, k), endTangent(pts, false, k), tol, out);
  return out.map((b) => ({ kind: 'cubic', p0: b[0], c1: b[1], c2: b[2], p1: b[3] }));
}

/** Tratto chiuso senza spigoli: due metà con tangente continua nel punto di attacco. */
export function fitLoop(pts: Vec2[], tol: number): Segment[] {
  const n = pts.length;
  const h = Math.floor(n / 2);
  const ring = [...pts, pts[0]!];
  const t0 = unit(sub(pts[1]!, pts[n - 1]!));
  const th = unit(sub(pts[h + 1]!, pts[h - 1]!));
  const out: Bez[] = [];
  fitRange(ring.slice(0, h + 1), t0, mul(th, -1), tol, out);
  fitRange(ring.slice(h), th, mul(t0, -1), tol, out);
  return out.map((b) => ({ kind: 'cubic', p0: b[0], c1: b[1], c2: b[2], p1: b[3] }));
}
