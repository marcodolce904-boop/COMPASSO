import type { Segment, SegmentRef, Vec2 } from '../model';
import { angleBetween, sampleSegment, segmentLength, tangentAt } from '../math';
import type { NormalizedGeometry } from '../normalize';
import { kappaArc } from './kappa';
import { fitCircleKasa, fitCircleTaubin, maxRadialDeviation, type CircleFit } from './taubin';

export interface ArcTolerance {
  /** Scarto radiale massimo per un arco "vero" (assoluto, pt). */
  strict: number;
  /** Scarto radiale massimo per un candidato `near-arc` (assoluto, pt). */
  wide: number;
}

/** Tolleranze del preset Normale (§6.9) in frazione di D, con moltiplicatore del preset. */
export function arcTolerance(D: number, multiplier = 1): ArcTolerance {
  return { strict: 0.0015 * D * multiplier, wide: 0.008 * D * multiplier };
}

export interface DetectedArc extends CircleFit {
  /** `arc`: entro ε stretta. `near-arc`: tra ε stretta e ε larga (finding). */
  quality: 'arc' | 'near-arc';
  pathId: string;
  /** Segmenti coperti: da `from` a `to` inclusi, in ordine di percorrenza (mod n se chiuso). */
  from: number;
  to: number;
  refs: SegmentRef[];
  /** Ampiezza in radianti (2π per un cerchio completo). */
  sweep: number;
  /** Lunghezza d'arco spiegata (supporto del §6.4). */
  length: number;
  /** Scarto radiale massimo dai campioni. */
  deviation: number;
  /** Peso basso per archi sotto gli 8° (§6.3.4). */
  lowWeight: boolean;
  method: 'kappa' | 'taubin';
}

export interface ArcDetection {
  arcs: DetectedArc[];
  /** Segmenti curvi con raggio > 5·D: trattati come rette (§6.3.4). */
  nearlyStraight: SegmentRef[];
}

const SAMPLES = 16;
const TANGENT_CONTINUITY = (2 * Math.PI) / 180;
const MIN_SWEEP = (8 * Math.PI) / 180;

function continuous(a: Segment, b: Segment): boolean {
  return angleBetween(tangentAt(a, true), tangentAt(b, false)) < TANGENT_CONTINUITY;
}

function samplesOf(segs: Segment[]): Vec2[] {
  const pts: Vec2[] = [];
  segs.forEach((s, i) => {
    const sp = sampleSegment(s, SAMPLES);
    pts.push(...(i === 0 ? sp : sp.slice(1)));
  });
  return pts;
}

function bestFit(points: Vec2[]): CircleFit | null {
  return fitCircleTaubin(points) ?? fitCircleKasa(points);
}

function sweepOf(points: Vec2[], c: CircleFit): number {
  let total = 0;
  let prev = Math.atan2((points[0] as Vec2).y - c.cy, (points[0] as Vec2).x - c.cx);
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as Vec2;
    const a = Math.atan2(p.y - c.cy, p.x - c.cx);
    let d = a - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d;
    prev = a;
  }
  return Math.abs(total);
}

/**
 * §6.3: rileva archi in ogni tracciato. Per ogni segmento: test kappa in forma chiusa,
 * poi fit di Taubin su 16 campioni; i segmenti consecutivi con tangente continua (< 2°)
 * si fondono (procedura greedy) finché il fit dell'unione resta entro ε stretta.
 */
export function detectArcs(geom: NormalizedGeometry, tol: ArcTolerance): ArcDetection {
  const arcs: DetectedArc[] = [];
  const nearlyStraight: SegmentRef[] = [];
  const maxRadius = 5 * geom.D;

  for (const path of geom.paths) {
    const segs = path.segments;
    const n = segs.length;
    // il giro parte dopo uno spigolo, così nessuna catena deve "avvolgere" l'inizio
    let startIdx = 0;
    if (path.closed) {
      for (let i = 0; i < n; i++) {
        const prev = segs[(i - 1 + n) % n] as Segment;
        if (!continuous(prev, segs[i] as Segment)) {
          startIdx = i;
          break;
        }
      }
    }
    const at = (k: number) => (startIdx + k) % n;

    let k = 0;
    while (k < n) {
      const first = segs[at(k)] as Segment;
      if (first.kind === 'line') {
        k++;
        continue;
      }
      // 1) segmento singolo: kappa in forma chiusa, altrimenti Taubin
      const kap = kappaArc(first);
      const firstPts = samplesOf([first]);
      let fit: CircleFit | null = kap ? { cx: kap.cx, cy: kap.cy, r: kap.r } : bestFit(firstPts);
      let method: 'kappa' | 'taubin' = kap ? 'kappa' : 'taubin';
      let dev = fit ? maxRadialDeviation(firstPts, fit) : Infinity;
      if (!fit || dev > tol.wide) {
        k++;
        continue;
      }
      const exact = dev <= tol.strict || kap !== null;
      let end = k;
      let pts = firstPts;
      if (exact) {
        // 2) estendi la catena finché l'unione resta entro ε stretta
        while (end + 1 < n) {
          const prev = segs[at(end)] as Segment;
          const next = segs[at(end + 1)] as Segment;
          if (next.kind !== 'cubic' || !continuous(prev, next)) break;
          const trial = samplesOf(range(segs, at, k, end + 1));
          const f = bestFit(trial);
          if (!f) break;
          const d = maxRadialDeviation(trial, f);
          if (d > tol.strict) break;
          fit = f;
          dev = d;
          pts = trial;
          method = 'taubin';
          end++;
        }
      }
      const covered = range(segs, at, k, end);
      const sweep = Math.min(sweepOf(pts, fit), 2 * Math.PI);
      if (fit.r > maxRadius) {
        for (let j = k; j <= end; j++) nearlyStraight.push({ pathId: path.id, index: at(j) });
      } else {
        arcs.push({
          ...fit,
          quality: exact ? 'arc' : 'near-arc',
          pathId: path.id,
          from: at(k),
          to: at(end),
          refs: covered.map((_, j) => ({ pathId: path.id, index: at(k + j) })),
          sweep,
          length: covered.reduce((a, s) => a + segmentLength(s), 0),
          deviation: dev,
          lowWeight: sweep < MIN_SWEEP,
          method,
        });
      }
      k = end + 1;
    }
  }
  return { arcs, nearlyStraight };
}

function range(segs: Segment[], at: (k: number) => number, from: number, to: number): Segment[] {
  const out: Segment[] = [];
  for (let j = from; j <= to; j++) out.push(segs[at(j)] as Segment);
  return out;
}
