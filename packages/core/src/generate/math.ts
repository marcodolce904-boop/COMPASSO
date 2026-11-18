// GENERA · Matematico: il logo come disegnato con riga, squadra e compasso su un modulo.
// Ogni retta prende un angolo multiplo dell'angolo base e una posizione multipla del passo; gli
// spigoli tra due rette diventano le loro intersezioni (così angoli e griglia non si contraddicono).
// I cerchi veri prendono raggio multiplo del passo e centro sulla griglia.

import type { Circle, PathData, Vec2 } from '../model';
import { dist, fromNodes, moveNode, segCount, toNodes, type GNode, type GPath } from './geometry';

export interface MathOptions {
  /** Angolo base in gradi (15, 30, 45 o 90). */
  angle: number;
  /** Modulo in pt; null = automatico (unità x del logo). */
  module: number | null;
  /** Misure a multipli di mezzo modulo (true) o del modulo intero. */
  half: boolean;
  rules: { angles: boolean; radii: boolean; positions: boolean };
}

export interface MathResult {
  paths: PathData[];
  angles: number;
  radii: number;
  positions: number;
  /** Gruppi di rette lasciati al loro angolo perché ruotarli sposterebbe troppo il logo. */
  skipped: number;
  circles: { cx: number; cy: number; r: number; steps: number }[];
}

interface Line {
  n: Vec2;
  rho: number;
}

const EPS = 1e-9;
const isLineSeg = (w: GPath, i: number) => {
  const a = w.nodes[i]!;
  const b = w.nodes[(i + 1) % w.nodes.length]!;
  return dist(a.hout, a.p) < 1e-7 && dist(b.hin, b.p) < 1e-7 && dist(a.p, b.p) > 1e-6;
};

function intersect(a: Line, b: Line): Vec2 | null {
  const det = a.n.x * b.n.y - a.n.y * b.n.x;
  if (Math.abs(det) < EPS) return null;
  return {
    x: (a.rho * b.n.y - b.rho * a.n.y) / det,
    y: (a.n.x * b.rho - b.n.x * a.rho) / det,
  };
}
const project = (p: Vec2, l: Line): Vec2 => {
  const d = l.n.x * p.x + l.n.y * p.y - l.rho;
  return { x: p.x - l.n.x * d, y: p.y - l.n.y * d };
};

/**
 * Ricompone `paths` (già normalizzati) secondo il modulo. `circles` sono i cerchi veri trovati da
 * `analyze` sugli stessi tracciati; `origin` è l'origine della griglia, `step` il passo.
 */
export function mathCompose(
  paths: PathData[],
  circles: Circle[],
  opts: MathOptions,
  origin: Vec2,
  step: number,
  D: number,
  /** Spostamento massimo ammesso a un elemento (pt): oltre, la regola su quell'elemento si salta. */
  maxShift = Infinity,
): MathResult {
  const work = paths.map(toNodes);
  const index = new Map(paths.map((p, i) => [p.id, i]));
  const snap = (v: number, o: number) => o + Math.round((v - o) / step) * step;
  let radii = 0;
  let positions = 0;
  let angles = 0;
  let skipped = 0;
  const outCircles: MathResult['circles'] = [];

  // 1. cerchi: raggio multiplo del passo, centro sulla griglia (si scala l'arco intorno al centro)
  const inCircle = new Set<string>();
  const circleNodes = new Set<GNode>();
  for (const c of circles) {
    const cx = opts.rules.positions ? snap(c.cx, origin.x) : c.cx;
    const cy = opts.rules.positions ? snap(c.cy, origin.y) : c.cy;
    const r = opts.rules.radii ? Math.max(step, Math.round(c.r / step) * step) : c.r;
    if (Math.abs(r - c.r) > 1e-9) radii++;
    outCircles.push({ cx, cy, r, steps: Math.round((2 * r) / step) / 2 });
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

  // 2. rette: angolo (gruppi di quasi parallele) e posizione
  interface Seg {
    w: number;
    i: number;
    phi: number;
    mid: Vec2;
    len: number;
  }
  const segs: Seg[] = [];
  work.forEach((w, wi) => {
    for (let i = 0; i < segCount(w); i++) {
      if (!isLineSeg(w, i) || inCircle.has(`${w.src.id}:${i}`)) continue;
      const a = w.nodes[i]!.p;
      const b = w.nodes[(i + 1) % w.nodes.length]!.p;
      let phi = Math.atan2(b.y - a.y, b.x - a.x);
      if (phi < 0) phi += Math.PI;
      if (phi >= Math.PI) phi -= Math.PI;
      segs.push({
        w: wi,
        i,
        phi,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        len: dist(a, b),
      });
    }
  });
  // gruppi per angolo (entro 3°, anche a cavallo di 0°/180°)
  const tol = (3 * Math.PI) / 180;
  const order = segs.map((_, k) => k).sort((a, b) => segs[a]!.phi - segs[b]!.phi);
  const groups: number[][] = [];
  for (const k of order) {
    const g = groups[groups.length - 1];
    if (g && segs[k]!.phi - segs[g[g.length - 1]!]!.phi <= tol) g.push(k);
    else groups.push([k]);
  }
  if (groups.length > 1) {
    const first = groups[0]!;
    const last = groups[groups.length - 1]!;
    if (segs[first[0]!]!.phi + Math.PI - segs[last[last.length - 1]!]!.phi <= tol) {
      first.push(...last);
      groups.pop();
    }
  }
  const lineOf = new Map<string, Line>();
  const base = (opts.angle * Math.PI) / 180;
  for (const g of groups) {
    // media pesata sugli angoli raddoppiati (0° e 180° sono la stessa direzione)
    let sx = 0;
    let sy = 0;
    for (const k of g) {
      sx += Math.cos(2 * segs[k]!.phi) * segs[k]!.len;
      sy += Math.sin(2 * segs[k]!.phi) * segs[k]!.len;
    }
    let mean = Math.atan2(sy, sx) / 2;
    if (mean < 0) mean += Math.PI;
    let target = opts.rules.angles ? Math.round(mean / base) * base : mean;
    // ruotare una retta lunga sposta molto le sue estremità: oltre il limite resta al suo angolo
    // (ma parallela alle gemelle)
    const shiftOf = (t: number) =>
      Math.max(...g.map((k) => (segs[k]!.len / 2) * Math.abs(Math.sin(segs[k]!.phi - t))));
    if (target !== mean && shiftOf(target) > maxShift) {
      target = mean;
      skipped++;
    }
    const n = { x: -Math.sin(target), y: Math.cos(target) };
    for (const k of g)
      if (
        Math.abs(segs[k]!.phi - target) > 1e-9 &&
        Math.abs(segs[k]!.phi - target) < Math.PI - 1e-9
      )
        angles++;
    // rette sulla stessa linea (stessa posizione entro mezzo passo) restano allineate
    const rhoOf = (k: number) => n.x * segs[k]!.mid.x + n.y * segs[k]!.mid.y;
    const byRho = [...g].sort((a, b) => rhoOf(a) - rhoOf(b));
    let run: number[] = [];
    const flush = () => {
      if (!run.length) return;
      const tot = run.reduce((s, k) => s + segs[k]!.len, 0);
      let rho = run.reduce((s, k) => s + rhoOf(k) * segs[k]!.len, 0) / tot;
      if (opts.rules.positions) {
        const o = n.x * origin.x + n.y * origin.y;
        rho = o + Math.round((rho - o) / step) * step;
      }
      for (const k of run) lineOf.set(`${segs[k]!.w}:${segs[k]!.i}`, { n, rho });
      run = [];
    };
    for (const k of byRho) {
      const prev = run[run.length - 1];
      if (prev !== undefined && rhoOf(k) - rhoOf(prev) > step / 2) flush();
      run.push(k);
    }
    flush();
  }

  // 3. anchor: intersezioni tra rette consecutive; spigoli tra curve sulla griglia
  const maxJump = 0.1 * D;
  work.forEach((w, wi) => {
    const m = w.nodes.length;
    const count = segCount(w);
    w.nodes.forEach((node, i) => {
      const prevIdx = w.closed || i > 0 ? (i - 1 + m) % m : -1;
      const prev = prevIdx >= 0 && prevIdx < count ? lineOf.get(`${wi}:${prevIdx}`) : undefined;
      const next = i < count ? lineOf.get(`${wi}:${i}`) : undefined;
      let to: Vec2 | null = null;
      if (prev && next) {
        const x = intersect(prev, next);
        to = x && dist(x, node.p) <= maxJump ? x : project(node.p, next);
      } else if (prev) to = project(node.p, prev);
      else if (next) to = project(node.p, next);
      else if (opts.rules.positions && !circleNodes.has(node)) {
        // spigolo tra due curve: sulla griglia
        const u = { x: node.p.x - node.hin.x, y: node.p.y - node.hin.y };
        const v = { x: node.hout.x - node.p.x, y: node.hout.y - node.p.y };
        const lu = Math.hypot(u.x, u.y);
        const lv = Math.hypot(v.x, v.y);
        const corner =
          lu < 1e-7 || lv < 1e-7 || (u.x * v.x + u.y * v.y) / (lu * lv) < Math.cos(Math.PI / 6);
        if (corner) to = { x: snap(node.p.x, origin.x), y: snap(node.p.y, origin.y) };
      }
      if (!to || dist(to, node.p) < 1e-9) return;
      const lineIn = !!prev;
      const lineOut = !!next;
      moveNode(node, to);
      if (lineIn) node.hin = { ...node.p };
      if (lineOut) node.hout = { ...node.p };
      positions++;
    });
  });

  return { paths: work.map(fromNodes), angles, radii, positions, skipped, circles: outCircles };
}
