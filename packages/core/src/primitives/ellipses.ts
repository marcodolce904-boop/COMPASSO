import type { Ellipse, SegmentRef } from '../model';
import type { DetectedEllipse } from '../fit/arcs';
import type { Tolerances } from '../tolerance';
import { UnionFind } from './unionFind';

const refOrder = (a: SegmentRef, b: SegmentRef) =>
  a.pathId < b.pathId ? -1 : a.pathId > b.pathId ? 1 : a.index - b.index;

/** Differenza tra due rotazioni di assi (periodo π). */
function rotDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
}

/**
 * Ovali canonici: gli ovali rilevati con centro, assi e rotazione coincidenti (tolleranze strette
 * di centri e raggi) si fondono; media pesata sulla lunghezza. Id `e1, e2…` per supporto.
 */
export function canonicalEllipses(found: DetectedEllipse[], tol: Tolerances): Ellipse[] {
  const uf = new UnionFind(found.length);
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const a = found[i]!;
      const b = found[j]!;
      if (
        Math.hypot(a.cx - b.cx, a.cy - b.cy) <= tol.center.strict &&
        Math.abs(a.rx - b.rx) <= tol.radius.strict &&
        Math.abs(a.ry - b.ry) <= tol.radius.strict &&
        rotDiff(a.rotation, b.rotation) * a.rx <= tol.radius.strict
      ) {
        uf.union(i, j);
      }
    }
  }
  const out: Ellipse[] = uf.groups().map((g) => {
    let w = 0,
      cx = 0,
      cy = 0,
      rx = 0,
      ry = 0;
    const refs: SegmentRef[] = [];
    const base = found[g[0]!]!.rotation;
    let rot = 0;
    for (const i of g) {
      const e = found[i]!;
      const wi = e.length;
      w += wi;
      cx += e.cx * wi;
      cy += e.cy * wi;
      rx += e.rx * wi;
      ry += e.ry * wi;
      // rotazione mediata vicino alla prima (periodo π)
      let d = e.rotation - base;
      while (d > Math.PI / 2) d -= Math.PI;
      while (d < -Math.PI / 2) d += Math.PI;
      rot += d * wi;
      refs.push(...e.refs);
    }
    refs.sort(refOrder);
    let rotation = (base + rot / w) % Math.PI;
    if (rotation < 0) rotation += Math.PI;
    return {
      id: '',
      cx: cx / w,
      cy: cy / w,
      rx: rx / w,
      ry: ry / w,
      rotation,
      support: w,
      refs,
      score: 0,
    };
  });
  out.sort((a, b) => b.support - a.support || a.cx - b.cx || a.cy - b.cy || a.rx - b.rx);
  out.forEach((e, i) => (e.id = `e${i + 1}`));
  return out;
}
