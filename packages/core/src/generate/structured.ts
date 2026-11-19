// GENERA · Strutturato: le curve libere diventano davvero la loro catena di archi tangenti
// (la costruzione che ANALIZZA mostra dalla 0.9.0). Il logo diventa costruibile con riga e compasso.

import type { PathData, Segment, Vec2 } from '../model';
import { arcSpline } from '../fit/arcspline';
import { freeRuns } from '../fit/freecurves';
import { sampleSegment, segmentLength } from '../math';

export interface StructuredResult {
  paths: PathData[];
  /** Curve libere diventate archi. */
  curves: number;
  /** Curve lasciate com'erano (servirebbero troppi archi). */
  skipped: number;
  circles: { cx: number; cy: number; r: number }[];
}

/** Arco di cerchio come cubiche (al massimo 90° ciascuna), dal punto `from` al punto `to`. */
function arcToCubics(c: Vec2, r: number, from: Vec2, to: Vec2, sweep: number): Segment[] {
  const a0 = Math.atan2(from.y - c.y, from.x - c.x);
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * step;
    const t1 = t0 + step;
    const p0 = i === 0 ? from : { x: c.x + r * Math.cos(t0), y: c.y + r * Math.sin(t0) };
    const p1 = i === n - 1 ? to : { x: c.x + r * Math.cos(t1), y: c.y + r * Math.sin(t1) };
    out.push({
      kind: 'cubic',
      p0,
      c1: { x: p0.x - k * r * Math.sin(t0), y: p0.y + k * r * Math.cos(t0) },
      c2: { x: p1.x + k * r * Math.sin(t1), y: p1.y - k * r * Math.cos(t1) },
      p1,
    });
  }
  return out;
}

/**
 * Sostituisce le curve libere di `paths` (normalizzati) con archi tangenti entro `tol` (pt).
 * `covered` = "pathId:index" dei tratti già spiegati da cerchi, ovali o rette veri.
 */
export function structureCompose(
  paths: PathData[],
  covered: Set<string>,
  tol: number,
  D: number,
): StructuredResult {
  let curves = 0;
  let skipped = 0;
  const circles: StructuredResult['circles'] = [];
  const out = paths.map((path) => {
    const runs = freeRuns(path, covered);
    if (!runs.length) return path;
    const replace = new Map<number, Segment[]>(); // primo indice del tratto → nuovi tratti
    const drop = new Set<number>();
    for (const run of runs) {
      const segs = run.map((i) => path.segments[i]!);
      const pts: Vec2[] = [];
      segs.forEach((s, k) => {
        const n = Math.max(8, Math.ceil(segmentLength(s) / (D / 400)));
        const sm = sampleSegment(s, n);
        pts.push(...(k === 0 ? sm : sm.slice(1)));
      });
      const arcs = arcSpline(pts, tol, Math.min(8, 3 * run.length));
      // archi quasi dritti (raggio enorme): quel pezzo è una retta, non un arco
      if (!arcs || arcs.some((a) => a.r > 5 * D)) {
        skipped++;
        continue;
      }
      const next: Segment[] = [];
      for (const a of arcs) {
        // verso di rotazione: dal punto a metà del tratto coperto dall'arco
        const mid = pts[Math.floor((a.i0 + a.i1) / 2)]!;
        const c = { x: a.cx, y: a.cy };
        const cross = (a.from.x - c.x) * (mid.y - c.y) - (a.from.y - c.y) * (mid.x - c.x);
        const sweep = cross >= 0 ? a.sweep : -a.sweep;
        next.push(...arcToCubics(c, a.r, a.from, a.to, sweep));
        circles.push({ cx: a.cx, cy: a.cy, r: a.r });
      }
      // estremi esatti: la curva si attacca ai tratti vicini senza buchi
      const first = next[0]!;
      const last = next[next.length - 1]!;
      next[0] = { ...first, p0: segs[0]!.p0 } as Segment;
      next[next.length - 1] = { ...last, p1: segs[segs.length - 1]!.p1 } as Segment;
      replace.set(run[0]!, next);
      for (const i of run.slice(1)) drop.add(i);
      curves++;
    }
    if (!replace.size) return path;
    const segments: Segment[] = [];
    path.segments.forEach((s, i) => {
      if (drop.has(i)) return;
      segments.push(...(replace.get(i) ?? [s]));
    });
    // continuità tra un tratto e il successivo
    for (let i = 1; i < segments.length; i++) {
      const s = segments[i]!;
      const p = segments[i - 1]!.p1;
      if (s.p0.x !== p.x || s.p0.y !== p.y) segments[i] = { ...s, p0: p } as Segment;
    }
    return { ...path, segments };
  });
  return { paths: out, curves, skipped, circles };
}
