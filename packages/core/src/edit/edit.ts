// Strumento penna: modifica a mano dei tracciati (punti, maniglie di Bézier, spigoli).
// Funzioni pure: ricevono i tracciati e restituiscono una copia modificata (annulla/ripeti
// diventano una semplice pila di stati).

import type { DocumentGeometry, PathData, Segment, Vec2 } from '../model';
import { fitCubic } from '../trace/fit';

/** Punto di un tracciato: anchor e maniglie (assolute; maniglia = anchor se assente). */
export interface EditNode {
  p: Vec2;
  hin: Vec2;
  hout: Vec2;
}
export interface EditPath {
  src: PathData;
  closed: boolean;
  nodes: EditNode[];
}
export interface NodeRef {
  path: number;
  node: number;
}

const cp = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });
const same = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const segCount = (p: EditPath) => (p.closed ? p.nodes.length : p.nodes.length - 1);
const clone = (paths: EditPath[]): EditPath[] =>
  paths.map((p) => ({
    src: p.src,
    closed: p.closed,
    nodes: p.nodes.map((n) => ({ p: cp(n.p), hin: cp(n.hin), hout: cp(n.hout) })),
  }));

export function toEdit(g: DocumentGeometry): EditPath[] {
  return g.paths.map((p) => {
    const segs = p.segments;
    const n = p.closed ? segs.length : segs.length + 1;
    const nodes: EditNode[] = [];
    for (let i = 0; i < n; i++) {
      const out = i < segs.length ? segs[i] : undefined;
      let inn: Segment | undefined;
      if (p.closed) inn = segs[(i - 1 + segs.length) % segs.length];
      else if (i > 0) inn = segs[i - 1];
      const pos = out ? out.p0 : inn!.p1;
      nodes.push({
        p: cp(pos),
        hin: cp(inn && inn.kind === 'cubic' ? inn.c2 : pos),
        hout: cp(out && out.kind === 'cubic' ? out.c1 : pos),
      });
    }
    return { src: p, closed: p.closed, nodes };
  });
}

export function fromEdit(paths: EditPath[], base: DocumentGeometry): DocumentGeometry {
  return {
    ...base,
    paths: paths
      .filter((p) => p.nodes.length >= 2)
      .map((p) => {
        const segments: Segment[] = [];
        const n = p.nodes.length;
        for (let i = 0; i < segCount(p); i++) {
          const a = p.nodes[i]!;
          const b = p.nodes[(i + 1) % n]!;
          segments.push(
            same(a.hout, a.p) && same(b.hin, b.p)
              ? { kind: 'line', p0: cp(a.p), p1: cp(b.p) }
              : { kind: 'cubic', p0: cp(a.p), c1: cp(a.hout), c2: cp(b.hin), p1: cp(b.p) },
          );
        }
        return { ...p.src, closed: p.closed, segments };
      }),
  };
}

/** Punto curvo: due maniglie opposte e allineate. */
export function isSmooth(n: EditNode): boolean {
  if (same(n.hin, n.p) || same(n.hout, n.p)) return false;
  const a = { x: n.hin.x - n.p.x, y: n.hin.y - n.p.y };
  const b = { x: n.hout.x - n.p.x, y: n.hout.y - n.p.y };
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  return Math.abs(a.x * b.y - a.y * b.x) / (la * lb) < 0.02 && a.x * b.x + a.y * b.y < 0;
}

/** Sposta i punti indicati (con le loro maniglie). */
export function moveNodes(paths: EditPath[], sel: NodeRef[], dx: number, dy: number): EditPath[] {
  const out = clone(paths);
  for (const r of sel) {
    const n = out[r.path]?.nodes[r.node];
    if (!n) continue;
    for (const k of ['p', 'hin', 'hout'] as const) n[k] = { x: n[k].x + dx, y: n[k].y + dy };
  }
  return out;
}

/**
 * Sposta una maniglia. In un punto curvo l'altra maniglia la segue dalla parte opposta (stessa
 * lunghezza di prima); con `independent` (Alt) si muove da sola e il punto diventa spigolo.
 */
export function moveHandle(
  paths: EditPath[],
  ref: NodeRef,
  which: 'in' | 'out',
  to: Vec2,
  independent: boolean,
): EditPath[] {
  const out = clone(paths);
  const n = out[ref.path]?.nodes[ref.node];
  if (!n) return out;
  const smooth = isSmooth(n);
  const key = which === 'in' ? 'hin' : 'hout';
  const other = which === 'in' ? 'hout' : 'hin';
  n[key] = cp(to);
  if (smooth && !independent) {
    const l = dist(n[other], n.p);
    const d = dist(to, n.p);
    if (d > 1e-9)
      n[other] = { x: n.p.x - ((to.x - n.p.x) / d) * l, y: n.p.y - ((to.y - n.p.y) / d) * l };
  }
  return out;
}

/** Aggiunge un punto sulla curva `seg` al parametro t, senza cambiarne la forma. */
export function insertNode(
  paths: EditPath[],
  path: number,
  seg: number,
  t: number,
): { paths: EditPath[]; ref: NodeRef } {
  const out = clone(paths);
  const P = out[path]!;
  const n = P.nodes.length;
  const a = P.nodes[seg]!;
  const b = P.nodes[(seg + 1) % n]!;
  let node: EditNode;
  if (same(a.hout, a.p) && same(b.hin, b.p)) {
    const s = lerp(a.p, b.p, t);
    node = { p: s, hin: cp(s), hout: cp(s) };
  } else {
    // de Casteljau: le due metà della curva sono esattamente la curva di prima
    const q0 = lerp(a.p, a.hout, t);
    const q1 = lerp(a.hout, b.hin, t);
    const q2 = lerp(b.hin, b.p, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const s = lerp(r0, r1, t);
    a.hout = q0;
    b.hin = q2;
    node = { p: s, hin: r0, hout: r1 };
  }
  P.nodes.splice(seg + 1, 0, node);
  return { paths: out, ref: { path, node: seg + 1 } };
}

function bez(a: Vec2, b: Vec2, c: Vec2, d: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/**
 * Toglie un punto: il precedente si collega al successivo. La nuova curva ricalca (minimi
 * quadrati) le due che sostituisce, con le tangenti di partenza e arrivo di prima. Un
 * tracciato con meno di 2 punti sparisce.
 */
export function removeNode(paths: EditPath[], ref: NodeRef): EditPath[] {
  const out = clone(paths);
  const P = out[ref.path];
  if (!P) return out;
  const n = P.nodes.length;
  const i = ref.node;
  const hasPrev = P.closed || i > 0;
  const hasNext = P.closed || i < n - 1;
  if (hasPrev && hasNext && n >= 3) {
    const a = P.nodes[(i - 1 + n) % n]!;
    const m = P.nodes[i]!;
    const b = P.nodes[(i + 1) % n]!;
    const straightA = same(a.hout, a.p) && same(m.hin, m.p);
    const straightB = same(m.hout, m.p) && same(b.hin, b.p);
    if (!(straightA && straightB)) {
      const pts: Vec2[] = [];
      for (let k = 0; k <= 16; k++) pts.push(bez(a.p, a.hout, m.hin, m.p, k / 16));
      for (let k = 1; k <= 16; k++) pts.push(bez(m.p, m.hout, b.hin, b.p, k / 16));
      const t1 = same(a.hout, a.p)
        ? { x: m.p.x - a.p.x, y: m.p.y - a.p.y }
        : { x: a.hout.x - a.p.x, y: a.hout.y - a.p.y };
      const t2 = same(b.hin, b.p)
        ? { x: m.p.x - b.p.x, y: m.p.y - b.p.y }
        : { x: b.hin.x - b.p.x, y: b.hin.y - b.p.y };
      const c = fitCubic(pts, t1, t2);
      a.hout = cp(c[1]);
      b.hin = cp(c[2]);
    }
  } else if (!P.closed) {
    // estremo di un tracciato aperto: la curva verso di lui sparisce con lui
    const nb = P.nodes[i === 0 ? 1 : n - 2];
    if (nb) {
      if (i === 0) nb.hin = cp(nb.p);
      else nb.hout = cp(nb.p);
    }
  }
  P.nodes.splice(i, 1);
  if (P.nodes.length < 2 || (P.closed && P.nodes.length < 2)) out.splice(ref.path, 1);
  return out;
}

/** Spigolo ↔ curva: lo spigolo prende maniglie lungo la direzione tra i vicini (1/3 della distanza). */
export function toggleCorner(paths: EditPath[], ref: NodeRef): EditPath[] {
  const out = clone(paths);
  const P = out[ref.path];
  const node = P?.nodes[ref.node];
  if (!P || !node) return out;
  if (!same(node.hin, node.p) || !same(node.hout, node.p)) {
    node.hin = cp(node.p);
    node.hout = cp(node.p);
    return out;
  }
  const n = P.nodes.length;
  const i = ref.node;
  const prev = P.closed || i > 0 ? P.nodes[(i - 1 + n) % n]!.p : null;
  const next = P.closed || i < n - 1 ? P.nodes[(i + 1) % n]!.p : null;
  const from = prev ?? node.p;
  const to = next ?? node.p;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-9) return out;
  const ux = dx / l;
  const uy = dy / l;
  if (prev) {
    const d = dist(prev, node.p) / 3;
    node.hin = { x: node.p.x - ux * d, y: node.p.y - uy * d };
  }
  if (next) {
    const d = dist(next, node.p) / 3;
    node.hout = { x: node.p.x + ux * d, y: node.p.y + uy * d };
  }
  return out;
}

/** La curva più vicina al punto (entro `max`): tracciato, curva e parametro t. */
export function nearestOnPaths(
  paths: EditPath[],
  q: Vec2,
  max: number,
): { path: number; seg: number; t: number; dist: number } | null {
  let best: { path: number; seg: number; t: number; dist: number } | null = null;
  paths.forEach((P, pi) => {
    const n = P.nodes.length;
    for (let s = 0; s < segCount(P); s++) {
      const a = P.nodes[s]!;
      const b = P.nodes[(s + 1) % n]!;
      if (same(a.hout, a.p) && same(b.hin, b.p)) {
        // retta: proiezione (il parametro è proporzionale alla distanza, come in insertNode)
        const vx = b.p.x - a.p.x;
        const vy = b.p.y - a.p.y;
        const l2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((q.x - a.p.x) * vx + (q.y - a.p.y) * vy) / l2));
        const d = dist(lerp(a.p, b.p, t), q);
        if (d <= max && (!best || d < best.dist)) best = { path: pi, seg: s, t, dist: d };
        continue;
      }
      // ricerca grossolana su 64 campioni, poi affinamento attorno al migliore
      let bt = 0;
      let bd = Infinity;
      for (let k = 0; k <= 64; k++) {
        const d = dist(bez(a.p, a.hout, b.hin, b.p, k / 64), q);
        if (d < bd) {
          bd = d;
          bt = k / 64;
        }
      }
      let lo = Math.max(0, bt - 1 / 64);
      let hi = Math.min(1, bt + 1 / 64);
      for (let it = 0; it < 30; it++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        if (dist(bez(a.p, a.hout, b.hin, b.p, m1), q) < dist(bez(a.p, a.hout, b.hin, b.p, m2), q))
          hi = m2;
        else lo = m1;
      }
      const t = (lo + hi) / 2;
      const d = dist(bez(a.p, a.hout, b.hin, b.p, t), q);
      if (d <= max && (!best || d < best.dist)) best = { path: pi, seg: s, t, dist: d };
    }
  });
  return best;
}
