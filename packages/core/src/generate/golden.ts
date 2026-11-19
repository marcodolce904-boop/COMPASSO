// GENERA · Sezione aurea (docs/GENERA.md §7c): raggi in serie R/φᵏ, centri e rette orizzontali e
// verticali sulla griglia aurea del riquadro, spessori in rapporto φ, riquadro aureo (facoltativo).

import type { Circle, PathData, Vec2 } from '../model';
import { dist, fromNodes, moveNode, segCount, toNodes, type GNode } from './geometry';

export type GoldenRatio = 'phi' | 'sqrt2' | '3:2' | '1:1';

export interface GoldenOptions {
  ratio: GoldenRatio;
  /** Mezzo passo (q^½ tra un gradino e l'altro): cambia meno il logo. */
  half: boolean;
  rules: { radii: boolean; grid: boolean; thickness: boolean; box: boolean };
  /** Spirale aurea nell'anteprima. */
  spiral: boolean;
}

export interface GoldenResult {
  paths: PathData[];
  radii: number;
  positions: number;
  thickness: number;
  boxed: boolean;
  circles: { cx: number; cy: number; r: number; label: string }[];
  /** Linee della griglia aurea (anteprima). */
  lines: { x1: number; y1: number; x2: number; y2: number }[];
}

export const RATIO: Record<GoldenRatio, number> = {
  phi: (1 + Math.sqrt(5)) / 2,
  sqrt2: Math.SQRT2,
  '3:2': 1.5,
  '1:1': 1,
};
const SYMBOL: Record<GoldenRatio, string> = { phi: 'φ', sqrt2: '√2', '3:2': '1,5', '1:1': '1' };
const SUP = ['', '', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/** Etichetta del gradino: «R», «R/φ», «R/φ²», «R/φ^1.5». */
function stepLabel(k: number, ratio: GoldenRatio): string {
  if (k === 0 || ratio === '1:1') return 'R';
  const s = SYMBOL[ratio];
  if (Number.isInteger(k)) return k === 1 ? `R/${s}` : `R/${s}${SUP[k] ?? `^${k}`}`;
  return `R/${s}^${String(k).replace('.', ',')}`;
}

/** Frazioni della griglia sul lato (0 e 1 compresi). */
export function gridFractions(q: number): number[] {
  // 0 e 1 (bordi) e la mezzeria (asse dei loghi centrati), poi le divisioni del rapporto
  const out: number[] = [0, 0.5, 1];
  if (q <= 1 + 1e-9) out.push(0.25, 0.5, 0.75);
  else
    for (let k = 1; k <= 3; k++) {
      out.push(1 / q ** k, 1 - 1 / q ** k);
    }
  const uniq: number[] = [];
  for (const f of out.sort((a, b) => a - b))
    if (f >= -1e-9 && f <= 1 + 1e-9 && !uniq.some((u) => Math.abs(u - f) < 1e-3)) uniq.push(f);
  return uniq;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const nearest = (v: number, list: number[]) => {
  let best = v;
  let bd = Infinity;
  for (const t of list) {
    const d = Math.abs(t - v);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return { value: best, d: bd };
};

/**
 * Ricompone `paths` (normalizzati). `circles` = cerchi veri sugli stessi tracciati; `maxShift` =
 * spostamento massimo ammesso a un elemento (oltre, quell'elemento resta com'è).
 */
export function goldenCompose(
  paths: PathData[],
  circles: Circle[],
  opts: GoldenOptions,
  box: Box,
  maxShift: number,
): GoldenResult {
  const q = RATIO[opts.ratio];
  const work = paths.map(toNodes);
  const index = new Map(paths.map((p, i) => [p.id, i]));
  const fr = gridFractions(q);
  const xs = fr.map((f) => box.x + f * box.width);
  const ys = fr.map((f) => box.y + f * box.height);
  const snapTol = Math.min(0.03 * Math.max(box.width, box.height), maxShift);
  let radii = 0;
  let positions = 0;
  let thickness = 0;
  let boxed = false;
  const outCircles: GoldenResult['circles'] = [];
  const lines: GoldenResult['lines'] = [
    ...xs.map((x) => ({ x1: x, y1: box.y, x2: x, y2: box.y + box.height })),
    ...ys.map((y) => ({ x1: box.x, y1: y, x2: box.x + box.width, y2: y })),
  ];

  // 1. cerchi: raggio nella serie del più grande, centro sulla griglia aurea. Solo i cerchi interi
  //    (un tracciato chiuso fatto tutto dello stesso cerchio): cambiare il raggio di un pezzo d'arco
  //    dentro un contorno lo staccherebbe dalle curve vicine.
  circles = circles.filter((c) => {
    const ids = new Set(c.refs.map((r) => r.pathId));
    if (ids.size !== 1) return false;
    const p = paths[index.get([...ids][0]!) ?? -1];
    return !!p && p.closed && c.refs.length === p.segments.length;
  });
  const R = Math.max(0, ...circles.map((c) => c.r));
  const inCircle = new Set<string>();
  const circleNodes = new Set<GNode>();
  for (const c of circles) {
    let r = c.r;
    let k = 0;
    if (opts.rules.radii && R > 0) {
      if (q <= 1 + 1e-9) r = R;
      else {
        const e = Math.log(R / c.r) / Math.log(q);
        k = opts.half ? Math.round(e * 2) / 2 : Math.round(e);
        r = R / q ** k;
      }
      if (Math.abs(r - c.r) > maxShift) {
        r = c.r;
        k = NaN;
      }
    }
    let cx = c.cx;
    let cy = c.cy;
    if (opts.rules.grid) {
      const nx = nearest(c.cx, xs);
      const ny = nearest(c.cy, ys);
      if (nx.d <= snapTol) cx = nx.value;
      if (ny.d <= snapTol) cy = ny.value;
    }
    if (Math.abs(r - c.r) > 1e-9) radii++;
    if (Math.abs(cx - c.cx) > 1e-9 || Math.abs(cy - c.cy) > 1e-9) positions++;
    outCircles.push({
      cx,
      cy,
      r,
      label: Number.isNaN(k) ? '' : stepLabel(Math.round(k * 2) / 2, opts.ratio),
    });
    const map = (p: Vec2): Vec2 => ({
      x: cx + ((p.x - c.cx) * r) / c.r,
      y: cy + ((p.y - c.cy) * r) / c.r,
    });
    const touched = new Set<GNode>();
    for (const ref of c.refs) {
      const w = work[index.get(ref.pathId) ?? -1];
      if (!w) continue;
      inCircle.add(`${ref.pathId}:${ref.index}`);
      for (const n of [w.nodes[ref.index]!, w.nodes[(ref.index + 1) % w.nodes.length]!]) {
        if (touched.has(n)) continue;
        touched.add(n);
        circleNodes.add(n);
        n.p = map(n.p);
        n.hin = map(n.hin);
        n.hout = map(n.hout);
      }
    }
  }

  // 2. rette orizzontali e verticali: posizione sulla griglia aurea (se vicina)
  type Orient = 'h' | 'v';
  interface Seg {
    w: number;
    i: number;
    o: Orient;
    pos: number;
    lo: number;
    hi: number;
  }
  const segs: Seg[] = [];
  const lim = (1 * Math.PI) / 180;
  work.forEach((w, wi) => {
    for (let i = 0; i < segCount(w); i++) {
      const a = w.nodes[i]!;
      const b = w.nodes[(i + 1) % w.nodes.length]!;
      if (dist(a.hout, a.p) > 1e-7 || dist(b.hin, b.p) > 1e-7) continue;
      if (inCircle.has(`${w.src.id}:${i}`)) continue;
      const dx = b.p.x - a.p.x;
      const dy = b.p.y - a.p.y;
      if (Math.hypot(dx, dy) < 1e-6) continue;
      const ang = Math.atan2(Math.abs(dy), Math.abs(dx));
      if (ang <= lim)
        segs.push({
          w: wi,
          i,
          o: 'h',
          pos: (a.p.y + b.p.y) / 2,
          lo: Math.min(a.p.x, b.p.x),
          hi: Math.max(a.p.x, b.p.x),
        });
      else if (Math.PI / 2 - ang <= lim)
        segs.push({
          w: wi,
          i,
          o: 'v',
          pos: (a.p.x + b.p.x) / 2,
          lo: Math.min(a.p.y, b.p.y),
          hi: Math.max(a.p.y, b.p.y),
        });
    }
  });
  const target = new Map<Seg, number>();
  for (const s of segs) {
    let v = s.pos;
    if (opts.rules.grid) {
      const n = nearest(s.pos, s.o === 'v' ? xs : ys);
      if (n.d <= snapTol) v = n.value;
    }
    target.set(s, v);
  }

  // 3. spessori: tratti (due rette parallele della stessa forma che si fronteggiano)
  if (opts.rules.thickness && q > 1 + 1e-9) {
    interface Stroke {
      a: Seg;
      b: Seg;
      width: number;
    }
    const strokes: Stroke[] = [];
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]!;
        const b = segs[j]!;
        if (a.w !== b.w || a.o !== b.o) continue;
        const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
        if (overlap < 0.5 * Math.min(a.hi - a.lo, b.hi - b.lo)) continue;
        const width = Math.abs(target.get(a)! - target.get(b)!);
        if (width < 1e-6 || width > 0.4 * Math.max(box.width, box.height)) continue;
        strokes.push({ a, b, width });
      }
    // ogni retta in un solo tratto (il più stretto)
    strokes.sort((x, y) => x.width - y.width);
    const used = new Set<Seg>();
    const chosen = strokes.filter((s) => {
      if (used.has(s.a) || used.has(s.b)) return false;
      used.add(s.a);
      used.add(s.b);
      return true;
    });
    const widths = [...new Set(chosen.map((s) => Math.round(s.width * 100) / 100))].sort(
      (a, b) => b - a,
    );
    for (const thick of widths) {
      for (const s of chosen) {
        const ratio = thick / s.width;
        if (ratio < q * 0.9 || ratio > q * 1.11 || Math.abs(ratio - q) < 1e-6) continue;
        const want = thick / q;
        const ta = target.get(s.a)!;
        const tb = target.get(s.b)!;
        const mid = (ta + tb) / 2;
        const sign = ta < tb ? -1 : 1;
        const na = mid + (sign * want) / 2;
        const nb = mid - (sign * want) / 2;
        if (Math.abs(na - ta) > maxShift || Math.abs(nb - tb) > maxShift) continue;
        target.set(s.a, na);
        target.set(s.b, nb);
        s.width = want;
        thickness++;
      }
    }
  }

  // anchor: x dalle verticali, y dalle orizzontali che vi arrivano
  const segOf = new Map<string, Seg>();
  for (const s of segs) segOf.set(`${s.w}:${s.i}`, s);
  work.forEach((w, wi) => {
    const m = w.nodes.length;
    const count = segCount(w);
    w.nodes.forEach((node, i) => {
      const prevIdx = w.closed || i > 0 ? (i - 1 + m) % m : -1;
      const prev = prevIdx >= 0 && prevIdx < count ? segOf.get(`${wi}:${prevIdx}`) : undefined;
      const next = i < count ? segOf.get(`${wi}:${i}`) : undefined;
      let x = node.p.x;
      let y = node.p.y;
      for (const s of [prev, next]) {
        if (!s) continue;
        const v = target.get(s)!;
        if (s.o === 'v') x = v;
        else y = v;
      }
      if (Math.abs(x - node.p.x) < 1e-9 && Math.abs(y - node.p.y) < 1e-9) return;
      moveNode(node, { x, y });
      if (prev) node.hin = { ...node.p };
      if (next) node.hout = { ...node.p };
      if (!circleNodes.has(node)) positions++;
    });
  });

  // 4. riquadro aureo (facoltativo): un solo asse, se il rapporto è già vicino a q
  if (opts.rules.box && q > 1 + 1e-9 && box.width > 0 && box.height > 0) {
    const a = box.width / box.height;
    const wide = a >= 1;
    const cur = wide ? a : 1 / a;
    if (Math.abs(cur / q - 1) <= 0.12 && Math.abs(cur - q) > 1e-6) {
      const k = q / cur; // si allunga il lato lungo
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const f = (p: Vec2): Vec2 =>
        wide ? { x: cx + (p.x - cx) * k, y: p.y } : { x: p.x, y: cy + (p.y - cy) * k };
      const shift = ((wide ? box.width : box.height) * Math.abs(k - 1)) / 2;
      if (shift <= maxShift) {
        for (const w of work)
          for (const n of w.nodes) {
            n.p = f(n.p);
            n.hin = f(n.hin);
            n.hout = f(n.hout);
          }
        boxed = true;
      }
    }
  }

  return {
    paths: work.map(fromNodes),
    radii,
    positions,
    thickness,
    boxed,
    circles: outCircles.filter((c) => c.label !== ''),
    lines,
  };
}

/** Spirale aurea (quarti di cerchio in quadrati successivi) dentro il rettangolo aureo inscritto. */
export function goldenSpiral(box: Box, turns = 9): Vec2[] {
  const q = RATIO.phi;
  // rettangolo aureo centrato nel riquadro
  let w = box.width;
  let h = box.height;
  if (w >= h) w = Math.min(w, h * q);
  else h = Math.min(h, w * q);
  if (w >= h) h = Math.min(h, w / q);
  else w = Math.min(w, h / q);
  let x = box.x + (box.width - w) / 2;
  let y = box.y + (box.height - h) / 2;
  const out: Vec2[] = [];
  const arc = (c: Vec2, from: Vec2, to: Vec2) => {
    const r = dist(c, from);
    const a0 = Math.atan2(from.y - c.y, from.x - c.x);
    let a1 = Math.atan2(to.y - c.y, to.x - c.x);
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    for (let k = 0; k <= 12; k++) {
      const a = a0 + ((a1 - a0) * k) / 12;
      out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
    }
  };
  let dir = w >= h ? 0 : 1;
  for (let t = 0; t < turns && w > 1e-6 && h > 1e-6; t++) {
    if (dir === 0) {
      const s = h;
      arc({ x: x + s, y: y + s }, { x, y: y + s }, { x: x + s, y });
      x += s;
      w -= s;
    } else if (dir === 1) {
      const s = w;
      arc({ x, y: y + s }, { x, y }, { x: x + s, y: y + s });
      y += s;
      h -= s;
    } else if (dir === 2) {
      const s = h;
      arc({ x: x + w - s, y }, { x: x + w, y }, { x: x + w - s, y: y + s });
      w -= s;
    } else {
      const s = w;
      arc({ x: x + s, y: y + h - s }, { x: x + s, y: y + h }, { x, y: y + h - s });
      h -= s;
    }
    dir = (dir + 1) % 4;
  }
  return out;
}
