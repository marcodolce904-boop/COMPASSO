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
 * Media che conserva le curve: per ogni punto, la parabola che passa meglio tra i vicini
 * (pesati come nella media gaussiana) e il suo valore nel punto. Toglie il tremolio come la
 * media semplice, ma non "rimpicciolisce" le curve (una S resta alta quanto il disegno).
 */
export function smoothCurves(pts: Vec2[], sigma: number, closed: boolean): Vec2[] {
  const n = pts.length;
  if (sigma <= 0 || n < 5) return pts.map((p) => ({ ...p }));
  const r = Math.ceil(sigma * 2.5);
  let s0 = 0,
    s2 = 0,
    s4 = 0;
  const w: number[] = [];
  for (let k = -r; k <= r; k++) {
    const wk = Math.exp(-(k * k) / (2 * sigma * sigma));
    w.push(wk);
    s0 += wk;
    s2 += wk * k * k;
    s4 += wk * k ** 4;
  }
  const den = s0 * s4 - s2 * s2;
  const coef = w.map((wk, i) => {
    const k = i - r;
    return (wk * (s4 - s2 * k * k)) / den;
  });
  const at = (i: number): Vec2 => {
    if (closed) return pts[((i % n) + n) % n]!;
    if (i < 0) return sub(mul(pts[0]!, 2), pts[Math.min(n - 1, -i)]!);
    if (i >= n) return sub(mul(pts[n - 1]!, 2), pts[Math.max(0, 2 * (n - 1) - i)]!);
    return pts[i]!;
  };
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    let sx = 0,
      sy = 0;
    for (let k = -r; k <= r; k++) {
      const p = at(i + k);
      sx += p.x * coef[k + r]!;
      sy += p.y * coef[k + r]!;
    }
    out.push({ x: sx, y: sy });
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
  // svolta tra il tratto che arriva e quello che parte, misurata su `w` campioni
  const turnAt = (i: number, w: number): number => {
    if (!closed && (i < w || i >= n - w)) return -1;
    const a = pts[(((i - w) % n) + n) % n]!;
    const p = pts[i]!;
    const b = pts[(i + w) % n]!;
    return Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(p, a)), unit(sub(b, p))))));
  };
  // Su una finestra corta lo spigolo arrotondato dal tratto sembra più dolce del vero; su una
  // doppia si misura per intero. Se allargando la finestra la svolta non raddoppia, è
  // concentrata in un punto (spigolo) e vale la misura larga; se raddoppia, è una curva stretta.
  const turn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t1 = turnAt(i, k);
    if (t1 < 0) continue;
    const t2 = turnAt(i, 2 * k);
    turn[i] = t2 >= 0 && t2 < 1.5 * t1 ? Math.max(t1, t2) : t1;
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

/**
 * Una curva di Bézier non gira più di così: oltre, due curve sono più fedeli. Mezzo cerchio
 * (180°) si divide sempre: il cerchio ha 4 anchor, come lo disegnerebbe un designer.
 */
const MAX_TURN = (120 * Math.PI) / 180;

/** Rotazione totale della tangente lungo la curva (radianti). */
function turning(b: Bez): number {
  let total = 0;
  let prev: Vec2 | null = null;
  for (let k = 0; k <= 24; k++) {
    const d = bezD1(b, k / 24);
    if (len(d) < 1e-9) continue;
    const u = unit(d);
    if (prev) total += Math.acos(Math.max(-1, Math.min(1, dot(prev, u))));
    prev = u;
  }
  return total;
}

interface Fit {
  b: Bez;
  i0: number;
  i1: number;
}

/** Una cubica per i punti all[i0..i1] con le tangenti date (con riparametrizzazione). */
function fitOne(all: Vec2[], i0: number, i1: number, t1: Vec2, t2: Vec2, tol: number) {
  const pts = all.slice(i0, i1 + 1);
  if (pts.length === 2) {
    const d = len(sub(pts[1]!, pts[0]!)) / 3;
    const b: Bez = [pts[0]!, add(pts[0]!, mul(t1, d)), add(pts[1]!, mul(t2, d)), pts[1]!];
    return { b, err: 0, at: 0 };
  }
  let u = chordParams(pts);
  let b = generate(pts, u, t1, t2);
  let { err, at } = maxError(pts, b, u);
  if (err >= tol && err < tol * 4) {
    for (let k = 0; k < 6 && err >= tol; k++) {
      u = reparam(pts, b, u);
      b = generate(pts, u, t1, t2);
      ({ err, at } = maxError(pts, b, u));
    }
  }
  return { b, err, at };
}

function fitRange(
  all: Vec2[],
  i0: number,
  i1: number,
  t1: Vec2,
  t2: Vec2,
  tol: number,
  out: Fit[],
) {
  const r = fitOne(all, i0, i1, t1, t2, tol);
  const ok = r.err < tol && turning(r.b) <= MAX_TURN;
  if (ok || i1 - i0 < 3) {
    out.push({ b: r.b, i0, i1 });
    return;
  }
  // si divide nel punto più lontano (o a metà, se la curva è precisa ma gira troppo)
  const at = r.err < tol ? Math.round((i0 + i1) / 2) : i0 + r.at;
  const split = Math.max(i0 + 1, Math.min(i1 - 1, at));
  const tc = unit(sub(all[split - 1]!, all[split + 1]!));
  fitRange(all, i0, split, t1, tc, tol, out);
  fitRange(all, split, i1, mul(tc, -1), t2, tol, out);
}

/**
 * Meno anchor: due curve vicine (giunte senza spigolo) si sostituiscono con una sola, se la
 * precisione e la rotazione massima reggono. La divisione "nel punto peggiore" a volte divide
 * più del necessario.
 */
function mergeFits(all: Vec2[], fits: Fit[], tol: number): Fit[] {
  const out = [...fits];
  let changed = true;
  while (changed && out.length > 1) {
    changed = false;
    for (let j = 0; j + 1 < out.length; j++) {
      const A = out[j]!;
      const B = out[j + 1]!;
      const t1 = unit(sub(A.b[1], A.b[0]));
      const t2 = unit(sub(B.b[2], B.b[3]));
      const r = fitOne(all, A.i0, B.i1, t1, t2, tol);
      if (r.err < tol && turning(r.b) <= MAX_TURN) {
        out.splice(j, 2, { b: r.b, i0: A.i0, i1: B.i1 });
        changed = true;
      }
    }
  }
  return out;
}

const toSegs = (fits: Fit[]): Segment[] =>
  fits.map(({ b }) => ({ kind: 'cubic', p0: b[0], c1: b[1], c2: b[2], p1: b[3] }));

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
  const out: Fit[] = [];
  fitRange(pts, 0, pts.length - 1, endTangent(pts, true, k), endTangent(pts, false, k), tol, out);
  return toSegs(mergeFits(pts, out, tol));
}

/** Tratto chiuso senza spigoli: due metà con tangente continua nel punto di attacco. */
export function fitLoop(input: Vec2[], tol: number): Segment[] {
  // si parte dal punto più curvo (es. l'estremità dell'asse lungo di un ovale): le divisioni
  // a metà cadono così sui punti notevoli e bastano 4 anchor
  const n = input.length;
  const w = Math.max(2, Math.round(n / 24));
  let best = 0;
  let bestTurn = -1;
  for (let i = 0; i < n; i++) {
    const a = input[(i - w + n) % n]!;
    const p = input[i]!;
    const b = input[(i + w) % n]!;
    const t = Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(p, a)), unit(sub(b, p))))));
    if (t > bestTurn + 1e-9) {
      bestTurn = t;
      best = i;
    }
  }
  const pts = [...input.slice(best), ...input.slice(0, best)];
  const h = Math.floor(n / 2);
  const ring = [...pts, pts[0]!];
  const t0 = unit(sub(pts[1]!, pts[n - 1]!));
  const th = unit(sub(pts[h + 1]!, pts[h - 1]!));
  const out: Fit[] = [];
  fitRange(ring, 0, h, t0, mul(th, -1), tol, out);
  fitRange(ring, h, n, th, mul(t0, -1), tol, out);
  return toSegs(mergeFits(ring, out, tol));
}

/**
 * Una sola cubica per i punti dati, con le tangenti agli estremi date (verso l'interno):
 * minimi quadrati con riparametrizzazione. Usata dalla penna quando si toglie un punto.
 */
export function fitCubic(pts: Vec2[], t1: Vec2, t2: Vec2): [Vec2, Vec2, Vec2, Vec2] {
  return fitOne(pts, 0, pts.length - 1, unit(t1), unit(t2), 0).b;
}
