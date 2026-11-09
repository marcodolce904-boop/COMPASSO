import type { PathData, Segment, Vec2 } from './model';
import {
  bboxOfPoints,
  diagonal,
  distPointLine,
  dist,
  sampleSegment,
  segmentLength,
  sub,
  type BBox,
} from './math';

export interface NormalizedGeometry {
  paths: PathData[];
  bbox: BBox;
  /** Diagonale del bounding box: unità di misura di tutte le tolleranze. */
  D: number;
  /** Lunghezza totale del contorno (L_tot). */
  totalLength: number;
}

const HANDLE_EPS = 1e-6; // soglia assoluta minima dichiarata (§6.2)
const COLLINEAR_FRAC = 0.0002; // 0,02% di D
const DEGENERATE_FRAC = 0.0001; // 0,01% di D

function segmentPoints(s: Segment): Vec2[] {
  return s.kind === 'line' ? [s.p0, s.p1] : sampleSegment(s, 16);
}

/** Bounding box del logo calcolato sulle curve campionate, non sui punti di controllo. */
export function geometryBBox(paths: PathData[]): BBox {
  const pts: Vec2[] = [];
  for (const p of paths) for (const s of p.segments) pts.push(...segmentPoints(s));
  return bboxOfPoints(pts);
}

function isStraight(s: Segment, D: number): boolean {
  if (s.kind === 'line') return true;
  const same = (a: Vec2, b: Vec2) =>
    Math.abs(a.x - b.x) <= HANDLE_EPS && Math.abs(a.y - b.y) <= HANDLE_EPS;
  if (same(s.c1, s.p0) && same(s.c2, s.p1)) return true;
  const chord = sub(s.p1, s.p0);
  if (chord.x === 0 && chord.y === 0) return false;
  const tol = COLLINEAR_FRAC * D;
  return distPointLine(s.c1, s.p0, chord) < tol && distPointLine(s.c2, s.p0, chord) < tol;
}

/**
 * §6.2: cubiche con maniglie collineari diventano rette, i segmenti degeneri spariscono,
 * si calcolano bbox, D e L_tot. Gli indici dei segmenti sono quelli del risultato.
 */
export function normalizeGeometry(paths: PathData[]): NormalizedGeometry {
  const D = diagonal(geometryBBox(paths));
  const out: PathData[] = [];
  let totalLength = 0;
  for (const p of paths) {
    const segments: Segment[] = [];
    for (const s of p.segments) {
      if (segmentLength(s) < DEGENERATE_FRAC * D) continue;
      const ns: Segment = isStraight(s, D) ? { kind: 'line', p0: s.p0, p1: s.p1 } : s;
      segments.push(ns);
      totalLength += ns.kind === 'line' ? dist(ns.p0, ns.p1) : segmentLength(ns);
    }
    if (segments.length > 0) out.push({ ...p, segments });
  }
  return { paths: out, bbox: geometryBBox(out), D, totalLength };
}
