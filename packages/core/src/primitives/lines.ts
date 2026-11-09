import type { GuideLine, PathData, SegmentRef, Vec2 } from '../model';
import type { Tolerances } from '../tolerance';
import { UnionFind } from './unionFind';

export interface LineSeg {
  ref: SegmentRef;
  p0: Vec2;
  p1: Vec2;
  length: number;
  /** Angolo della direzione in [0, π), già "snappato" se entro ε_ang stretta. */
  phi: number;
  orientation: GuideLine['orientation'];
  /** Deviazione dall'angolo notevole più vicino, se tra soglia stretta e larga. */
  nearAngle?: { deviation: number; target: number };
}

export interface LineCluster {
  line: GuideLine;
  segs: LineSeg[];
}

const SNAP: [number, GuideLine['orientation']][] = [
  [0, 'h'],
  [Math.PI / 4, 'd45'],
  [Math.PI / 2, 'v'],
  [(3 * Math.PI) / 4, 'd45'],
  [Math.PI, 'h'],
];

const modPi = (a: number) => ((a % Math.PI) + Math.PI) % Math.PI;
/** Differenza tra due angoli di rette (periodo π). */
export const angleDiffPi = (a: number, b: number) => {
  const d = Math.abs(modPi(a) - modPi(b));
  return Math.min(d, Math.PI - d);
};

/** Forma normale: n = (cos θ, sin θ), n·p = ρ, con θ ∈ [0, π). */
export function normalForm(phi: number, through: Vec2): { theta: number; rho: number } {
  const theta = modPi(phi + Math.PI / 2);
  return { theta, rho: Math.cos(theta) * through.x + Math.sin(theta) * through.y };
}

export function lineSegments(
  paths: PathData[],
  tol: Tolerances,
  extra: { ref: SegmentRef; p0: Vec2; p1: Vec2 }[] = [],
): LineSeg[] {
  const raw: { ref: SegmentRef; p0: Vec2; p1: Vec2 }[] = [];
  for (const p of paths) {
    p.segments.forEach((s, index) => {
      if (s.kind === 'line') raw.push({ ref: { pathId: p.id, index }, p0: s.p0, p1: s.p1 });
    });
  }
  raw.push(...extra);
  return raw.map(({ ref, p0, p1 }) => {
    const length = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    let phi = modPi(Math.atan2(p1.y - p0.y, p1.x - p0.x));
    let orientation: GuideLine['orientation'] = 'free';
    let nearAngle: LineSeg['nearAngle'];
    let best = Infinity;
    let target = 0;
    let tOri: GuideLine['orientation'] = 'free';
    for (const [t, o] of SNAP) {
      const d = Math.abs(phi - t);
      if (d < best) {
        best = d;
        target = t;
        tOri = o;
      }
    }
    if (best <= tol.angle.strict) {
      phi = modPi(target);
      orientation = tOri;
    } else if (best <= tol.angle.wide) {
      nearAngle = { deviation: best, target: modPi(target) };
    }
    const seg: LineSeg = { ref, p0, p1, length, phi, orientation };
    if (nearAngle) seg.nearAngle = nearAngle;
    return seg;
  });
}

/**
 * §6.5: rette infinite dai segmenti dritti, raggruppate per (θ, ρ). θ dal segmento più
 * lungo del gruppo, ρ media pesata sulla lunghezza. Supporto = somma delle lunghezze.
 */
export function clusterLines(segs: LineSeg[], tol: Tolerances): LineCluster[] {
  const forms = segs.map((s) =>
    normalForm(s.phi, { x: (s.p0.x + s.p1.x) / 2, y: (s.p0.y + s.p1.y) / 2 }),
  );
  const uf = new UnionFind(segs.length);
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = forms[i]!;
      const b = forms[j]!;
      const dTheta = angleDiffPi(a.theta, b.theta);
      if (dTheta > tol.angle.strict) continue;
      // se θ avvolge (≈0 vs ≈π) la normale è opposta: ρ cambia segno
      const flip = Math.abs(a.theta - b.theta) > Math.PI / 2 ? -1 : 1;
      if (Math.abs(a.rho - flip * b.rho) <= tol.row.strict) uf.union(i, j);
    }
  }
  const clusters = uf.groups().map((g) => {
    const members = g.map((i) => segs[i]!);
    const longest = members.reduce((a, b) => (b.length > a.length ? b : a));
    const theta = normalForm(longest.phi, longest.p0).theta;
    const n = { x: Math.cos(theta), y: Math.sin(theta) };
    let support = 0;
    let rho = 0;
    for (const s of members) {
      const mid = { x: (s.p0.x + s.p1.x) / 2, y: (s.p0.y + s.p1.y) / 2 };
      rho += (n.x * mid.x + n.y * mid.y) * s.length;
      support += s.length;
    }
    const line: GuideLine = {
      id: '',
      theta,
      rho: rho / support,
      orientation: longest.orientation,
      origin: 'segment',
      support,
      score: 0,
    };
    return { line, segs: members };
  });
  return clusters;
}

/** Intersezione della retta (θ, ρ) con un rettangolo: estremi del tratto visibile. */
export function clipLine(
  theta: number,
  rho: number,
  r: { x: number; y: number; width: number; height: number },
): [Vec2, Vec2] | null {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const p0 = { x: c * rho, y: s * rho };
  const d = { x: -s, y: c };
  let t0 = -Infinity;
  let t1 = Infinity;
  const slab = (p: number, dd: number, lo: number, hi: number) => {
    if (Math.abs(dd) < 1e-12) return p >= lo && p <= hi;
    let a = (lo - p) / dd;
    let b = (hi - p) / dd;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!slab(p0.x, d.x, r.x, r.x + r.width)) return null;
  if (!slab(p0.y, d.y, r.y, r.y + r.height)) return null;
  if (!(t0 <= t1)) return null;
  return [
    { x: p0.x + d.x * t0, y: p0.y + d.y * t0 },
    { x: p0.x + d.x * t1, y: p0.y + d.y * t1 },
  ];
}
