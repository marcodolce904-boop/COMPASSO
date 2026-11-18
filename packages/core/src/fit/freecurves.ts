// Curve libere del logo (né archi, né ovali, né rette) → archi tangenti di costruzione.

import type { Circle, PathData, Segment, SegmentRef, Vec2 } from '../model';
import { sampleSegment, segmentLength } from '../math';
import { arcSpline } from './arcspline';

export interface FreeArcChain {
  /** Cerchi approssimati (senza id): uno per arco della catena. */
  circles: Omit<Circle, 'id'>[];
  /** Punti di passaggio tra archi consecutivi (tangenti): junctions[i] tra circles[i] e [i+1]. */
  junctions: Vec2[];
}

const MIN_SWEEP = (8 * Math.PI) / 180;
const SMOOTH_JOIN = (20 * Math.PI) / 180;

function dir(a: Vec2, b: Vec2): Vec2 | null {
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  return l < 1e-12 ? null : { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}
/** Direzione d'arrivo e di partenza di un tratto (dalle maniglie). */
function endDir(s: Segment): Vec2 | null {
  if (s.kind === 'line') return dir(s.p0, s.p1);
  return dir(s.c2, s.p1) ?? dir(s.c1, s.p1) ?? dir(s.p0, s.p1);
}
function startDir(s: Segment): Vec2 | null {
  if (s.kind === 'line') return dir(s.p0, s.p1);
  return dir(s.p0, s.c1) ?? dir(s.p0, s.c2) ?? dir(s.p0, s.p1);
}
function smoothJoin(a: Segment, b: Segment): boolean {
  const u = endDir(a);
  const v = startDir(b);
  if (!u || !v) return false;
  return Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) <= SMOOTH_JOIN;
}

/**
 * Tratti liberi: tratti curvi non spiegati da archi, ovali o rette, raggruppati in sequenze lisce.
 * `covered` = "pathId:index" dei tratti già spiegati.
 */
function freeRuns(path: PathData, covered: Set<string>): number[][] {
  const segs = path.segments;
  const n = segs.length;
  const free = segs.map((s, i) => s.kind === 'cubic' && !covered.has(`${path.id}:${i}`));
  if (!free.some(Boolean)) return [];
  const runs: number[][] = [];
  // per i tracciati chiusi si parte da un tratto non libero (o da uno spigolo) per non spezzare
  let start = 0;
  if (path.closed) {
    const k = free.findIndex((f, i) => !f || !smoothJoin(segs[(i - 1 + n) % n]!, segs[i]!));
    if (k < 0) return [segs.map((_, i) => i)]; // anello tutto libero e liscio
    start = k;
  }
  let cur: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (!free[i]) {
      if (cur.length) runs.push(cur);
      cur = [];
      continue;
    }
    const prev = cur[cur.length - 1];
    if (prev !== undefined && !smoothJoin(segs[prev]!, segs[i]!)) {
      runs.push(cur);
      cur = [];
    }
    cur.push(i);
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/**
 * Catene di archi tangenti per le curve libere. Si rinuncia a una curva se servono più di 3 archi
 * per tratto (massimo 8): una curva così non ha una costruzione leggibile.
 */
export function freeCurveArcs(
  paths: PathData[],
  covered: Set<string>,
  D: number,
  tol: number,
): FreeArcChain[] {
  const chains: FreeArcChain[] = [];
  for (const path of paths) {
    for (const run of freeRuns(path, covered)) {
      const segs = run.map((i) => path.segments[i]!);
      const pts: Vec2[] = [];
      segs.forEach((s, k) => {
        const n = Math.max(8, Math.ceil(segmentLength(s) / (D / 400)));
        const sm = sampleSegment(s, n);
        pts.push(...(k === 0 ? sm : sm.slice(1)));
      });
      const arcs = arcSpline(pts, tol, Math.min(8, 3 * run.length));
      if (!arcs) continue;
      const refs: SegmentRef[] = run.map((index) => ({ pathId: path.id, index }));
      const circles: Omit<Circle, 'id'>[] = [];
      const junctions: Vec2[] = [];
      let prevKept = false;
      arcs.forEach((a, i) => {
        // archi quasi dritti o minuscoli: niente cerchio (la catena si interrompe lì)
        const keep = a.r <= 5 * D && a.sweep >= MIN_SWEEP;
        if (keep) {
          if (prevKept) junctions.push({ x: a.from.x, y: a.from.y });
          circles.push({
            cx: a.cx,
            cy: a.cy,
            r: a.r,
            support: a.length,
            refs,
            score: 0,
            approx: Math.round(Math.max(a.deviation, 1e-3) * 100) / 100,
          });
        } else if (circles.length) {
          // catena spezzata: i passaggi registrati valgono solo per archi consecutivi
          chains.push({ circles: circles.splice(0), junctions: junctions.splice(0) });
        }
        prevKept = keep && i < arcs.length;
      });
      if (circles.length) chains.push({ circles, junctions });
    }
  }
  return chains;
}
