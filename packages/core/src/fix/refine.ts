// Correzione delle imperfezioni del logo (scheda CORREGGI).
// Riceve la geometria del documento e restituisce una geometria corretta, più un riepilogo.
// Ogni correzione si attiva e si regola da sola; l'intensità generale sfuma tra originale e corretto.
// Le tolleranze sono in pt (l'interfaccia le propone in base a D, la diagonale del logo).

import type { DocumentGeometry, PathData, Segment, Vec2 } from '../model';
import { detectArcs, type DetectedArc, type DetectedEllipse } from '../fit/arcs';
import { ellipsePoint, fitEllipse, nearestParam } from '../fit/ellipse';
import { fitCircleTaubin } from '../fit/taubin';
import { normalizeGeometry } from '../normalize';
import { UnionFind } from '../primitives/unionFind';

export type SymmetryAxis = 'auto' | 'vertical' | 'horizontal';

export interface RefineOptions {
  /** 0 = nessuna modifica, 1 = correzione piena. */
  strength: number;
  /** Curve quasi circolari → archi esatti (scarto radiale massimo ammesso, pt). */
  arcs: { enabled: boolean; tolerance: number };
  /**
   * Curve quasi ovali → ovali esatti (scarto massimo, pt). Con `toCircle` l'ovale diventa un
   * cerchio perfetto (raggio = media dei semiassi), stesso centro.
   */
  ellipses: { enabled: boolean; tolerance: number; toCircle: boolean };
  /** Cerchi con raggi quasi uguali → stesso raggio (differenza massima, pt). */
  radii: { enabled: boolean; tolerance: number };
  /** Cerchi quasi concentrici → stesso centro (distanza massima dei centri, pt). */
  centers: { enabled: boolean; tolerance: number };
  /** Rette quasi orizzontali/verticali/a 45° → esatte (scarto angolare massimo, gradi). */
  lines: { enabled: boolean; angle: number };
  /** Anchor quasi sulla stessa riga o colonna → allineati (scarto massimo, pt). */
  align: { enabled: boolean; tolerance: number };
  /** Logo quasi simmetrico → simmetrico (scarto massimo tra punti speculari, pt). */
  symmetry: { enabled: boolean; tolerance: number; axis: SymmetryAxis };
  /** Aggancio a una griglia (passo in pt) di anchor e centri; facoltativo l'arrotondamento dei raggi. */
  grid: { enabled: boolean; step: number; radii: boolean };
  /** Meno anchor: archi ricostruiti con il minimo di tratti, rette consecutive allineate unite. */
  clean: { enabled: boolean };
}

export interface RefineReport {
  /** Tratti di curva resi archi esatti. */
  arcs: number;
  /** Ovali resi esatti (o trasformati in cerchi). */
  ellipses: number;
  /** Cerchi a cui è stato uniformato il raggio. */
  radii: number;
  /** Cerchi a cui è stato uniformato il centro. */
  centers: number;
  /** Rette portate a 0°, 45° o 90°. */
  lines: number;
  /** Anchor allineati su righe o colonne. */
  aligned: number;
  /** Anchor resi simmetrici (0 se il logo non è simmetrico entro la tolleranza). */
  symmetric: number;
  /** Asse usato per la simmetria, se applicata. */
  axis: { theta: number; rho: number } | null;
  /** Anchor agganciati alla griglia. */
  gridded: number;
  /** Anchor rimossi dalla pulizia. */
  removedAnchors: number;
  /** Spostamento massimo di un anchor, pt. */
  maxShift: number;
  /** Tracciati modificati. */
  changedPaths: number;
}

export interface RefineResult {
  geometry: DocumentGeometry;
  report: RefineReport;
}

/** Diagonale del logo e valori predefiniti delle tolleranze (in pt), proporzionati al logo. */
export function refineDefaults(geom: DocumentGeometry): { D: number; options: RefineOptions } {
  const D = normalizeGeometry(geom.paths).D || 100;
  const pt = (f: number) => round2(f * D);
  return {
    D,
    options: {
      strength: 1,
      arcs: { enabled: true, tolerance: pt(0.008) },
      ellipses: { enabled: true, tolerance: pt(0.008), toCircle: false },
      radii: { enabled: true, tolerance: pt(0.015) },
      centers: { enabled: true, tolerance: pt(0.01) },
      lines: { enabled: true, angle: 2 },
      align: { enabled: true, tolerance: pt(0.005) },
      symmetry: { enabled: true, tolerance: pt(0.015), axis: 'auto' },
      grid: { enabled: false, step: 1, radii: false },
      clean: { enabled: true },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Rappresentazione di lavoro: tracciati come nodi (anchor + maniglie assolute).

interface Node {
  p: Vec2;
  hin: Vec2;
  hout: Vec2;
}
interface WPath {
  src: PathData;
  closed: boolean;
  nodes: Node[];
}
/** Cerchio di lavoro; con `ry` e `rot` è un ovale (r = semiasse maggiore). */
interface Circle0 {
  cx: number;
  cy: number;
  r: number;
  weight: number;
  ry?: number;
  rot?: number;
  /** Nato da un ovale (anche se trasformato in cerchio): conta tra gli ovali nel riepilogo. */
  oval?: boolean;
}
interface Run {
  path: number;
  from: number; // indice del primo segmento
  to: number; // indice dell'ultimo segmento (incluso; se < from, il tratto passa per l'inizio)
  circle: number;
}

const EPS = 1e-9;
const isEllipse = (c: Circle0) => c.ry !== undefined;

/** Coordinate "unitarie": il cerchio/ovale diventa il cerchio di raggio 1 centrato nell'origine. */
function toU(p: Vec2, c: Circle0): Vec2 {
  const dx = p.x - c.cx;
  const dy = p.y - c.cy;
  if (!isEllipse(c)) return { x: dx / c.r, y: dy / c.r };
  const cs = Math.cos(c.rot!);
  const sn = Math.sin(c.rot!);
  return { x: (dx * cs + dy * sn) / c.r, y: (-dx * sn + dy * cs) / c.ry! };
}
/** Parte lineare della trasformazione inversa (per vettori, es. le maniglie). */
function vecFromU(v: Vec2, c: Circle0): Vec2 {
  if (!isEllipse(c)) return { x: v.x * c.r, y: v.y * c.r };
  const cs = Math.cos(c.rot!);
  const sn = Math.sin(c.rot!);
  const u = v.x * c.r;
  const w = v.y * c.ry!;
  return { x: u * cs - w * sn, y: u * sn + w * cs };
}
function fromU(u: Vec2, c: Circle0): Vec2 {
  const v = vecFromU(u, c);
  return { x: c.cx + v.x, y: c.cy + v.y };
}
const round2 = (v: number) => Math.round(v * 100) / 100;
const cp = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const segCount = (w: WPath) => (w.closed ? w.nodes.length : w.nodes.length - 1);

function toWork(p: PathData): WPath {
  const segs = p.segments;
  const n = p.closed ? segs.length : segs.length + 1;
  const nodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    const out = i < segs.length ? segs[i] : undefined;
    const inn = p.closed
      ? segs[(i - 1 + segs.length) % segs.length]
      : i > 0
        ? segs[i - 1]
        : undefined;
    const pos = out ? out.p0 : inn!.p1;
    const hout = out && out.kind === 'cubic' ? out.c1 : pos;
    const hin = inn && inn.kind === 'cubic' ? inn.c2 : pos;
    nodes.push({ p: cp(pos), hin: cp(hin), hout: cp(hout) });
  }
  return { src: p, closed: p.closed, nodes };
}

function toPath(w: WPath): PathData {
  const segments: Segment[] = [];
  const n = w.nodes.length;
  const count = segCount(w);
  for (let i = 0; i < count; i++) {
    const a = w.nodes[i]!;
    const b = w.nodes[(i + 1) % n]!;
    const straight = dist(a.hout, a.p) < 1e-7 && dist(b.hin, b.p) < 1e-7;
    segments.push(
      straight
        ? { kind: 'line', p0: cp(a.p), p1: cp(b.p) }
        : { kind: 'cubic', p0: cp(a.p), c1: cp(a.hout), c2: cp(b.hin), p1: cp(b.p) },
    );
  }
  return { ...w.src, segments };
}

/** Punti fitti lungo un tracciato dato come nodi (32 campioni per tratto). */
function sampleNodes(nodes: Node[], closed: boolean): Vec2[] {
  const out: Vec2[] = [];
  const count = closed ? nodes.length : nodes.length - 1;
  for (let i = 0; i < count; i++) {
    const a = nodes[i]!;
    const b = nodes[(i + 1) % nodes.length]!;
    for (let k = 0; k < 32; k++) {
      const t = k / 32;
      const u = 1 - t;
      const w0 = u * u * u;
      const w1 = 3 * u * u * t;
      const w2 = 3 * u * t * t;
      const w3 = t * t * t;
      out.push({
        x: w0 * a.p.x + w1 * a.hout.x + w2 * b.hin.x + w3 * b.p.x,
        y: w0 * a.p.y + w1 * a.hout.y + w2 * b.hin.y + w3 * b.p.y,
      });
    }
  }
  if (!closed && nodes.length) out.push(cp(nodes[nodes.length - 1]!.p));
  return out;
}

/** Sposta un anchor portandosi dietro le sue maniglie (la forma locale resta la stessa). */
function moveNode(n: Node, to: Vec2): number {
  const dx = to.x - n.p.x;
  const dy = to.y - n.p.y;
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return 0;
  n.p = { x: to.x, y: to.y };
  n.hin = { x: n.hin.x + dx, y: n.hin.y + dy };
  n.hout = { x: n.hout.x + dx, y: n.hout.y + dy };
  return Math.hypot(dx, dy);
}

const isLineSeg = (w: WPath, i: number) => {
  const a = w.nodes[i]!;
  const b = w.nodes[(i + 1) % w.nodes.length]!;
  return dist(a.hout, a.p) < 1e-7 && dist(b.hin, b.p) < 1e-7;
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Raggruppa valori 1D: un gruppo non supera `tol` di ampiezza. */
function clusters1d<T>(items: T[], value: (t: T) => number, tol: number): T[][] {
  const sorted = [...items].sort((a, b) => value(a) - value(b));
  const out: T[][] = [];
  let cur: T[] = [];
  for (const it of sorted) {
    if (cur.length && value(it) - value(cur[0]!) > tol) {
      out.push(cur);
      cur = [];
    }
    cur.push(it);
  }
  if (cur.length) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------------------------

export function refine(geom: DocumentGeometry, opts: RefineOptions): RefineResult {
  const ng = normalizeGeometry(geom.paths);
  const D = ng.D || 1;
  const work = ng.paths.map(toWork);
  const strength = Math.max(0, Math.min(1, opts.strength));
  const structural = opts.clean.enabled && strength >= 0.999;
  const report: RefineReport = {
    arcs: 0,
    ellipses: 0,
    radii: 0,
    centers: 0,
    lines: 0,
    aligned: 0,
    symmetric: 0,
    axis: null,
    gridded: 0,
    removedAnchors: 0,
    maxShift: 0,
    changedPaths: 0,
  };
  // stato iniziale per l'intensità e per il riepilogo
  const original = work.map((w) =>
    w.nodes.map((n) => ({ p: cp(n.p), hin: cp(n.hin), hout: cp(n.hout) })),
  );
  const allNodes = () => work.flatMap((w) => w.nodes);

  // 1. Archi e cerchi: rilevati sulla geometria originale, entro la tolleranza scelta.
  const runs: Run[] = [];
  const circles: Circle0[] = [];
  const nearlyStraight = new Set<string>();
  const ellOn = opts.ellipses.enabled && opts.ellipses.tolerance > 0;
  if (opts.arcs.enabled || opts.lines.enabled || ellOn) {
    const tol = Math.max(opts.arcs.tolerance, 1e-6 * D);
    const {
      arcs,
      nearlyStraight: ns,
      ellipses,
    } = detectArcs(ng, { strict: tol, wide: tol, ellipse: ellOn ? opts.ellipses.tolerance : 0 });
    for (const r of ns) nearlyStraight.add(`${r.pathId}:${r.index}`);
    if (opts.arcs.enabled) collectCircles(arcs, work, runs, circles, D, tol);
    if (ellOn) collectEllipses(ellipses, work, runs, circles, opts.ellipses.toCircle);
  }

  // 2. Rette quasi dritte → rette.
  if (opts.lines.enabled) {
    work.forEach((w) => {
      for (let i = 0; i < segCount(w); i++) {
        if (!nearlyStraight.has(`${w.src.id}:${i}`)) continue;
        const a = w.nodes[i]!;
        const b = w.nodes[(i + 1) % w.nodes.length]!;
        a.hout = cp(a.p);
        b.hin = cp(b.p);
      }
    });
  }

  // 3–4. Simmetria, angoli esatti e allineamenti si ripetono insieme finché valgono tutti:
  //      ognuno da solo romperebbe un po' gli altri (es. la simmetria sposta un lato a 45°).
  // anchor interni a un arco/ovale da ricostruire: non si allineano (tornano comunque sulla curva)
  const inCurve = new Set<Node>();
  if (opts.arcs.enabled || ellOn) {
    for (const r of runs) {
      const ns = runNodes(work[r.path]!, r);
      const w = work[r.path]!;
      const full = w.closed && ns.length - 1 === segCount(w);
      ns.forEach((n, i) => {
        if (full || (i > 0 && i < ns.length - 1)) inCurve.add(n);
      });
    }
  }
  const angleTol = (opts.lines.angle * Math.PI) / 180;
  const symOn = opts.symmetry.enabled && opts.symmetry.tolerance > 0;
  const alignOn = opts.align.enabled && opts.align.tolerance > 0;
  let fixedAxis: { vertical: boolean; c: number } | null = null;
  const counted = { sym: new Set<Node>(), lines: new Set<string>(), aligned: new Set<Node>() };
  for (let iter = 0; iter < 12; iter++) {
    let moved = 0;
    if (symOn && (iter === 0 || fixedAxis)) {
      const sres = symmetrize(
        allNodes(),
        iter === 0 ? circles.filter((c) => !isEllipse(c)) : [],
        opts.symmetry.tolerance,
        opts.symmetry.axis,
        fixedAxis,
      );
      if (iter === 0 && sres.axis) {
        fixedAxis = { vertical: Math.abs(sres.axis.theta) < 1e-9, c: sres.axis.rho };
        report.axis = sres.axis;
      }
      sres.moved.forEach((n) => counted.sym.add(n));
      moved += sres.shift;
    }
    if (opts.lines.enabled) {
      const l = snapAngles(work, angleTol, runs);
      l.segments.forEach((k) => counted.lines.add(k));
      moved += l.shift;
    }
    if (alignOn) {
      for (const ax of ['y', 'x'] as const) {
        const r = alignAxis(
          allNodes().filter((n) => !inCurve.has(n)),
          ax,
          opts.align.tolerance,
        );
        r.moved.forEach((n) => counted.aligned.add(n));
        moved += r.shift;
      }
    }
    if (moved < 1e-9) break;
  }
  report.symmetric += counted.sym.size;
  report.lines += counted.lines.size;
  report.aligned += counted.aligned.size;

  // 5. Cerchi: raggi uguali, centri comuni.
  if (opts.radii.enabled && opts.radii.tolerance > 0)
    report.radii += unifyRadii(
      circles.filter((c) => !isEllipse(c)),
      opts.radii.tolerance,
    );
  if (opts.centers.enabled && opts.centers.tolerance > 0)
    report.centers += unifyCenters(circles, opts.centers.tolerance);

  // 6. Griglia.
  if (opts.grid.enabled && opts.grid.step > 0) {
    const g = opts.grid.step;
    const snap = (v: number) => Math.round(v / g) * g;
    for (const n of allNodes())
      if (moveNode(n, { x: snap(n.p.x), y: snap(n.p.y) }) > 0) report.gridded++;
    for (const c of circles) {
      c.cx = snap(c.cx);
      c.cy = snap(c.cy);
      if (opts.grid.radii && !isEllipse(c)) c.r = Math.max(g, snap(c.r));
    }
  }

  // 7. Archi esatti sui cerchi (dopo gli spostamenti: gli anchor tornano sul cerchio).
  if (runs.length) rebuildArcs(work, runs, circles, structural, report);

  // 8. Pulizia: rette consecutive allineate → una sola retta.
  if (structural) report.removedAnchors += mergeCollinear(work);

  // 9. Intensità: sfuma tra originale e corretto (solo se la struttura dei tracciati non è cambiata).
  work.forEach((w, k) => {
    const orig = original[k]!;
    const sameShape = orig.length === w.nodes.length;
    if (sameShape && strength < 1) {
      w.nodes.forEach((n, i) => {
        const o = orig[i]!;
        const mix = (a: Vec2, b: Vec2): Vec2 => ({
          x: a.x + (b.x - a.x) * strength,
          y: a.y + (b.y - a.y) * strength,
        });
        n.p = mix(o.p, n.p);
        n.hin = mix(o.hin, n.hin);
        n.hout = mix(o.hout, n.hout);
      });
    }
    let changed = !sameShape;
    if (sameShape) {
      w.nodes.forEach((n, i) => {
        const o = orig[i]!;
        const d = dist(n.p, o.p);
        if (d > report.maxShift) report.maxShift = d;
        if (d > 1e-6 || dist(n.hin, o.hin) > 1e-6 || dist(n.hout, o.hout) > 1e-6) changed = true;
      });
    } else {
      // struttura cambiata: spostamento massimo = distanza di ogni nuovo anchor dalla CURVA originale
      const before = sampleNodes(orig, w.closed);
      for (const n of w.nodes) {
        let best = Infinity;
        for (const o of before) best = Math.min(best, dist(n.p, o));
        if (best < Infinity && best > report.maxShift) report.maxShift = best;
      }
    }
    if (changed) report.changedPaths++;
  });
  report.maxShift = round2(report.maxShift * 1000) / 1000;

  // tracciati scartati dalla normalizzazione (solo segmenti degeneri): restano come sono,
  // così nella copia corretta non manca nessun pezzo
  const byId = new Map(work.map((w) => [w.src.id, toPath(w)]));
  const paths = geom.paths.map((p) => byId.get(p.id) ?? p);
  return { geometry: { ...geom, paths }, report };
}

// ---------------------------------------------------------------------------------------------

/** Anchor (originali) di un tratto d'arco, dal primo all'ultimo. */
function runNodes(w: WPath, run: Run): Node[] {
  const segs = segCount(w);
  const out: Node[] = [];
  for (let k = run.from; ; k = (k + 1) % segs) {
    out.push(w.nodes[k]!);
    if (k === run.to) break;
  }
  out.push(w.nodes[(run.to + 1) % w.nodes.length]!);
  return out;
}

/**
 * Archi rilevati → cerchi e tratti da ricostruire. Il cerchio si stima dagli ANCHOR (su un arco
 * esatto stanno sulla circonferenza; la curva di Bézier invece sporge un poco a metà tratto).
 * Un tratto i cui anchor stanno su un cerchio più importante viene assegnato a quel cerchio.
 */
function collectCircles(
  arcs: DetectedArc[],
  work: WPath[],
  runs: Run[],
  circles: Circle0[],
  D: number,
  tol: number,
) {
  const usable = arcs.filter((a) => a.r < 5 * D);
  const same = 0.002 * D; // stesso cerchio: centro e raggio entro lo 0,2% di D
  const uf = new UnionFind(usable.length);
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i]!;
      const b = usable[j]!;
      if (Math.hypot(a.cx - b.cx, a.cy - b.cy) <= same && Math.abs(a.r - b.r) <= same)
        uf.union(i, j);
    }
  }
  const own: Run[] = [];
  usable.forEach((a) => {
    const path = work.findIndex((w) => w.src.id === a.pathId);
    own.push({ path, from: a.from, to: a.to, circle: -1 });
  });
  const groups = uf.groups().map((g) => g.filter((i) => own[i]!.path >= 0));
  const fitGroup = (g: number[]): Circle0 | null => {
    let w = 0,
      cx = 0,
      cy = 0,
      r = 0;
    const pts: Vec2[] = [];
    for (const i of g) {
      const a = usable[i]!;
      w += a.length;
      cx += a.cx * a.length;
      cy += a.cy * a.length;
      r += a.r * a.length;
      for (const n of runNodes(work[own[i]!.path]!, own[i]!)) {
        if (!pts.some((q) => dist(q, n.p) < 1e-6)) pts.push(cp(n.p));
      }
    }
    if (w === 0) return null;
    const fallback = { cx: cx / w, cy: cy / w, r: r / w, weight: w };
    if (pts.length < 3) return fallback;
    const f = fitCircleTaubin(pts);
    if (
      !f ||
      Math.hypot(f.cx - fallback.cx, f.cy - fallback.cy) > tol + same ||
      Math.abs(f.r - fallback.r) > tol + same
    ) {
      return fallback;
    }
    return { cx: f.cx, cy: f.cy, r: f.r, weight: w };
  };
  // cerchi in ordine di importanza (lunghezza d'arco)
  const fitted = groups
    .map((g) => ({ g, c: fitGroup(g) }))
    .filter((x): x is { g: number[]; c: Circle0 } => x.c !== null)
    .sort((a, b) => b.c.weight - a.c.weight);
  for (const { g, c } of fitted) {
    // gli anchor di questo gruppo stanno già su un cerchio più importante? allora è lo stesso cerchio
    const nodes = g.flatMap((i) => runNodes(work[own[i]!.path]!, own[i]!));
    let target = -1;
    for (let k = 0; k < circles.length && target < 0; k++) {
      const big = circles[k]!;
      if (nodes.every((n) => Math.abs(Math.hypot(n.p.x - big.cx, n.p.y - big.cy) - big.r) <= tol))
        target = k;
    }
    if (target < 0) {
      target = circles.length;
      circles.push(c);
    } else {
      circles[target]!.weight += c.weight;
    }
    for (const i of g) runs.push({ ...own[i]!, circle: target });
  }
}

/** Ovali rilevati → ovali di lavoro (o cerchi, con `toCircle`) e tratti da ricostruire. */
function collectEllipses(
  found: DetectedEllipse[],
  work: WPath[],
  runs: Run[],
  circles: Circle0[],
  toCircle: boolean,
) {
  for (const found0 of found) {
    const path = work.findIndex((w) => w.src.id === found0.pathId);
    if (path < 0) continue;
    // stima dagli anchor e dai punti a metà tratto: su un arco esatto (k = 4/3·tan(φ/4)) stanno
    // proprio sull'ovale, quindi un ovale già esatto viene ritrovato identico (idempotenza)
    const w = work[path]!;
    const run: Run = { path, from: found0.from, to: found0.to, circle: -1 };
    const nodes = runNodes(w, run);
    const pts: Vec2[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      pts.push(cp(a.p));
      const b = nodes[i + 1];
      if (b)
        pts.push({
          x: (a.p.x + 3 * a.hout.x + 3 * b.hin.x + b.p.x) / 8,
          y: (a.p.y + 3 * a.hout.y + 3 * b.hin.y + b.p.y) / 8,
        });
    }
    const re = fitEllipse(pts);
    const close =
      re !== null &&
      Math.hypot(re.cx - found0.cx, re.cy - found0.cy) <= 0.05 * found0.rx &&
      Math.abs(re.rx - found0.rx) <= 0.05 * found0.rx &&
      Math.abs(re.ry - found0.ry) <= 0.05 * found0.rx;
    const e = close ? { ...found0, ...re } : found0;
    const c: Circle0 = toCircle
      ? { cx: e.cx, cy: e.cy, r: (e.rx + e.ry) / 2, weight: e.length, oval: true }
      : { cx: e.cx, cy: e.cy, r: e.rx, ry: e.ry, rot: e.rotation, weight: e.length, oval: true };
    circles.push(c);
    runs.push({ ...run, circle: circles.length - 1 });
  }
}

/** Rette quasi a 0°/45°/90°/135° → esatte. Le rette orizzontali e verticali si correggono con la media. */
function snapAngles(
  work: WPath[],
  tol: number,
  runs: Run[],
): { segments: string[]; shift: number } {
  const inArc = new Set<string>();
  for (const r of runs) {
    const w = work[r.path]!;
    const n = segCount(w);
    for (let k = r.from; ; k = (k + 1) % n) {
      inArc.add(`${r.path}:${k}`);
      if (k === r.to) break;
    }
  }
  const segments: string[] = [];
  let shift = 0;
  work.forEach((w, wi) => {
    for (let i = 0; i < segCount(w); i++) {
      if (inArc.has(`${wi}:${i}`) || !isLineSeg(w, i)) continue;
      const a = w.nodes[i]!;
      const b = w.nodes[(i + 1) % w.nodes.length]!;
      const len = dist(a.p, b.p);
      if (len < EPS) continue;
      let phi = Math.atan2(b.p.y - a.p.y, b.p.x - a.p.x);
      if (phi < 0) phi += Math.PI;
      if (phi >= Math.PI) phi -= Math.PI;
      let target = -1;
      for (const t of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI]) {
        if (Math.abs(phi - t) <= tol) target = t;
      }
      if (target < 0 || Math.abs(phi - target) < 1e-12) continue;
      let moved = 0;
      if (Math.abs(target) < 1e-12 || Math.abs(target - Math.PI) < 1e-12) {
        const y = (a.p.y + b.p.y) / 2;
        moved += moveNode(a, { x: a.p.x, y }) + moveNode(b, { x: b.p.x, y });
      } else if (Math.abs(target - Math.PI / 2) < 1e-12) {
        const x = (a.p.x + b.p.x) / 2;
        moved += moveNode(a, { x, y: a.p.y }) + moveNode(b, { x, y: b.p.y });
      } else {
        // 45°/135°: rotazione attorno al punto medio, lunghezza invariata
        const m = { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 };
        const sign =
          (b.p.x - a.p.x) * Math.cos(target) + (b.p.y - a.p.y) * Math.sin(target) >= 0 ? 1 : -1;
        const d = {
          x: Math.cos(target) * sign * (len / 2),
          y: Math.sin(target) * sign * (len / 2),
        };
        moved +=
          moveNode(a, { x: m.x - d.x, y: m.y - d.y }) + moveNode(b, { x: m.x + d.x, y: m.y + d.y });
      }
      if (moved > 0) segments.push(`${wi}:${i}`);
      shift += moved;
    }
  });
  return { segments, shift };
}

/** Anchor con coordinata quasi uguale → mediana del gruppo (l'anchor «fuori riga» raggiunge gli altri). */
function alignAxis(nodes: Node[], axis: 'x' | 'y', tol: number): { moved: Node[]; shift: number } {
  const moved: Node[] = [];
  let shift = 0;
  for (const group of clusters1d(nodes, (n) => n.p[axis], tol)) {
    if (group.length < 2) continue;
    const t = median(group.map((n) => n.p[axis]));
    for (const n of group) {
      if (Math.abs(n.p[axis] - t) < EPS) continue;
      shift += moveNode(n, axis === 'y' ? { x: n.p.x, y: t } : { x: t, y: n.p.y });
      moved.push(n);
    }
  }
  return { moved, shift };
}

/** Simmetria rispetto a un asse verticale o orizzontale per il centro del logo. */
function symmetrize(
  nodes: Node[],
  circles: Circle0[],
  tol: number,
  axis: SymmetryAxis,
  fixed: { vertical: boolean; c: number } | null,
): { moved: Node[]; shift: number; axis: { theta: number; rho: number } | null } {
  const none = { moved: [] as Node[], shift: 0, axis: null };
  if (nodes.length < 2) return none;
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.p.x);
    x1 = Math.max(x1, n.p.x);
    y0 = Math.min(y0, n.p.y);
    y1 = Math.max(y1, n.p.y);
  }
  const candidates: { vertical: boolean; c: number }[] = fixed ? [fixed] : [];
  if (!fixed && axis !== 'horizontal') candidates.push({ vertical: true, c: (x0 + x1) / 2 });
  if (!fixed && axis !== 'vertical') candidates.push({ vertical: false, c: (y0 + y1) / 2 });

  const reflect = (p: Vec2, v: boolean, c: number): Vec2 =>
    v ? { x: 2 * c - p.x, y: p.y } : { x: p.x, y: 2 * c - p.y };
  const pairing = (v: boolean, c: number) => {
    let worst = 0;
    const partner: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const r = reflect(nodes[i]!.p, v, c);
      let best = -1;
      let bd = Infinity;
      for (let j = 0; j < nodes.length; j++) {
        const d = dist(r, nodes[j]!.p);
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      partner.push(best);
      worst = Math.max(worst, bd);
    }
    return { worst, partner };
  };

  let chosen: { vertical: boolean; c: number; partner: number[] } | null = null;
  let bestWorst = Infinity;
  for (const cand of candidates) {
    const { worst, partner } = pairing(cand.vertical, cand.c);
    if (worst <= tol && worst < bestWorst) {
      bestWorst = worst;
      chosen = { ...cand, partner };
    }
  }
  if (!chosen) return none;
  const { vertical, c, partner } = chosen;
  const moved: Node[] = [];
  let shift = 0;
  const done = new Set<number>();
  for (let i = 0; i < nodes.length; i++) {
    if (done.has(i)) continue;
    const j = partner[i]!;
    const a = nodes[i]!;
    if (j === i || partner[j] !== i) {
      // anchor sull'asse (o senza partner reciproco): portato sull'asse se è lì vicino
      const onAxis = vertical ? Math.abs(a.p.x - c) <= tol : Math.abs(a.p.y - c) <= tol;
      if (j === i && onAxis) {
        const d = moveNode(a, vertical ? { x: c, y: a.p.y } : { x: a.p.x, y: c });
        if (d > 0) moved.push(a);
        shift += d;
      }
      done.add(i);
      continue;
    }
    const b = nodes[j]!;
    const rb = reflect(b.p, vertical, c);
    const target = { x: (a.p.x + rb.x) / 2, y: (a.p.y + rb.y) / 2 };
    const da = moveNode(a, target);
    const db = moveNode(b, reflect(target, vertical, c));
    if (da > 0) moved.push(a);
    if (db > 0) moved.push(b);
    shift += da + db;
    done.add(i);
    done.add(j);
  }
  // cerchi speculari: stesso raggio, centri simmetrici; cerchi sull'asse: centro sull'asse
  const cdone = new Set<number>();
  circles.forEach((k, i) => {
    if (cdone.has(i)) return;
    const r = reflect({ x: k.cx, y: k.cy }, vertical, c);
    let best = -1;
    let bd = Infinity;
    circles.forEach((o, j) => {
      const d = Math.hypot(o.cx - r.x, o.cy - r.y) + Math.abs(o.r - k.r);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best < 0 || bd > tol) return;
    const o = circles[best]!;
    if (best === i) {
      if (vertical) k.cx = c;
      else k.cy = c;
    } else {
      const ro = reflect({ x: o.cx, y: o.cy }, vertical, c);
      const t = { x: (k.cx + ro.x) / 2, y: (k.cy + ro.y) / 2 };
      const rr = (k.r + o.r) / 2;
      const tt = reflect(t, vertical, c);
      k.cx = t.x;
      k.cy = t.y;
      k.r = rr;
      o.cx = tt.x;
      o.cy = tt.y;
      o.r = rr;
      cdone.add(best);
    }
    cdone.add(i);
  });
  return { moved, shift, axis: vertical ? { theta: 0, rho: c } : { theta: Math.PI / 2, rho: c } };
}

/** Raggi quasi uguali → media pesata (sulla lunghezza d'arco). */
function unifyRadii(circles: Circle0[], tol: number): number {
  let count = 0;
  for (const g of clusters1d(circles, (c) => c.r, tol)) {
    if (g.length < 2) continue;
    const w = g.reduce((s, c) => s + c.weight, 0);
    const r = g.reduce((s, c) => s + c.r * c.weight, 0) / w;
    for (const c of g) {
      if (Math.abs(c.r - r) > EPS) count++;
      c.r = r;
    }
  }
  return count;
}

/** Centri quasi coincidenti → media pesata (cerchi concentrici). */
function unifyCenters(circles: Circle0[], tol: number): number {
  const uf = new UnionFind(circles.length);
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i]!;
      const b = circles[j]!;
      if (Math.hypot(a.cx - b.cx, a.cy - b.cy) <= tol) uf.union(i, j);
    }
  }
  let count = 0;
  for (const g of uf.groups()) {
    if (g.length < 2) continue;
    const w = g.reduce((s, i) => s + circles[i]!.weight, 0);
    const cx = g.reduce((s, i) => s + circles[i]!.cx * circles[i]!.weight, 0) / w;
    const cy = g.reduce((s, i) => s + circles[i]!.cy * circles[i]!.weight, 0) / w;
    for (const i of g) {
      const c = circles[i]!;
      if (Math.hypot(c.cx - cx, c.cy - cy) > EPS) count++;
      c.cx = cx;
      c.cy = cy;
    }
  }
  return count;
}

/**
 * Maniglie esatte di un arco di cerchio (o di ovale) da `a` a `b`, nello stesso verso del tratto
 * originale. Sull'ovale si lavora sul cerchio unitario e si riporta indietro: le Bézier sono
 * invarianti per trasformazioni affini, quindi l'arco resta esatto.
 */
function exactArc(a: Node, b: Node, c: Circle0, dir: number) {
  const ua = toU(a.p, c);
  const ub = toU(b.p, c);
  const a0 = Math.atan2(ua.y, ua.x);
  const a1 = Math.atan2(ub.y, ub.x);
  let d = a1 - a0;
  if (dir > 0) while (d <= 1e-12) d += 2 * Math.PI;
  else while (d >= -1e-12) d -= 2 * Math.PI;
  if (Math.abs(d) > 2 * Math.PI - 1e-9) d = dir * 2 * Math.PI;
  const k = (4 / 3) * Math.tan(d / 4);
  const ho = vecFromU({ x: -k * ua.y, y: k * ua.x }, c);
  const hi = vecFromU({ x: k * ub.y, y: -k * ub.x }, c);
  a.hout = { x: a.p.x + ho.x, y: a.p.y + ho.y };
  b.hin = { x: b.p.x + hi.x, y: b.p.y + hi.y };
}

/** Punto del cerchio/ovale più vicino a p. */
const onCircle = (p: Vec2, c: Circle0): Vec2 => {
  if (isEllipse(c)) {
    const e = { cx: c.cx, cy: c.cy, rx: c.r, ry: c.ry!, rotation: c.rot! };
    return ellipsePoint(e, nearestParam(p, e));
  }
  const d = Math.hypot(p.x - c.cx, p.y - c.cy) || 1;
  return { x: c.cx + ((p.x - c.cx) * c.r) / d, y: c.cy + ((p.y - c.cy) * c.r) / d };
};
/** Punto del cerchio/ovale all'angolo `ang` (sul cerchio unitario). */
const atAngle = (ang: number, c: Circle0): Vec2 => fromU({ x: Math.cos(ang), y: Math.sin(ang) }, c);
const angleOf = (p: Vec2, c: Circle0): number => {
  const u = toU(p, c);
  return Math.atan2(u.y, u.x);
};

/** Verso di percorrenza del tratto attorno al centro (+1 o −1). */
function travelDir(a: Node, c: Circle0): number {
  const u = toU(a.p, c);
  const h = toU(a.hout, c);
  const tx = h.x - u.x;
  const ty = h.y - u.y;
  return u.x * ty - u.y * tx >= 0 ? 1 : -1;
}

function rebuildArcs(
  work: WPath[],
  runs: Run[],
  circles: Circle0[],
  structural: boolean,
  report: RefineReport,
): void {
  // per tracciato, dall'ultimo tratto al primo: le rimozioni non spostano gli indici ancora da fare
  const byPath = new Map<number, Run[]>();
  for (const r of runs) {
    const list = byPath.get(r.path);
    if (list) list.push(r);
    else byPath.set(r.path, [r]);
  }
  const tally = (c: Circle0, n: number) => {
    if (n <= 0) return;
    if (c.oval) report.ellipses++;
    else report.arcs += n;
  };
  for (const [pi, list] of byPath) {
    const w = work[pi]!;
    list.sort((a, b) => b.from - a.from);
    for (const run of list) {
      const c = circles[run.circle]!;
      const n = w.nodes.length;
      const segs = segCount(w);
      const idx: number[] = []; // nodi del tratto, dal primo all'ultimo
      for (let k = run.from; ; k = (k + 1) % segs) {
        idx.push(k);
        if (k === run.to) break;
      }
      const nodeIdx = [...idx, (run.to + 1) % n];
      const dir = travelDir(w.nodes[idx[0]!]!, c);
      const wraps = run.to < run.from;
      const closedLoop = w.closed && idx.length === segs; // cerchio/ovale completo
      // ricostruzione con il minimo di tratti (≤ 90° ciascuno), se ammessa e senza giro sull'inizio
      if (structural && !wraps && !closedLoop) {
        const first = w.nodes[nodeIdx[0]!]!;
        const last = w.nodes[nodeIdx[nodeIdx.length - 1]!]!;
        moveNode(first, onCircle(first.p, c));
        moveNode(last, onCircle(last.p, c));
        const a0 = angleOf(first.p, c);
        let total = angleOf(last.p, c) - a0;
        if (dir > 0) while (total <= 1e-12) total += 2 * Math.PI;
        else while (total >= -1e-12) total -= 2 * Math.PI;
        const m = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI / 2) - 1e-6));
        const inner: Node[] = [];
        for (let s = 1; s < m; s++) {
          const p = atAngle(a0 + (total * s) / m, c);
          inner.push({ p, hin: cp(p), hout: cp(p) });
        }
        const removed = nodeIdx.length - 2;
        w.nodes.splice(nodeIdx[0]! + 1, removed, ...inner);
        report.removedAnchors += Math.max(0, removed - inner.length);
        const chain = [first, ...inner, last];
        const h0 = { out: cp(first.hout), in: cp(last.hin) };
        for (let s = 0; s < chain.length - 1; s++) exactArc(chain[s]!, chain[s + 1]!, c, dir);
        const changed =
          removed !== inner.length ||
          dist(first.hout, h0.out) > 1e-6 ||
          dist(last.hin, h0.in) > 1e-6;
        if (changed) tally(c, chain.length - 1);
        continue;
      }
      const before = nodeIdx.map((k) => {
        const nd = w.nodes[k]!;
        return { p: cp(nd.p), hin: cp(nd.hin), hout: cp(nd.hout) };
      });
      for (const k of nodeIdx) moveNode(w.nodes[k]!, onCircle(w.nodes[k]!.p, c));
      let count = 0;
      for (let s = 0; s < idx.length; s++) {
        const a = w.nodes[nodeIdx[s]!]!;
        const b = w.nodes[nodeIdx[s + 1]!]!;
        exactArc(a, b, c, dir);
        const a0 = before[s]!;
        const b0 = before[s + 1]!;
        const changed =
          dist(a.p, a0.p) > 1e-6 ||
          dist(a.hout, a0.hout) > 1e-6 ||
          dist(b.p, b0.p) > 1e-6 ||
          dist(b.hin, b0.hin) > 1e-6;
        if (changed) count++;
      }
      if (structural && closedLoop && segs > 4) {
        // cerchio/ovale completo con troppi anchor: 4 quarti a partire dal primo anchor
        const a0 = angleOf(w.nodes[0]!.p, c);
        const nodes: Node[] = [];
        for (let s = 0; s < 4; s++) {
          const p = atAngle(a0 + (dir * s * Math.PI) / 2, c);
          nodes.push({ p, hin: cp(p), hout: cp(p) });
        }
        for (let s = 0; s < 4; s++) exactArc(nodes[s]!, nodes[(s + 1) % 4]!, c, dir);
        report.removedAnchors += segs - 4;
        w.nodes = nodes;
        count = Math.max(count, 1);
      }
      tally(c, count);
    }
  }
}

/** Due rette consecutive quasi allineate → una sola retta (l'anchor in mezzo sparisce). */
function mergeCollinear(work: WPath[]): number {
  let removed = 0;
  const limit = Math.sin((0.5 * Math.PI) / 180);
  for (const w of work) {
    let i = 0;
    while (w.nodes.length > (w.closed ? 3 : 2) && i < w.nodes.length) {
      const n = w.nodes.length;
      const isEnd = !w.closed && (i === 0 || i === n - 1);
      const prev = (i - 1 + n) % n;
      if (!isEnd && isLineSeg(w, prev) && isLineSeg(w, i)) {
        const a = w.nodes[prev]!.p;
        const b = w.nodes[i]!.p;
        const c = w.nodes[(i + 1) % n]!.p;
        const ux = b.x - a.x,
          uy = b.y - a.y,
          vx = c.x - b.x,
          vy = c.y - b.y;
        const lu = Math.hypot(ux, uy),
          lv = Math.hypot(vx, vy);
        if (
          lu > EPS &&
          lv > EPS &&
          Math.abs(ux * vy - uy * vx) / (lu * lv) < limit &&
          ux * vx + uy * vy > 0
        ) {
          w.nodes.splice(i, 1);
          removed++;
          continue;
        }
      }
      i++;
    }
  }
  return removed;
}
