import type { Segment, SegmentRef, Vec2 } from '../model';
import { angleBetween, sampleSegment, segmentLength, tangentAt } from '../math';
import type { NormalizedGeometry } from '../normalize';
import { kappaArc } from './kappa';
import { fitCircleKasa, fitCircleTaubin, maxRadialDeviation, type CircleFit } from './taubin';
import { fitEllipse, maxEllipseDeviation, toEllipseFrame, type EllipseFit } from './ellipse';

export interface ArcTolerance {
  /** Scarto radiale massimo per un arco "vero" (assoluto, pt). */
  strict: number;
  /** Scarto radiale massimo per un candidato `near-arc` (assoluto, pt). */
  wide: number;
  /** Scarto massimo per riconoscere un ovale (pt); predefinito `wide`, 0 = nessun ovale. */
  ellipse?: number;
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

/** Ovale rilevato su un tratto liscio di un tracciato. */
export interface DetectedEllipse extends EllipseFit {
  quality: 'arc' | 'near-arc';
  pathId: string;
  from: number;
  to: number;
  refs: SegmentRef[];
  sweep: number;
  length: number;
  deviation: number;
}

export interface ArcDetection {
  arcs: DetectedArc[];
  /** Segmenti curvi con raggio > 5·D: trattati come rette (§6.3.4). */
  nearlyStraight: SegmentRef[];
  ellipses: DetectedEllipse[];
}

const SAMPLES = 16;
const TANGENT_CONTINUITY = (2 * Math.PI) / 180;
/** Un tratto "liscio" (ricalco, disegno a mano) tollera piccoli spigoli fino a 6°. */
const RUN_CONTINUITY = (6 * Math.PI) / 180;
const MIN_SWEEP = (8 * Math.PI) / 180;
/** Un ovale si riconosce solo su almeno 150° di contorno (su meno è indistinguibile da altro). */
const MIN_ELLIPSE_SWEEP = (150 * Math.PI) / 180;
/** Un ovale con assi quasi uguali è un cerchio. */
const MIN_ELLIPSE_RATIO = 1.04;
/** Un arco "quasi" che regge su tutto il tratto deve coprire almeno 30°. */
const MIN_NEAR_RUN_SWEEP = (30 * Math.PI) / 180;
/** Oltre 4 archi esatti per spiegare un tratto ovale, è più semplice (e vero) l'ovale. */
const MAX_CONSTRUCTED_ARCS = 4;
/** Un arco più corto di 30° dentro un tratto liscio è un frammento, non un arco di costruzione. */
const MIN_PIECE_SWEEP = (30 * Math.PI) / 180;

function kink(a: Segment, b: Segment): number {
  return angleBetween(tangentAt(a, true), tangentAt(b, false));
}
function continuous(a: Segment, b: Segment): boolean {
  return kink(a, b) < TANGENT_CONTINUITY;
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

function sweepOf(points: Vec2[], c: { cx: number; cy: number }): number {
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

/** Ampiezza percorsa sul parametro dell'ellisse (2π per un ovale completo). */
function ellipseSweep(points: Vec2[], e: EllipseFit): number {
  const unit = points.map((p) => {
    const q = toEllipseFrame(p, e);
    return { x: q.x / e.rx, y: q.y / e.ry };
  });
  return sweepOf(unit, { cx: 0, cy: 0 });
}

/**
 * Tratti lisci di un tracciato: sequenze di cubiche consecutive con spigoli < 6°. In un tracciato
 * chiuso tutto liscio il tratto unico parte dallo spigolo più marcato.
 */
function smoothRuns(segs: Segment[], closed: boolean): number[][] {
  const n = segs.length;
  const brk = (i: number) => {
    // c'è una rottura tra il segmento i−1 e il segmento i?
    const prev = segs[(i - 1 + n) % n] as Segment;
    const cur = segs[i] as Segment;
    return prev.kind === 'line' || cur.kind === 'line' || kink(prev, cur) >= RUN_CONTINUITY;
  };
  let start = 0;
  if (closed) {
    let found = -1;
    for (let i = 0; i < n && found < 0; i++) if (brk(i)) found = i;
    if (found >= 0) start = found;
    else {
      let worst = -1;
      for (let i = 0; i < n; i++) {
        const k = kink(segs[(i - 1 + n) % n] as Segment, segs[i] as Segment);
        if (k > worst) {
          worst = k;
          start = i;
        }
      }
    }
  }
  const runs: number[][] = [];
  let cur: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if ((segs[i] as Segment).kind === 'line') {
      if (cur.length) runs.push(cur);
      cur = [];
      continue;
    }
    if (cur.length && brk(i)) {
      runs.push(cur);
      cur = [];
    }
    cur.push(i);
  }
  if (cur.length) runs.push(cur);
  return runs;
}

interface Partial {
  arcs: DetectedArc[];
  straight: SegmentRef[];
}

/**
 * Procedura greedy (§6.3) su un tratto: test kappa sul singolo segmento, poi fit di Taubin; i
 * segmenti consecutivi con tangente continua (< 2°) si fondono finché il fit resta entro ε stretta.
 */
function greedy(
  segs: Segment[],
  idx: number[],
  pathId: string,
  tol: ArcTolerance,
  maxRadius: number,
): Partial {
  const arcs: DetectedArc[] = [];
  const straight: SegmentRef[] = [];
  const m = idx.length;
  const seg = (k: number) => segs[idx[k] as number] as Segment;
  let k = 0;
  while (k < m) {
    const first = seg(k);
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
      while (end + 1 < m) {
        const next = seg(end + 1);
        if (!continuous(seg(end), next)) break;
        const trial = samplesOf(idx.slice(k, end + 2).map((i) => segs[i] as Segment));
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
    const covered = idx.slice(k, end + 1);
    if (fit.r > maxRadius) {
      for (const i of covered) straight.push({ pathId, index: i });
    } else {
      arcs.push(makeArc(segs, covered, pathId, fit, pts, dev, exact ? 'arc' : 'near-arc', method));
    }
    k = end + 1;
  }
  return { arcs, straight };
}

function makeArc(
  segs: Segment[],
  covered: number[],
  pathId: string,
  fit: CircleFit,
  pts: Vec2[],
  dev: number,
  quality: 'arc' | 'near-arc',
  method: 'kappa' | 'taubin',
): DetectedArc {
  const sweep = Math.min(sweepOf(pts, fit), 2 * Math.PI);
  return {
    ...fit,
    quality,
    pathId,
    from: covered[0] as number,
    to: covered[covered.length - 1] as number,
    refs: covered.map((index) => ({ pathId, index })),
    sweep,
    length: covered.reduce((a, i) => a + segmentLength(segs[i] as Segment), 0),
    deviation: dev,
    lowWeight: sweep < MIN_SWEEP,
    method,
  };
}

/**
 * §6.3, esteso ai disegni ricalcati: per ogni tratto liscio si prova prima un cerchio unico su
 * tutto il tratto (niente archetti con centri sparsi), poi la procedura greedy, poi un ovale;
 * se nessuno regge, restano gli archi della procedura greedy.
 */
export function detectArcs(geom: NormalizedGeometry, tol: ArcTolerance): ArcDetection {
  const arcs: DetectedArc[] = [];
  const ellipses: DetectedEllipse[] = [];
  const nearlyStraight: SegmentRef[] = [];
  const maxRadius = 5 * geom.D;

  for (const path of geom.paths) {
    const segs = path.segments;
    for (const run of smoothRuns(segs, path.closed)) {
      const runSegs = run.map((i) => segs[i] as Segment);
      const pts = samplesOf(runSegs);
      const g = greedy(segs, run, path.id, tol, maxRadius);
      if (run.length < 2) {
        arcs.push(...g.arcs);
        nearlyStraight.push(...g.straight);
        continue;
      }
      // 1) cerchio unico esatto su tutto il tratto
      const cf = bestFit(pts);
      const dc = cf ? maxRadialDeviation(pts, cf) : Infinity;
      if (cf && cf.r <= maxRadius && dc <= tol.strict) {
        arcs.push(makeArc(segs, run, path.id, cf, pts, dc, 'arc', 'taubin'));
        continue;
      }
      // 2) ovale su tutto il tratto
      const ellTol = tol.ellipse ?? tol.wide;
      const ef = ellTol > 0 ? fitEllipse(pts) : null;
      let ellipse: DetectedEllipse | null = null;
      if (ef && ef.rx <= maxRadius && ef.rx / ef.ry >= MIN_ELLIPSE_RATIO) {
        const de = maxEllipseDeviation(pts, ef);
        const sweep = Math.min(ellipseSweep(pts, ef), 2 * Math.PI);
        if (sweep >= MIN_ELLIPSE_SWEEP && de <= ellTol && de < dc / 2) {
          ellipse = {
            ...ef,
            quality: de <= tol.strict ? 'arc' : 'near-arc',
            pathId: path.id,
            from: run[0] as number,
            to: run[run.length - 1] as number,
            refs: run.map((index) => ({ pathId: path.id, index })),
            sweep,
            length: runSegs.reduce((a, s) => a + segmentLength(s), 0),
            deviation: de,
          };
        }
      }
      // 3) la greedy spiega tutto il tratto con pochi archi esatti (es. ovale costruito con 4
      //    archi di cerchio, archi tangenti di raggi diversi): vince la costruzione con i cerchi
      const exactCount = g.arcs
        .filter((a) => a.quality === 'arc')
        .reduce((s, a) => s + a.refs.length, 0);
      const allExact = exactCount + g.straight.length === run.length;
      const ellipseExact = ellipse !== null && ellipse.quality === 'arc';
      // archi "a pezzi": tanti archetti, o tutti d'accordo con il cerchio unico (ricalco rumoroso)
      const agrees = (a: DetectedArc) =>
        cf !== null &&
        Math.abs(a.r - cf.r) <= Math.max(2 * tol.wide, 0.1 * cf.r) &&
        Math.hypot(a.cx - cf.cx, a.cy - cf.cy) <= Math.max(2 * tol.wide, 0.1 * cf.r);
      const fragmentary =
        g.arcs.length > MAX_CONSTRUCTED_ARCS ||
        g.arcs.some((a) => a.sweep < MIN_PIECE_SWEEP) ||
        (g.arcs.length >= 2 && g.arcs.every(agrees));
      const nearCircle =
        cf !== null &&
        cf.r <= maxRadius &&
        dc <= tol.wide &&
        sweepOf(pts, cf) >= MIN_NEAR_RUN_SWEEP;
      // l'ovale vince anche quando spiega il tratto molto meglio degli archi (scarto < metà)
      const greedyDev = Math.max(0, ...g.arcs.map((a) => a.deviation));
      const ellipseBetter = ellipse !== null && ellipse.deviation < greedyDev / 2;
      if (allExact && !ellipseBetter && !(fragmentary && (ellipseExact || ellipse || nearCircle))) {
        arcs.push(...g.arcs);
        nearlyStraight.push(...g.straight);
        continue;
      }
      if (ellipse) {
        ellipses.push(ellipse);
        continue;
      }
      // 4) cerchio "quasi" su tutto il tratto (disegno impreciso di un solo cerchio)
      if (cf && nearCircle) {
        arcs.push(makeArc(segs, run, path.id, cf, pts, dc, 'near-arc', 'taubin'));
        continue;
      }
      arcs.push(...g.arcs);
      nearlyStraight.push(...g.straight);
    }
  }
  return { arcs, nearlyStraight, ellipses };
}
