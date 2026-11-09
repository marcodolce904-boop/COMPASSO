import type { Axis, PathData, Vec2 } from '../model';
import type { Anchor } from '../anchors';
import { sampleSegment, type BBox } from '../math';
import { angleDiffPi } from '../primitives/lines';
import type { Tolerances } from '../tolerance';
import type { FindingCandidate } from '../findings/findings';
import { round } from '../findings/findings';

interface Candidate {
  theta: number;
  rho: number;
}

/** Baricentro dell'area (formula di Gauss sui contorni chiusi campionati). */
export function areaCentroid(paths: PathData[]): Vec2 | null {
  let A = 0,
    cx = 0,
    cy = 0;
  for (const p of paths) {
    if (!p.closed) continue;
    const pts: Vec2[] = [];
    for (const s of p.segments)
      pts.push(...(s.kind === 'line' ? [s.p0] : sampleSegment(s, 9).slice(0, -1)));
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const cr = a.x * b.y - b.x * a.y;
      A += cr;
      cx += (a.x + b.x) * cr;
      cy += (a.y + b.y) * cr;
    }
  }
  if (Math.abs(A) < 1e-9) return null;
  return { x: cx / (3 * A), y: cy / (3 * A) };
}

function pcaAxes(points: Vec2[]): Candidate[] {
  if (points.length < 3) return [];
  let mx = 0,
    my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= points.length;
  my /= points.length;
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const phi = 0.5 * Math.atan2(2 * sxy, sxx - syy); // direzione principale
  return [phi, phi + Math.PI / 2].map((a) => {
    const theta = (((a + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI;
    return { theta, rho: Math.cos(theta) * mx + Math.sin(theta) * my };
  });
}

/** Griglia spaziale per il vicino più prossimo entro un raggio massimo. */
class Grid {
  private cells = new Map<string, number[]>();
  constructor(
    private pts: Vec2[],
    private size: number,
  ) {
    pts.forEach((p, i) => {
      const k = this.key(Math.floor(p.x / size), Math.floor(p.y / size));
      const c = this.cells.get(k);
      if (c) c.push(i);
      else this.cells.set(k, [i]);
    });
  }
  private key(i: number, j: number) {
    return `${i}:${j}`;
  }
  /** Distanza dal punto più vicino, o Infinity se oltre `size`. */
  nearest(p: Vec2): number {
    const ci = Math.floor(p.x / this.size);
    const cj = Math.floor(p.y / this.size);
    let best = Infinity;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const idx of this.cells.get(this.key(ci + di, cj + dj)) ?? []) {
          const q = this.pts[idx]!;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < best) best = d;
        }
      }
    }
    return best <= this.size ? best : Infinity;
  }
}

const reflect = (p: Vec2, c: Candidate): Vec2 => {
  const nx = Math.cos(c.theta);
  const ny = Math.sin(c.theta);
  const d = nx * p.x + ny * p.y - c.rho;
  return { x: p.x - 2 * d * nx, y: p.y - 2 * d * ny };
};

/**
 * §6.7: candidati = verticale/orizzontale per il centro del bbox e per il baricentro, assi
 * PCA. Si riflettono anchor e punti medi dei segmenti; distanza di Hausdorff con l'originale.
 */
export function findAxes(
  paths: PathData[],
  anchors: Anchor[],
  bbox: BBox,
  tol: Tolerances,
): { axes: Axis[]; candidates: FindingCandidate[] } {
  const pts: Vec2[] = anchors.map((a) => a.p);
  for (const p of paths) for (const s of p.segments) pts.push(sampleSegment(s, 3)[1]!);
  const cands: Candidate[] = [];
  const add = (c: Candidate) => {
    if (
      !cands.some(
        (o) =>
          angleDiffPi(o.theta, c.theta) <= tol.angle.strict &&
          Math.abs(o.rho - c.rho) <= tol.symmetry.strict,
      )
    ) {
      cands.push(c);
    }
  };
  const bc = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  add({ theta: 0, rho: bc.x });
  add({ theta: Math.PI / 2, rho: bc.y });
  const g = areaCentroid(paths);
  if (g) {
    add({ theta: 0, rho: g.x });
    add({ theta: Math.PI / 2, rho: g.y });
  }
  for (const c of pcaAxes(anchors.map((a) => a.p))) add(c);

  const grid = new Grid(pts, tol.symmetry.wide);
  const axes: Axis[] = [];
  const candidates: FindingCandidate[] = [];
  for (const c of cands) {
    let H = 0;
    const off: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const d = grid.nearest(reflect(pts[i]!, c));
      if (d > H) H = d;
      if (d > tol.symmetry.strict && i < anchors.length) off.push(i);
      if (H === Infinity) break;
    }
    if (H <= tol.symmetry.strict) {
      axes.push({ id: '', theta: c.theta, rho: c.rho, error: round(H, 6), score: 0 });
    } else if (H <= tol.symmetry.wide) {
      const deg = Math.round((c.theta * 180) / Math.PI);
      candidates.push({
        kind: 'near-symmetry',
        band: tol.symmetry,
        delta: H,
        unit: 'pt',
        refs: off.slice(0, 20).map((i) => anchors[i]!.id),
        scoreRefs: [],
        params: { theta: deg, rho: round(c.rho, 2), delta: round(H, 2), count: off.length },
      });
    }
  }
  // assi validi quasi coincidenti (es. PCA ≈ verticale): resta quello con errore minore
  const kept: Axis[] = [];
  for (const a of [...axes].sort((x, y) => x.error - y.error)) {
    const dup = kept.some((k) => {
      if (angleDiffPi(k.theta, a.theta) > tol.angle.wide) return false;
      const flip = Math.abs(k.theta - a.theta) > Math.PI / 2 ? -1 : 1;
      return Math.abs(k.rho - flip * a.rho) <= tol.symmetry.wide;
    });
    if (!dup) kept.push(a);
  }
  // ordine stabile: come i candidati (verticale, orizzontale, baricentro, PCA)
  const final = axes.filter((a) => kept.includes(a));
  final.forEach((a, i) => (a.id = `ax${i + 1}`));
  return { axes: final, candidates };
}
