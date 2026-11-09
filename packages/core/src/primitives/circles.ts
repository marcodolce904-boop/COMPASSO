import type { Circle, SegmentRef } from '../model';
import type { DetectedArc } from '../fit/arcs';
import type { Tolerances } from '../tolerance';
import { UnionFind } from './unionFind';

const LOW_WEIGHT = 0.25; // peso degli archi sotto gli 8° (§6.3.4)

const refOrder = (a: SegmentRef, b: SegmentRef) =>
  a.pathId < b.pathId ? -1 : a.pathId > b.pathId ? 1 : a.index - b.index;

/**
 * §6.4: gli archi "veri" si raggruppano (union-find) se centri e raggi coincidono entro
 * ε_c ed ε_r strette; il cerchio canonico è la media pesata sulla lunghezza d'arco.
 * Id `c1, c2…` in ordine di supporto decrescente.
 */
export function canonicalCircles(arcs: DetectedArc[], tol: Tolerances): Circle[] {
  const real = arcs.filter((a) => a.quality === 'arc');
  const uf = new UnionFind(real.length);
  for (let i = 0; i < real.length; i++) {
    for (let j = i + 1; j < real.length; j++) {
      const a = real[i]!;
      const b = real[j]!;
      if (
        Math.hypot(a.cx - b.cx, a.cy - b.cy) <= tol.center.strict &&
        Math.abs(a.r - b.r) <= tol.radius.strict
      ) {
        uf.union(i, j);
      }
    }
  }
  const circles = uf.groups().map((g) => {
    let w = 0,
      cx = 0,
      cy = 0,
      r = 0,
      support = 0;
    const refs: SegmentRef[] = [];
    for (const i of g) {
      const a = real[i]!;
      const wi = a.length * (a.lowWeight ? LOW_WEIGHT : 1);
      w += wi;
      cx += a.cx * wi;
      cy += a.cy * wi;
      r += a.r * wi;
      support += a.length;
      refs.push(...a.refs);
    }
    refs.sort(refOrder);
    return { id: '', cx: cx / w, cy: cy / w, r: r / w, support, refs, score: 0 };
  });
  circles.sort((a, b) => b.support - a.support || a.cx - b.cx || a.cy - b.cy || a.r - b.r);
  circles.forEach((c, i) => (c.id = `c${i + 1}`));
  return circles;
}
