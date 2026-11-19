// RICALCA · Perfeziona (docs/PERFEZIONA.md): ricalco fedele dal grigio dell'immagine, simmetria sul
// campo, poi ogni contorno diventa una catena di archi di cerchio tangenti (spigoli solo sulle punte).
import type { Segment, Vec2 } from '../model';
import { arcToCubics } from '../extract/pathParser';
import { isoContours } from './contour';
import { luminance, type Mask, type RasterImage } from './raster';

export type PerfectSymmetry = 'auto' | 'vertical' | 'horizontal' | 'none';

export interface PerfectOptions {
  /** Scarto massimo dal disegno, in frazione della diagonale dell'immagine (0,001 = 0,1%). */
  tolerance: number;
  symmetry: PerfectSymmetry;
  /** Morbidezza del bordo, 0–1: quanto si ammorbidisce il grigio prima del contorno. */
  softness: number;
}

export const PERFECT_DEFAULTS: PerfectOptions = {
  tolerance: 0.001,
  symmetry: 'auto',
  softness: 0.5,
};

export interface PerfectArc {
  cx: number;
  cy: number;
  r: number;
  /** Angolo di partenza e ampiezza con segno (radianti, y in giù). */
  a0: number;
  da: number;
}

export interface PerfectReport {
  shapes: number;
  arcs: number;
  symmetry: 'vertical' | 'horizontal' | null;
  /** Posizione dell'asse in px dell'immagine (x per verticale, y per orizzontale). */
  axis: number | null;
  /** Perché la simmetria non è stata applicata (in auto). */
  note: 'too-different' | null;
  /** Scarto massimo misurato tra archi e contorno ricalcato, in px. */
  maxDeviation: number;
  /** Cerchi degli archi più lunghi: la costruzione da mostrare (px dell'immagine). */
  circles: { cx: number; cy: number; r: number }[];
}

export interface PerfectContour {
  poly: Vec2[];
  segs: Segment[];
}

/** Soglia di accettazione della simmetria: errore quadratico relativo tra campo e riflesso. */
const SYM_MAX = 0.06;

// ---------------------------------------------------------------- campo dal grigio

function blur(f: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma < 0.3) return f;
  const r = Math.ceil(sigma * 3);
  const k: number[] = [];
  let s = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    s += v;
  }
  for (let i = 0; i < k.length; i++) k[i]! /= s;
  const tmp = new Float32Array(f.length),
    out = new Float32Array(f.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++)
        a += f[y * w + Math.min(w - 1, Math.max(0, x + i))]! * k[i + r]!;
      tmp[y * w + x] = a;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++)
        a += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]! * k[i + r]!;
      out[y * w + x] = a;
    }
  return out;
}

function percentile(a: Float32Array, q: number): number {
  const step = Math.max(1, Math.floor(a.length / 20000));
  const s: number[] = [];
  for (let i = 0; i < a.length; i += step) s.push(a[i]!);
  s.sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

/**
 * Campo dell'inchiostro: positivo dentro, negativo fuori, bordo a 0. Dal grigio, non da una maschera:
 * il bordo cade sotto il pixel anche su immagini piccole. Riconosce da solo inchiostro scuro su carta
 * chiara o tratto chiaro su fondo scuro (l'inchiostro è la parte minoritaria).
 */
export function inkField(img: RasterImage, softness: number, up = 1): Float32Array {
  const L = luminance(img);
  const w = img.width,
    h = img.height;
  const bg = percentile(L, 0.5);
  const lo = percentile(L, 0.01),
    hi = percentile(L, 0.99);
  const darkInk = bg - lo >= hi - bg;
  const ink = darkInk ? lo : hi;
  const span = Math.max(8, Math.abs(bg - ink));
  const mid = (bg + ink) / 2;
  const f = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) f[i] = (darkInk ? mid - L[i]! : L[i]! - mid) / span;
  // morbidezza: da un filo di sfumatura (taglia lo scalino dei pixel) a una sfumatura larga
  // in px dell'immagine originale (ingrandita `up` volte): mezzo pixel basta a togliere lo scalino
  const soft = Math.max(0, Math.min(1, softness));
  const sigma = up * (0.3 + 0.8 * soft) * Math.max(1, Math.max(w, h) / up / 1200);
  return blur(f, w, h, sigma);
}

// ---------------------------------------------------------------- simmetria

/** Errore relativo tra il campo e il suo riflesso rispetto a un asse (2·c = posizione raddoppiata). */
function mirrorError(
  f: Float32Array,
  w: number,
  h: number,
  vertical: boolean,
  c2: number,
  stride: number,
) {
  let e = 0,
    n = 0;
  const L = vertical ? w : h;
  for (let j = 0; j < (vertical ? h : w); j += stride)
    for (let i = 0; i < L; i += stride) {
      const m = c2 - i;
      const a = vertical ? f[j * w + i]! : f[i * w + j]!;
      let b = -0.5;
      if (m >= 0 && m <= L - 1) {
        const m0 = Math.floor(m),
          t = m - m0,
          m1 = Math.min(L - 1, m0 + 1);
        b = vertical
          ? f[j * w + m0]! * (1 - t) + f[j * w + m1]! * t
          : f[m0 * w + j]! * (1 - t) + f[m1 * w + j]! * t;
      }
      // conta solo dove c'è inchiostro da una delle due parti
      if (a > -0.4 || b > -0.4) {
        e += (Math.min(a, 0.5) - Math.min(b, 0.5)) ** 2;
        n++;
      }
    }
  return n ? e / n : Infinity;
}

function bestAxis(f: Float32Array, w: number, h: number, vertical: boolean) {
  const L = vertical ? w : h;
  // ricerca grossolana a passi di 2 px su campioni radi, poi rifinitura a mezzo pixel
  let best = { c2: L, e: Infinity };
  for (let c2 = Math.round(L * 0.5); c2 <= Math.round(L * 1.5); c2 += 4) {
    const e = mirrorError(f, w, h, vertical, c2, 3);
    if (e < best.e) best = { c2, e };
  }
  for (let c2 = best.c2 - 4; c2 <= best.c2 + 4; c2++) {
    const e = mirrorError(f, w, h, vertical, c2, 1);
    if (c2 === best.c2 - 4 || e < best.e) best = { c2, e };
  }
  return { axis: best.c2 / 2, e: best.e };
}

/** Media del campo con il suo riflesso: le due metà diventano identiche. */
function mirrorAverage(f: Float32Array, w: number, h: number, vertical: boolean, axis: number) {
  const out = new Float32Array(f.length);
  const L = vertical ? w : h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = vertical ? x : y;
      const m = 2 * axis - i;
      let b = -0.5;
      if (m >= 0 && m <= L - 1) {
        const m0 = Math.floor(m),
          t = m - m0,
          m1 = Math.min(L - 1, m0 + 1);
        b = vertical
          ? f[y * w + m0]! * (1 - t) + f[y * w + m1]! * t
          : f[m0 * w + x]! * (1 - t) + f[m1 * w + x]! * t;
      }
      out[y * w + x] = (f[y * w + x]! + b) / 2;
    }
  return out;
}

// ---------------------------------------------------------------- archi tangenti

type P = [number, number];
interface Arc {
  c: P;
  r: number;
  p: P;
  q: P;
  a0: number;
  da: number;
  sweep: 0 | 1;
}

function arcFrom(p: P, t: P, q: P): Arc | null {
  const n = [-t[1], t[0]],
    w = [q[0] - p[0], q[1] - p[1]];
  const den = 2 * (n[0]! * w[0]! + n[1]! * w[1]!);
  const cross = t[0] * w[1]! - t[1] * w[0]!;
  if (Math.abs(den) < 1e-9) return null; // tratto dritto: lo gestisce chi chiama
  const s = (w[0]! ** 2 + w[1]! ** 2) / den;
  const c: P = [p[0] + n[0]! * s, p[1] + n[1]! * s];
  const r = Math.abs(s);
  const sweep: 0 | 1 = cross > 0 ? 1 : 0;
  const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]),
    a1 = Math.atan2(q[1] - c[1], q[0] - c[0]);
  let da = a1 - a0;
  if (sweep) while (da < 0) da += 2 * Math.PI;
  else while (da > 0) da -= 2 * Math.PI;
  return { c, r, p, q, a0, da, sweep };
}

function biarc(p0: P, t0: P, p1: P, t1: P): [Arc, Arc] | null {
  const v = [p1[0] - p0[0], p1[1] - p0[1]],
    t = [t0[0] + t1[0], t0[1] + t1[1]];
  const cc = v[0]! ** 2 + v[1]! ** 2,
    b = 2 * (v[0]! * t[0]! + v[1]! * t[1]!);
  const a = 2 * (1 - (t0[0] * t1[0] + t0[1] * t1[1]));
  const d = Math.abs(a) < 1e-9 ? cc / b : (-b + Math.sqrt(b * b + 4 * a * cc)) / (2 * a);
  if (!(d > 0) || !Number.isFinite(d)) return null;
  const m: P = [
    (p0[0] + d * t0[0] + p1[0] - d * t1[0]) / 2,
    (p0[1] + d * t0[1] + p1[1] - d * t1[1]) / 2,
  ];
  const A = arcFrom(p0, t0, m);
  if (!A) return null;
  const ang = A.a0 + A.da,
    s = A.da > 0 ? 1 : -1;
  const B = arcFrom(m, [-Math.sin(ang) * s, Math.cos(ang) * s], p1);
  return B ? [A, B] : null;
}

function distToArc(s: Arc, q: P): number {
  let a = Math.atan2(q[1] - s.c[1], q[0] - s.c[0]) - s.a0;
  const d = Math.abs(Math.hypot(q[0] - s.c[0], q[1] - s.c[1]) - s.r);
  if (s.da > 0) {
    while (a < 0) a += 2 * Math.PI;
    if (a <= s.da) return d;
  } else {
    while (a > 0) a -= 2 * Math.PI;
    if (a >= s.da) return d;
  }
  return Math.min(
    Math.hypot(q[0] - s.p[0], q[1] - s.p[1]),
    Math.hypot(q[0] - s.q[0], q[1] - s.q[1]),
  );
}

function resample(r: Vec2[], step: number): P[] {
  const out: P[] = [[r[0]!.x, r[0]!.y]];
  let acc = 0;
  for (let i = 1; i < r.length; i++) {
    const p = r[i]!,
      q = r[i - 1]!;
    acc += Math.hypot(p.x - q.x, p.y - q.y);
    if (acc >= step) {
      out.push([p.x, p.y]);
      acc = 0;
    }
  }
  return out;
}

/**
 * Contorno → catena di archi tangenti entro `tol` px; spigoli dove la direzione gira oltre `cornerDeg`.
 * Chiuso (anello) o aperto (mezzo contorno da riflettere): per l'aperto si possono imporre le tangenti
 * agli estremi (perpendicolari all'asse di simmetria).
 */
export function arcChain(
  ring: Vec2[],
  tol: number,
  cornerDeg: number,
  open?: { tStart: P | null; tEnd: P | null },
): { arcs: Arc[]; dev: number } {
  const step = Math.max(0.75, tol / 2);
  const R = resample(ring, step);
  if (open) {
    const last = ring[ring.length - 1]!;
    const q = R[R.length - 1]!;
    if (Math.hypot(q[0] - last.x, q[1] - last.y) > 1e-6) R.push([last.x, last.y]);
  }
  const n = R.length;
  if (n < (open ? 3 : 6)) return { arcs: [], dev: 0 };
  const k = Math.max(3, Math.round((2.5 * tol) / step));
  const at = (i: number) => (open ? R[Math.max(0, Math.min(n - 1, i))]! : R[((i % n) + n) % n]!);
  const dir = (i: number, j: number): P => {
    const a = at(i),
      b = at(j),
      l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const turn = (i: number) => {
    const u = dir(i - k, i),
      w = dir(i, i + k);
    return Math.acos(Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1])));
  };
  const lim = (cornerDeg * Math.PI) / 180;
  const T = R.map((_, i) => (open && (i < k || i > n - 1 - k) ? 0 : turn(i)));
  const corner = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (T[i]! < lim) continue;
    let top = true;
    for (let j = -k; j <= k && top; j++) {
      const q = open ? i + j : (((i + j) % n) + n) % n;
      if (q >= 0 && q < n && T[q]! > T[i]!) top = false;
    }
    if (top) corner.add(i);
  }
  const m = Math.max(2, Math.round((3 * tol) / step));
  // levigatura lungo il contorno (lontano dagli spigoli e dagli estremi): toglie l'increspatura
  const fixed = new Uint8Array(n);
  for (const c of corner) for (let j = -k; j <= k; j++) fixed[(((c + j) % n) + n) % n] = 1;
  if (open) {
    fixed[0] = 1;
    fixed[n - 1] = 1;
  }
  for (let pass = 0; pass < 3; pass++) {
    const src = R.map((p) => [p[0], p[1]] as P);
    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      let sx = 0,
        sy = 0,
        sw = 0;
      for (let j = -m; j <= m; j++) {
        const qi = open ? Math.max(0, Math.min(n - 1, i + j)) : (((i + j) % n) + n) % n;
        const q = src[qi]!,
          wgt = m + 1 - Math.abs(j);
        sx += q[0] * wgt;
        sy += q[1] * wgt;
        sw += wgt;
      }
      R[i] = [sx / sw, sy / sw];
    }
  }
  const tin = (i: number): P => {
    if (open && i === n - 1 && open.tEnd) return open.tEnd;
    return corner.has(i) || (open && i === n - 1) ? dir(i - k, i) : dir(i - m, i + m);
  };
  const tout = (i: number): P => {
    if (open && i === 0 && open.tStart) return open.tStart;
    return corner.has(i) || (open && i === 0) ? dir(i, i + k) : dir(i - m, i + m);
  };
  const start = open ? 0 : corner.size ? Math.min(...corner) : 0;
  const N = open ? n - 1 : n;
  const idx = Array.from({ length: N + 1 }, (_, j) => (start + j) % n);
  const arcs: Arc[] = [];
  let dev = 0;
  let a = 0;
  while (a < N) {
    let best: [Arc, Arc] | null = null,
      bj = a + 1,
      bdev = 0;
    for (let j = a + 1; j <= N; j++) {
      const i0 = idx[a]!,
        i1 = idx[j]!;
      const pair = biarc(R[i0]!, tout(i0), R[i1]!, tin(i1));
      if (!pair) {
        if (j === a + 1) continue;
        break;
      }
      let worst = 0;
      for (let q = a + 1; q < j && worst <= tol; q++) {
        const pt = R[idx[q]!]!;
        worst = Math.max(worst, Math.min(distToArc(pair[0], pt), distToArc(pair[1], pt)));
      }
      if (worst > tol) break;
      best = pair;
      bj = j;
      bdev = worst;
      if (corner.has(i1)) break;
    }
    if (!best) {
      const i0 = idx[a]!,
        i1 = idx[a + 1]!;
      const p = R[i0]!,
        q = R[i1]!;
      const s = arcFrom(p, dir(i0, i1), q) ?? {
        c: p,
        r: 1e6,
        p,
        q,
        a0: 0,
        da: 0,
        sweep: 1 as const,
      };
      arcs.push(s);
      a += 1;
      continue;
    }
    for (const s of best) {
      const prev = arcs[arcs.length - 1];
      if (
        prev &&
        prev.sweep === s.sweep &&
        Math.hypot(prev.c[0] - s.c[0], prev.c[1] - s.c[1]) <= tol &&
        Math.abs(prev.r - s.r) <= tol
      )
        arcs[arcs.length - 1] = { ...prev, q: s.q, da: prev.da + s.da };
      else arcs.push(s);
    }
    dev = Math.max(dev, bdev);
    a = bj;
  }
  return { arcs, dev };
}

/** Riflesso di una catena di archi rispetto a un asse verticale x = ax (verso invertito). */
function mirrorArcs(arcs: Arc[], ax: number): Arc[] {
  const mp = (p: P): P => [2 * ax - p[0], p[1]];
  return arcs
    .slice()
    .reverse()
    .map((s) => {
      const c = mp(s.c),
        p = mp(s.q),
        q = mp(s.p);
      const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
      return { c, r: s.r, p, q, a0, da: s.da, sweep: s.sweep };
    });
}

function toSegments(arcs: Arc[]): Segment[] {
  const out: Segment[] = [];
  for (const s of arcs) {
    const p0 = { x: s.p[0], y: s.p[1] },
      p1 = { x: s.q[0], y: s.q[1] };
    if (s.r > 1e5 || Math.abs(s.da) < 1e-6) {
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 1e-9) out.push({ kind: 'line', p0, p1 });
      continue;
    }
    // un arco che torna al punto di partenza (cerchio intero) si scrive in più pezzi
    const parts = Math.max(1, Math.ceil(Math.abs(s.da) / (Math.PI * 0.9)));
    let prev = p0;
    for (let k = 1; k <= parts; k++) {
      const a = s.a0 + (s.da * k) / parts;
      const q = k === parts ? p1 : { x: s.c[0] + s.r * Math.cos(a), y: s.c[1] + s.r * Math.sin(a) };
      out.push(...arcToCubics(prev, s.r, s.r, 0, false, s.sweep === 1, q));
      prev = q;
    }
  }
  return out;
}

// ---------------------------------------------------------------- insieme

export function perfectTrace(
  img: RasterImage,
  opts: PerfectOptions,
  minArea: number,
  cornerDeg: number,
  up = 1,
): { contours: PerfectContour[]; report: PerfectReport; mask: Mask } {
  const w = img.width,
    h = img.height;
  let f = inkField(img, opts.softness, up);
  let symmetry: PerfectReport['symmetry'] = null,
    axis: number | null = null;
  let note: PerfectReport['note'] = null;
  if (opts.symmetry !== 'none') {
    const cands = (opts.symmetry === 'auto' ? [true, false] : [opts.symmetry === 'vertical']).map(
      (v) => ({
        v,
        ...bestAxis(f, w, h, v),
      }),
    );
    const best = cands.reduce((a, b) => (b.e < a.e ? b : a));
    // in auto si accetta solo se le due metà sono già vicine; forzata si applica sempre
    if (opts.symmetry !== 'auto' || best.e <= SYM_MAX) {
      f = mirrorAverage(f, w, h, best.v, best.axis);
      symmetry = best.v ? 'vertical' : 'horizontal';
      axis = best.axis;
    } else note = 'too-different';
  }
  const D = Math.hypot(w, h);
  const tol = Math.max(0.35, opts.tolerance * D);
  const area = (r: Vec2[]) => {
    let a = 0;
    for (let i = 0; i < r.length; i++) {
      const p = r[i]!,
        q = r[(i + 1) % r.length]!;
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  };
  const rings = isoContours(f, w, h, 0).filter((r) => Math.abs(area(r)) >= Math.max(4, minArea));
  const contours: PerfectContour[] = [];
  let arcsN = 0,
    dev = 0;
  const circles: PerfectReport['circles'] = [];
  // con la simmetria si lavora nel riferimento dell'asse (verticale, x = ax): si adatta la metà
  // sinistra e si riflette, così le due metà escono identiche per costruzione
  const V = symmetry !== 'horizontal';
  const toF = (p: Vec2): Vec2 => (V ? p : { x: p.y, y: p.x });
  const fromArc = (s: Arc): Arc => {
    if (V) return s;
    const sw = (q: P): P => [q[1], q[0]];
    const c = sw(s.c),
      p = sw(s.p),
      q = sw(s.q);
    return {
      c,
      r: s.r,
      p,
      q,
      a0: Math.atan2(p[1] - c[1], p[0] - c[0]),
      da: -s.da,
      sweep: s.sweep ? 0 : 1,
    };
  };
  const ax = axis ?? 0;
  const eps = 0.5;
  const add = (arcs: Arc[], poly: Vec2[], d: number) => {
    if (!arcs.length) return;
    const out = arcs.map(fromArc);
    const segs = toSegments(out);
    if (!segs.length) return;
    arcsN += out.length;
    dev = Math.max(dev, d);
    for (const s of out)
      if (s.r < D && Math.abs(s.da) * s.r > Math.max(6, 0.012 * D))
        circles.push({ cx: s.c[0], cy: s.c[1], r: s.r });
    contours.push({ poly: poly.map(toF), segs });
  };
  for (const raw of rings) {
    const ring = raw.map(toF);
    if (symmetry === null) {
      const { arcs, dev: d } = arcChain(ring, tol, cornerDeg);
      add(arcs, ring, d);
      continue;
    }
    let minx = Infinity,
      maxx = -Infinity;
    for (const p of ring) {
      minx = Math.min(minx, p.x);
      maxx = Math.max(maxx, p.x);
    }
    const mirP = (p: Vec2): Vec2 => ({ x: 2 * ax - p.x, y: p.y });
    if (minx >= ax - eps) continue; // metà destra: nasce dal riflesso della sinistra
    if (maxx <= ax + eps) {
      const { arcs, dev: d } = arcChain(ring, tol, cornerDeg);
      add(arcs, ring, d);
      add(mirrorArcs(arcs, ax), ring.map(mirP).reverse(), d);
      continue;
    }
    // a cavallo dell'asse: si taglia sull'asse
    const n = ring.length;
    const cross: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = ring[i]!,
        q = ring[(i + 1) % n]!;
      if ((p.x - ax) * (q.x - ax) < 0 || (p.x === ax && q.x !== ax)) cross.push(i);
    }
    if (cross.length !== 2) {
      const { arcs, dev: d } = arcChain(ring, tol, cornerDeg);
      add(arcs, ring, d);
      continue;
    }
    const cut = (i: number): Vec2 => {
      const p = ring[i]!,
        q = ring[(i + 1) % n]!;
      const t = q.x === p.x ? 0 : (ax - p.x) / (q.x - p.x);
      return { x: ax, y: p.y + (q.y - p.y) * t };
    };
    // entrata nella metà sinistra (da x > ax a x < ax) e uscita
    const enters = (i: number) => ring[(i + 1) % n]!.x < ax;
    const iA = enters(cross[0]!) ? cross[0]! : cross[1]!;
    const iB = iA === cross[0]! ? cross[1]! : cross[0]!;
    const half: Vec2[] = [cut(iA)];
    for (let i = (iA + 1) % n; ; i = (i + 1) % n) {
      half.push(ring[i]!);
      if (i === iB) break;
    }
    half.push(cut(iB));
    // tangente all'asse: liscia se il contorno lo attraversa quasi di traverso, altrimenti punta
    const lim = (cornerDeg * Math.PI) / 360;
    const endT = (a: Vec2, b: Vec2): P | null => {
      const d = [b.x - a.x, b.y - a.y],
        l = Math.hypot(d[0]!, d[1]!) || 1;
      const ang = Math.acos(Math.min(1, Math.abs(d[0]!) / l));
      return ang < lim ? [Math.sign(d[0]!) || -1, 0] : null;
    };
    const w = Math.min(6, half.length - 1);
    const { arcs, dev: d } = arcChain(half, tol, cornerDeg, {
      tStart: endT(half[0]!, half[w]!),
      tEnd: endT(half[half.length - 1 - w]!, half[half.length - 1]!),
    });
    const whole = [...arcs, ...mirrorArcs(arcs, ax)];
    add(whole, [...half, ...half.slice(1, -1).map(mirP).reverse()], d);
  }
  // cerchi quasi uguali contano una volta sola
  const uniq: PerfectReport['circles'] = [];
  for (const c of circles.sort((a, b) => b.r - a.r))
    if (
      !uniq.some(
        (u) =>
          Math.hypot(u.cx - c.cx, u.cy - c.cy) < Math.max(3, 0.1 * c.r) &&
          Math.abs(u.r - c.r) < Math.max(3, 0.1 * c.r),
      )
    )
      uniq.push(c);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) data[i] = f[i]! > 0 ? 1 : 0;
  return {
    contours,
    report: {
      shapes: contours.length,
      arcs: arcsN,
      symmetry,
      axis,
      note,
      maxDeviation: dev,
      circles: uniq,
    },
    mask: { width: w, height: h, data },
  };
}
