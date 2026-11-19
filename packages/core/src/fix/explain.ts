// CORREGGI: perché una correzione accesa è rimasta a 0 (docs/MIGLIORIE.md §2). Per ogni correzione si
// cerca il caso più vicino: «non c'è niente», «è già esatto» oppure «si scosta di X» con una
// tolleranza da provare.
import type { DocumentGeometry, Vec2 } from '../model';
import { tangentAt } from '../math';
import { detectArcs } from '../fit/arcs';
import { normalizeGeometry } from '../normalize';
import type { RefineOptions, RefineReport } from './refine';

export type ZeroWhy =
  | { kind: 'none' }
  | { kind: 'already' }
  | { kind: 'note'; code: 'too-different' | 'partial' }
  | { kind: 'near'; value: number; tol: number; suggest: number; unit: 'pt' | 'deg' };

export type ZeroKey =
  | 'arcs'
  | 'ellipses'
  | 'radii'
  | 'centers'
  | 'lines'
  | 'align'
  | 'symmetry'
  | 'grid'
  | 'clean'
  | 'smooth';

/** Tolleranza da proporre: un po' sopra lo scarto trovato, arrotondata. */
const suggestOf = (v: number, unit: 'pt' | 'deg') => {
  const s = v * 1.15 + (unit === 'deg' ? 0.1 : 0.01);
  return unit === 'deg' ? Math.ceil(s * 2) / 2 : Math.ceil(s * 100) / 100;
};
const near = (value: number, tol: number, unit: 'pt' | 'deg'): ZeroWhy => ({
  kind: 'near',
  value,
  tol,
  suggest: suggestOf(value, unit),
  unit,
});

export function explainZero(
  geom: DocumentGeometry,
  o: RefineOptions,
  r: RefineReport,
): Partial<Record<ZeroKey, ZeroWhy>> {
  const out: Partial<Record<ZeroKey, ZeroWhy>> = {};
  const ng = normalizeGeometry(geom.paths);
  const D = ng.D || 100;
  const far = 0.05 * D; // oltre il 5% di D non è «quasi»: non si propone
  const segs = ng.paths.flatMap((p) => p.segments);
  const curves = segs.filter((s) => s.kind === 'cubic');

  // archi e ovali: si rifà il rilevamento con una tolleranza larga e si prende il più vicino
  const wide = detectArcs(ng, {
    strict: Math.max(o.arcs.tolerance, 1e-6 * D),
    wide: far,
    ellipse: o.ellipses.enabled ? far : 0,
  });
  if (o.arcs.enabled && r.arcs === 0) {
    const miss = wide.arcs.filter((a) => a.deviation > o.arcs.tolerance).map((a) => a.deviation);
    out.arcs =
      !curves.length || !miss.length
        ? { kind: 'none' }
        : near(Math.min(...miss), o.arcs.tolerance, 'pt');
  }
  if (o.ellipses.enabled && r.ellipses === 0) {
    const miss = wide.ellipses
      .filter((e) => e.deviation > o.ellipses.tolerance)
      .map((e) => e.deviation);
    out.ellipses =
      !curves.length || !miss.length
        ? { kind: 'none' }
        : near(Math.min(...miss), o.ellipses.tolerance, 'pt');
  }

  // raggi e centri: tra i cerchi trovati (anche quelli appena fuori tolleranza)
  const circles = wide.arcs.map((a) => ({ cx: a.cx, cy: a.cy, r: a.r }));
  const pairMin = (f: (a: (typeof circles)[0], b: (typeof circles)[0]) => number, tol: number) => {
    let best = Infinity;
    let exact = false;
    for (let i = 0; i < circles.length; i++)
      for (let j = i + 1; j < circles.length; j++) {
        const v = f(circles[i]!, circles[j]!);
        if (v <= 1e-3) exact = true;
        else if (v > tol && v < far) best = Math.min(best, v);
      }
    return { best, exact };
  };
  if (o.radii.enabled && r.radii === 0) {
    const { best, exact } = pairMin((a, b) => Math.abs(a.r - b.r), o.radii.tolerance);
    out.radii = Number.isFinite(best)
      ? near(best, o.radii.tolerance, 'pt')
      : exact
        ? { kind: 'already' }
        : { kind: 'none' };
  }
  if (o.centers.enabled && r.centers === 0) {
    const { best, exact } = pairMin(
      (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy),
      o.centers.tolerance,
    );
    out.centers = Number.isFinite(best)
      ? near(best, o.centers.tolerance, 'pt')
      : exact
        ? { kind: 'already' }
        : { kind: 'none' };
  }

  // rette: scarto dall'angolo esatto più vicino (multipli di 45°)
  if (o.lines.enabled && r.lines === 0) {
    const ns = new Set(wide.nearlyStraight.map((s) => `${s.pathId}:${s.index}`));
    const devs: number[] = [];
    for (const p of ng.paths)
      p.segments.forEach((s, i) => {
        if (s.kind !== 'line' && !ns.has(`${p.id}:${i}`)) return;
        const a = (Math.atan2(s.p1.y - s.p0.y, s.p1.x - s.p0.x) * 180) / Math.PI;
        const m = ((a % 45) + 45) % 45;
        devs.push(Math.min(m, 45 - m));
      });
    const miss = devs.filter((d) => d > o.lines.angle && d < 15);
    out.lines = miss.length
      ? near(Math.min(...miss), o.lines.angle, 'deg')
      : devs.length && devs.every((d) => d <= 0.01)
        ? { kind: 'already' }
        : { kind: 'none' };
  }

  // allineamenti: due anchor quasi sulla stessa riga o colonna
  if (o.align.enabled && r.aligned === 0) {
    const pts: Vec2[] = [];
    for (const p of ng.paths) for (const s of p.segments) pts.push(s.p0);
    let best = Infinity;
    let exact = false;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        for (const v of [Math.abs(pts[i]!.x - pts[j]!.x), Math.abs(pts[i]!.y - pts[j]!.y)]) {
          if (v <= 1e-3) exact = true;
          else if (v > o.align.tolerance && v < far) best = Math.min(best, v);
        }
      }
    out.align = Number.isFinite(best)
      ? near(best, o.align.tolerance, 'pt')
      : exact
        ? { kind: 'already' }
        : { kind: 'none' };
  }

  // curve fluide: giunture quasi lisce
  if (o.smooth?.enabled && r.smoothed === 0) {
    const devs: number[] = [];
    for (const p of ng.paths) {
      const n = p.segments.length;
      for (let i = 0; i < (p.closed ? n : n - 1); i++) {
        const a = tangentAt(p.segments[i]!, true),
          b = tangentAt(p.segments[(i + 1) % n]!, false);
        const c = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
        devs.push((Math.acos(c) * 180) / Math.PI);
      }
    }
    const miss = devs.filter((d) => d > o.smooth.angle && d < 45);
    out.smooth = miss.length ? near(Math.min(...miss), o.smooth.angle, 'deg') : { kind: 'none' };
  }

  if (o.symmetry.enabled && r.symmetric === 0)
    out.symmetry = r.symmetryNote ? { kind: 'note', code: r.symmetryNote } : { kind: 'none' };
  if (o.grid.enabled && r.gridded === 0) out.grid = { kind: 'already' };
  if (o.clean.enabled && r.removedAnchors === 0) out.clean = { kind: 'none' };
  return out;
}
