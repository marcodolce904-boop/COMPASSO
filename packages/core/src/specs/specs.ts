import type { Circle, Specs } from '../model';
import type { BBox } from '../math';
import type { LineSeg } from '../primitives/lines';
import type { Tolerances } from '../tolerance';
import { round } from '../findings/findings';

const NOTABLE: { name: string; value: number }[] = [
  { name: 'golden', value: (1 + Math.sqrt(5)) / 2 },
  { name: 'sqrt2', value: Math.SQRT2 },
  { name: 'double', value: 2 },
  { name: 'one-and-half', value: 1.5 },
];
const RATIO_TOL = 0.01;

interface Cand {
  value: number;
  weight: number;
}

/**
 * §6.8: candidati = distanza tra rette parallele con verso opposto nello stesso glifo
 * (< D/3) e |r₁ − r₂| dei cerchi concentrici dello stesso glifo. Classe mobile larga
 * l'1% di D pesata sul supporto; la moda è l'unità x.
 */
export function unitX(
  segs: LineSeg[],
  glyphOf: (pathId: string) => string,
  concentric: [Circle, Circle][],
  D: number,
  tol: Tolerances,
): { unitX: number | null; confidence: Specs['unitXConfidence']; candidates: Cand[] } {
  const cands: Cand[] = [];
  const byGlyph = new Map<string, LineSeg[]>();
  for (const s of segs) {
    const g = glyphOf(s.ref.pathId);
    const arr = byGlyph.get(g);
    if (arr) arr.push(s);
    else byGlyph.set(g, [s]);
  }
  const sinTol = Math.sin(tol.angle.strict);
  for (const group of byGlyph.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const da = { x: (a.p1.x - a.p0.x) / a.length, y: (a.p1.y - a.p0.y) / a.length };
        const db = { x: (b.p1.x - b.p0.x) / b.length, y: (b.p1.y - b.p0.y) / b.length };
        if (Math.abs(da.x * db.y - da.y * db.x) > sinTol) continue;
        if (da.x * db.x + da.y * db.y >= 0) continue; // verso opposto
        const w = { x: b.p0.x - a.p0.x, y: b.p0.y - a.p0.y };
        const dist = Math.abs(da.x * w.y - da.y * w.x);
        if (dist <= tol.row.strict || dist >= D / 3) continue;
        // sovrapposizione delle proiezioni: le due rette devono "guardarsi"
        const t0 = da.x * w.x + da.y * w.y;
        const t1 = da.x * (b.p1.x - a.p0.x) + da.y * (b.p1.y - a.p0.y);
        const overlap = Math.min(a.length, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
        if (overlap <= 0) continue;
        cands.push({ value: dist, weight: overlap });
      }
    }
  }
  const glyphsOf = (c: Circle) => new Set(c.refs.map((r) => glyphOf(r.pathId)));
  for (const [a, b] of concentric) {
    const ga = glyphsOf(a);
    if (![...glyphsOf(b)].some((g) => ga.has(g))) continue;
    cands.push({ value: Math.abs(a.r - b.r), weight: Math.min(a.support, b.support) });
  }
  if (cands.length === 0) return { unitX: null, confidence: 'low', candidates: cands };
  const total = cands.reduce((s, c) => s + c.weight, 0);
  const half = 0.005 * D;
  let best = { w: -1, sum: 0, value: 0 };
  for (const c of cands) {
    let w = 0,
      sum = 0;
    for (const o of cands) {
      if (Math.abs(o.value - c.value) <= half) {
        w += o.weight;
        sum += o.value * o.weight;
      }
    }
    if (w > best.w + 1e-9 || (Math.abs(w - best.w) <= 1e-9 && c.value < best.value)) {
      best = { w, sum, value: c.value };
    }
  }
  const share = best.w / total;
  const confidence = share >= 0.5 ? 'high' : share >= 0.3 ? 'medium' : 'low';
  return { unitX: round(best.sum / best.w), confidence, candidates: cands };
}

export function radiiSpecs(
  circles: Circle[],
  tol: Tolerances,
): Pick<Specs, 'radii' | 'notableRatios'> {
  const groups: { r: number; id: string }[] = [];
  for (const c of [...circles].sort((a, b) => b.r - a.r)) {
    if (!groups.some((g) => Math.abs(g.r - c.r) <= tol.radius.strict))
      groups.push({ r: c.r, id: c.id });
  }
  const notableRatios: Specs['notableRatios'] = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i]!;
      const b = groups[j]!;
      const ratio = a.r / b.r;
      const hit = NOTABLE.find((n) => Math.abs(ratio - n.value) / n.value <= RATIO_TOL);
      if (hit) notableRatios.push({ a: a.id, b: b.id, ratio: round(ratio), name: hit.name });
      else if (j === i + 1) notableRatios.push({ a: a.id, b: b.id, ratio: round(ratio) });
    }
  }
  return { radii: groups.map((g) => round(g.r)), notableRatios };
}

export function bboxSpec(b: BBox): Specs['bbox'] {
  return { x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) };
}
