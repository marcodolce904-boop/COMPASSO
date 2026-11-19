// GENERA (docs/GENERA.md): versioni del logo ricomposte secondo una regola, entro uno scarto massimo.

import type { DocumentGeometry, PathData, Vec2 } from '../model';
import { analyze } from '../analyze';
import { normalizeGeometry } from '../normalize';
import { refine, refineDefaults } from '../fix/refine';
import { anchorCount, bboxOf, driftStats, toNodes, fromNodes } from './geometry';
import { mathCompose, type MathOptions } from './math';
import { minimalCompose } from './minimal';
import { structureCompose } from './structured';
import { goldenCompose, goldenSpiral, gridFractions, RATIO, type GoldenOptions } from './golden';
import {
  constructionCircles,
  fromConstruction,
  lineAngles,
  finalize,
  solve,
  toConstruction,
  type CanonRules,
} from './canon';
import { autoKeep, findMirrorAxis, mirrorHalf } from '../fix/mirror';
import type { MirrorKeep } from '../fix/mirror';
import type { SymmetryAxis } from '../fix/refine';

export type GenerateMode = 'math' | 'minimal' | 'symmetric' | 'structured' | 'golden';
export type MinimalLevel = 'light' | 'medium' | 'strong';

export interface GenerateOptions {
  /** 0 = logo corretto, 1 = regola piena. */
  strength: number;
  /**
   * Limite di stravolgimento (pt). null = nessun limite (di base): il logo diventa canonico alla
   * regola anche se cambia molto (docs/GENERA.md §0). Con un numero valgono le attenuazioni.
   */
  maxDeviation: number | null;
  math: MathOptions;
  minimal: { level: MinimalLevel; maxAnchors: number | null };
  /** Simmetrico: asse e metà da tenere (come in CORREGGI). */
  symmetric: { axis: SymmetryAxis; keep: 'auto' | MirrorKeep };
  /** Sezione aurea (docs/GENERA.md §7c). */
  golden: GoldenOptions;
}

export type GenerateNote =
  /** La regola piena sforava lo scarto massimo: intensità ridotta. */
  | 'strength-reduced'
  /** Nemmeno un po' di regola resta entro lo scarto: logo solo corretto. */
  | 'unchanged'
  /** Minimal: il numero massimo di anchor non è raggiungibile entro lo scarto. */
  | 'max-anchors-not-reached'
  /** Matematico: alcune rette lasciate al loro angolo (ruotarle avrebbe sformato il logo). */
  | 'angles-skipped'
  /** Simmetrico: nessun asse plausibile entro lo scarto massimo. */
  | 'no-axis'
  /** Simmetrico: alcune forme senza gemello sono rimaste com'erano. */
  | 'partial'
  /** Strutturato: nessuna curva libera da trasformare. */
  | 'nothing-to-do'
  /** Strutturato: alcune curve richiederebbero troppi archi e restano com'erano. */
  | 'curves-skipped'
  /** Sezione aurea: nessuna misura vicina a un rapporto aureo entro lo scarto. */
  | 'no-golden';

export interface GenerateReport {
  mode: GenerateMode;
  /** 100% = identico all'originale (100 − scarto medio in % della diagonale). */
  similarity: number;
  /** Scarto massimo dall'originale, pt. */
  drift: number;
  strengthUsed: number;
  anchorsBefore: number;
  anchorsAfter: number;
  /** Matematico: rette ruotate, raggi portati a multipli, anchor spostati; modulo in pt. */
  angles: number;
  radii: number;
  positions: number;
  module: number;
  /** Passo della griglia usato, in frazioni di modulo (2 = m/2, 4 = m/4…). */
  division: number;
  /** Minimal: forme molto piccole (meno del 3% della diagonale), segnalate e non tolte. */
  smallShapes: number;
  /** Strutturato: curve libere diventate archi, e archi usati. */
  arcCurves: number;
  arcs: number;
  /** Ricostruzione canonica (nessun limite di somiglianza). */
  canonical: boolean;
  /** Sezione aurea: spessori portati in rapporto; riquadro portato a φ. */
  thickness: number;
  boxed: boolean;
  notes: GenerateNote[];
}

export interface GenerateGuides {
  /** Griglia del modulo (Matematico). */
  grid: { x: number; y: number; width: number; height: number; step: number } | null;
  /** Cerchi di costruzione con il raggio in moduli (es. «r = 3m»). */
  circles: { cx: number; cy: number; r: number; label: string }[];
  /** Asse di simmetria (Simmetrico). */
  axis: { x1: number; y1: number; x2: number; y2: number } | null;
  /** Linee guida libere (griglia aurea). */
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  /** Spirale aurea (polilinea, solo anteprima). */
  spiral: Vec2[];
}

export interface GenerateResult {
  geometry: DocumentGeometry;
  report: GenerateReport;
  guides: GenerateGuides;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Valori di base (approvati da Marco il 18/11/2026; dal 19/11 nessun limite di somiglianza: la
 * ricostruzione è canonica, docs/GENERA.md §0).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma stabile per chi la usa
export function generateDefaults(_geom: DocumentGeometry): GenerateOptions {
  return {
    strength: 1,
    maxDeviation: null,
    math: {
      angle: 15,
      module: null,
      half: true,
      rules: { angles: true, radii: true, positions: true },
    },
    minimal: { level: 'strong', maxAnchors: null },
    symmetric: { axis: 'auto', keep: 'auto' },
    golden: {
      ratio: 'phi',
      half: false,
      rules: { radii: true, grid: true, thickness: true, box: false },
      spiral: true,
    },
  };
}

const LEVEL_TOL: Record<MinimalLevel, number> = { light: 0.004, medium: 0.008, strong: 0.015 };

/** Fonde i tracciati elaborati con quelli scartati dalla normalizzazione (stessi id, stesso ordine). */
function merge(geom: DocumentGeometry, paths: PathData[]): DocumentGeometry {
  const byId = new Map(paths.map((p) => [p.id, p]));
  return { ...geom, paths: geom.paths.map((p) => byId.get(p.id) ?? p) };
}

/** Sfuma i nodi da `a` a `b` (stessa struttura) con intensità s. */
function blend(a: PathData[], b: PathData[], s: number): PathData[] {
  return a.map((pa, i) => {
    const pb = b[i]!;
    const wa = toNodes(pa);
    const wb = toNodes(pb);
    if (wa.nodes.length !== wb.nodes.length) return s >= 1 ? pb : pa;
    const mix = (u: { x: number; y: number }, v: { x: number; y: number }) => ({
      x: u.x + (v.x - u.x) * s,
      y: u.y + (v.y - u.y) * s,
    });
    wa.nodes.forEach((n, k) => {
      const m = wb.nodes[k]!;
      n.p = mix(n.p, m.p);
      n.hin = mix(n.hin, m.hin);
      n.hout = mix(n.hout, m.hout);
    });
    return fromNodes(wa);
  });
}

export function generate(
  geom: DocumentGeometry,
  mode: GenerateMode,
  opts: GenerateOptions,
): GenerateResult {
  const D = normalizeGeometry(geom.paths).D || 1;
  const canon = opts.maxDeviation === null;
  const limit = canon ? Infinity : Math.max(0, opts.maxDeviation!);
  const notes: GenerateNote[] = [];
  const within = (g: DocumentGeometry) => driftStats(g, geom).max <= limit + 1e-9;

  // 0. si parte dal logo corretto (se la correzione stessa resta entro lo scarto)
  const corrected = refine(geom, refineDefaults(geom).options).geometry;
  const start = within(corrected) ? corrected : geom;
  const base = normalizeGeometry(start.paths).paths;

  let out: DocumentGeometry = start;
  let strengthUsed = 0;
  const report = {
    angles: 0,
    radii: 0,
    positions: 0,
    module: 0,
    division: 1,
    smallShapes: 0,
    arcCurves: 0,
    arcs: 0,
    thickness: 0,
    boxed: false,
  };
  let guides: GenerateGuides = { grid: null, circles: [], axis: null, lines: [], spiral: [] };

  if (canon && (mode === 'golden' || mode === 'math' || mode === 'structured')) {
    const r = canonical(start, mode, opts, D);
    if (r) {
      out = r.geometry;
      strengthUsed = 1;
      Object.assign(report, r.counts);
      guides = r.guides;
      if (r.changed === 0) notes.push(mode === 'golden' ? 'no-golden' : 'nothing-to-do');
    } else notes.push('unchanged');
  } else if (mode === 'math') {
    const a = analyze(start);
    const auto = a.specs.unitX ?? Math.max(0.5, Math.round((D / 24) * 2) / 2);
    const module = opts.math.module && opts.math.module > 0 ? opts.math.module : auto;
    const bb = bboxOf(base);
    const origin = { x: bb.x, y: bb.y };
    const circles = a.circles.filter((c) => c.approx === undefined);
    // passo: il più largo (m/2, poi m/4, m/8…) con cui la regola piena resta entro lo scarto
    const first = opts.math.half ? 2 : 1;
    const divisions = [first, first * 2, first * 4, first * 8];
    const at = (paths: PathData[], s: number) => merge(start, blend(base, paths, s));
    let full = mathCompose(base, circles, opts.math, origin, module / first, D, 0.8 * limit);
    let division = first;
    for (const dv of divisions) {
      const r = mathCompose(base, circles, opts.math, origin, module / dv, D, 0.8 * limit);
      full = r;
      division = dv;
      if (within(at(r.paths, 1))) break;
    }
    const step = module / division;
    // intensità: la più alta (fino a quella chiesta) che resta entro lo scarto massimo
    const wanted = Math.max(0, Math.min(1, opts.strength));
    let s = wanted;
    if (!within(at(full.paths, s))) {
      let lo = 0;
      let hi = s;
      for (let k = 0; k < 8; k++) {
        const m = (lo + hi) / 2;
        if (within(at(full.paths, m))) lo = m;
        else hi = m;
      }
      s = lo;
      notes.push(s > 0.02 ? 'strength-reduced' : 'unchanged');
      if (s <= 0.02) s = 0;
    }
    if (full.skipped > 0 && s > 0) notes.push('angles-skipped');
    strengthUsed = round(s, 3);
    out = at(full.paths, s);
    if (s > 0) {
      report.angles = full.angles;
      report.radii = full.radii;
      report.positions = full.positions;
    }
    report.division = division;
    report.module = round(module, 3);
    guides = {
      grid: { x: bb.x, y: bb.y, width: bb.width, height: bb.height, step },
      circles: full.circles.map((c) => ({
        cx: c.cx,
        cy: c.cy,
        r: c.r,
        label: `r = ${round(c.r / module, 2)}m`,
      })),
      axis: null,
      lines: [],
      spiral: [],
    };
  } else if (mode === 'golden') {
    const a = analyze(start);
    const bb = bboxOf(base);
    const circles = a.circles.filter((c) => c.approx === undefined);
    const full = goldenCompose(base, circles, opts.golden, bb, 0.8 * limit);
    const changed = full.radii + full.positions + full.thickness + (full.boxed ? 1 : 0);
    const at = (s: number) => merge(start, blend(base, full.paths, s));
    let s = Math.max(0, Math.min(1, opts.strength));
    if (changed === 0) {
      s = 0;
      notes.push('no-golden');
    } else if (!within(at(s))) {
      let lo = 0;
      let hi = s;
      for (let k = 0; k < 8; k++) {
        const m = (lo + hi) / 2;
        if (within(at(m))) lo = m;
        else hi = m;
      }
      s = lo > 0.02 ? lo : 0;
      notes.push(s > 0 ? 'strength-reduced' : 'unchanged');
    }
    strengthUsed = round(s, 3);
    out = s > 0 ? at(s) : start;
    if (s > 0) {
      report.radii = full.radii;
      report.positions = full.positions;
      report.thickness = full.thickness;
      report.boxed = full.boxed;
    }
    guides = {
      grid: null,
      circles: full.circles,
      axis: null,
      lines: full.lines,
      spiral: opts.golden.spiral && opts.golden.ratio === 'phi' ? goldenSpiral(bb) : [],
    };
  } else if (mode === 'symmetric') {
    // simmetria sulle forme (la stessa di CORREGGI, con la tolleranza = scarto massimo)
    const strength = Math.max(0, Math.min(1, opts.strength));
    const ro = refineDefaults(start).options;
    // canonico: si riflette sempre, rispetto all'asse più plausibile e dalla metà più pulita; solo il
    // riflesso, senza le altre correzioni di CORREGGI (che sul risultato riflesso fanno danni)
    const keep = opts.symmetric.keep;
    if (canon) {
      const ps = normalizeGeometry(start.paths).paths;
      const vs =
        keep === 'left' || keep === 'right'
          ? [true]
          : keep === 'top' || keep === 'bottom'
            ? [false]
            : opts.symmetric.axis === 'vertical'
              ? [true]
              : opts.symmetric.axis === 'horizontal'
                ? [false]
                : [true, false];
      let ax: ReturnType<typeof findMirrorAxis> = null;
      for (const v of vs) {
        const x = findMirrorAxis(ps, v);
        if (x && (!ax || x.mismatch < ax.mismatch)) ax = x;
      }
      if (ax && strength > 0) {
        const side = keep === 'auto' ? autoKeep(ps, ax) : keep;
        const m = mirrorHalf(ps, ax, side);
        out = merge(start, m.paths);
        strengthUsed = 1;
        if (m.skipped > 0) notes.push('partial');
        const bb = bboxOf(normalizeGeometry(out.paths).paths);
        const mg = 0.06 * Math.max(bb.width, bb.height);
        guides.axis = ax.vertical
          ? { x1: ax.c, y1: bb.y - mg, x2: ax.c, y2: bb.y + bb.height + mg }
          : { x1: bb.x - mg, y1: ax.c, x2: bb.x + bb.width + mg, y2: ax.c };
      } else notes.push('no-axis');
    }
    const r =
      !canon && strength > 0
        ? refine(start, {
            ...ro,
            symmetry: {
              enabled: true,
              tolerance: canon ? 0.25 * D : Math.max(1e-6, limit),
              axis: opts.symmetric.axis,
              keep,
            },
          })
        : null;
    if (canon) {
      // già fatto sopra
    } else if (r && r.report.axis && within(r.geometry)) {
      out = r.geometry;
      strengthUsed = 1;
      if (r.report.symmetryNote === 'partial') notes.push('partial');
      const bb = bboxOf(normalizeGeometry(out.paths).paths);
      const m = 0.06 * Math.max(bb.width, bb.height);
      const { theta, rho } = r.report.axis;
      guides.axis =
        Math.abs(theta) < 1e-9
          ? { x1: rho, y1: bb.y - m, x2: rho, y2: bb.y + bb.height + m }
          : { x1: bb.x - m, y1: rho, x2: bb.x + bb.width + m, y2: rho };
    } else notes.push('no-axis');
  } else if (mode === 'structured') {
    const strength = Math.max(0, Math.min(1, opts.strength));
    // si parte dall'originale: gli archi di CORREGGI non sono per forza tangenti tra loro, qui invece
    // la catena di archi deve esserlo
    const a = analyze(geom);
    const obase = normalizeGeometry(geom.paths).paths;
    const covered = new Set<string>();
    for (const c of a.circles)
      if (c.approx === undefined) for (const r of c.refs) covered.add(`${r.pathId}:${r.index}`);
    for (const e of a.ellipses) for (const r of e.refs) covered.add(`${r.pathId}:${r.index}`);
    const tol = Math.min(0.8 * limit, (0.002 + 0.006 * strength) * D);
    const res = strength > 0 && tol > 0 ? structureCompose(obase, covered, tol, D) : null;
    if (res && res.curves > 0 && within(merge(geom, res.paths))) {
      out = merge(geom, res.paths);
      strengthUsed = strength;
      report.arcCurves = res.curves;
      report.arcs = res.circles.length;
      guides.circles = res.circles.map((c) => ({
        cx: c.cx,
        cy: c.cy,
        r: c.r,
        label: `r = ${round(c.r, 1)} pt`,
      }));
    }
    if (!res || res.curves === 0) notes.push('nothing-to-do');
    if (res && res.skipped > 0) notes.push('curves-skipped');
  } else {
    // livelli di semplificazione crescenti; si tiene il più semplice che resta entro lo scarto
    const levels = [LEVEL_TOL[opts.minimal.level]];
    if (opts.minimal.maxAnchors !== null) levels.push(0.02, 0.03, 0.045);
    const strength = Math.max(0, Math.min(1, opts.strength));
    // si parte dalla versione con meno anchor (la correzione può aggiungerne, es. per la simmetria)
    const source = anchorCount(start) <= anchorCount(geom) ? start : geom;
    const mbase = normalizeGeometry(source.paths).paths;
    let best: DocumentGeometry | null = null;
    for (const f of levels) {
      if (strength <= 0) break;
      const simple = minimalCompose(mbase, f * D * strength, D);
      let g = merge(source, simple);
      // curve quasi circolari → archi, quasi rette → rette (soglie più larghe di CORREGGI)
      const ro = refineDefaults(g).options;
      const tol = round(0.015 * D * strength, 3);
      g = refine(g, {
        ...ro,
        arcs: { enabled: true, tolerance: tol },
        ellipses: { ...ro.ellipses, enabled: false },
        radii: { ...ro.radii, enabled: false },
        centers: { ...ro.centers, enabled: false },
        align: { ...ro.align, enabled: false },
        symmetry: { ...ro.symmetry, enabled: false },
        grid: { ...ro.grid, enabled: false },
      }).geometry;
      // la correzione finale non deve aggiungere anchor né sforare lo scarto
      if (!within(g) || anchorCount(g) > anchorCount(merge(source, simple))) {
        if (!within(merge(source, simple))) break;
        g = merge(source, simple);
      }
      best = g;
      if (opts.minimal.maxAnchors === null || anchorCount(g) <= opts.minimal.maxAnchors) break;
    }
    if (best) {
      out = best;
      strengthUsed = strength;
    } else notes.push('unchanged');
    if (opts.minimal.maxAnchors !== null && anchorCount(out) > opts.minimal.maxAnchors)
      notes.push('max-anchors-not-reached');
    for (const p of base) {
      const b = bboxOf([p]);
      if (b.D < 0.03 * D) report.smallShapes++;
    }
  }

  const ds = driftStats(out, geom);
  return {
    geometry: out,
    report: {
      mode,
      similarity: round(Math.max(0, 100 - (100 * ds.mean) / D), 1),
      drift: round(ds.max, 3),
      strengthUsed,
      canonical: canon,
      anchorsBefore: anchorCount(geom),
      anchorsAfter: anchorCount(out),
      ...report,
      notes,
    },
    guides,
  };
}

const PHI = (1 + Math.sqrt(5)) / 2;

/** Raggruppa valori vicini (rapporto entro `ratio`) e restituisce la media del gruppo di ciascuno. */
function clusterValues(values: number[], ratio: number): (v: number) => number {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of sorted) {
    const g = groups[groups.length - 1];
    if (g && v / g[0]! <= ratio) g.push(v);
    else groups.push([v]);
  }
  const means = groups.map((g) => ({
    lo: g[0]!,
    hi: g[g.length - 1]!,
    m: g.reduce((a, b) => a + b, 0) / g.length,
  }));
  return (v) => means.find((g) => v >= g.lo - 1e-9 && v <= g.hi + 1e-9)?.m ?? v;
}

/**
 * GENERA canonico (docs/GENERA.md §0): costruzione (rette, archi, raccordi) + risolutore. Il logo
 * diventa esattamente conforme alla regola, anche se cambia molto.
 */
function canonical(
  start: DocumentGeometry,
  mode: 'golden' | 'math' | 'structured',
  opts: GenerateOptions,
  D: number,
): {
  geometry: DocumentGeometry;
  counts: Partial<GenerateReport>;
  guides: GenerateGuides;
  changed: number;
} | null {
  const a = analyze(start);
  const paths = normalizeGeometry(start.paths).paths;
  const bb = bboxOf(paths);
  const k = toConstruction(
    paths,
    a.circles.filter((c) => c.approx === undefined),
    D,
    0.006 * D,
  );
  const before = k.ctr.map((c) => ({ ...c.c, r: c.r }));
  const anglesBefore = lineAngles(k);
  const radii = k.ctr.map((c) => c.r);
  const nearest = (v: number, list: number[]) =>
    list.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b), list[0]!);
  const inBox = (c: { x: number; y: number }, m: number) =>
    c.x >= bb.x - m && c.x <= bb.x + bb.width + m && c.y >= bb.y - m && c.y <= bb.y + bb.height + m;
  let rules: CanonRules;
  let guides: GenerateGuides = { grid: null, circles: [], axis: null, lines: [], spiral: [] };
  let label: (r: number) => string = (r) => `r = ${round(r, 1)} pt`;
  let module = 0;
  if (mode === 'golden') {
    const g = opts.golden;
    const q = RATIO[g.ratio];
    // riferimento: il cerchio intero più grande; se non ce n'è, l'arco più grande non quasi piatto
    const fullR = k.ctr.filter((c) => c.full).map((c) => c.r);
    const R = fullR.length ? Math.max(...fullR) : Math.max(0, ...radii.filter((r) => r <= 0.6 * D));
    const fr = gridFractions(q);
    const xs = fr.map((f) => bb.x + f * bb.width);
    const ys = fr.map((f) => bb.y + f * bb.height);
    const angStep = Math.PI / 10; // 18°: la famiglia dei triangoli aurei
    rules = {
      radius: g.rules.radii
        ? (r) => {
            if (R <= 0 || r > 0.6 * D) return r; // archi quasi piatti: quasi rette, raggio libero
            if (q <= 1 + 1e-9) return R;
            const e = Math.log(R / r) / Math.log(q);
            const kk = g.half ? Math.round(e * 2) / 2 : Math.round(e);
            return R / q ** Math.max(0, kk);
          }
        : undefined,
      angle: (t) => (Math.round(t / angStep) * angStep) % Math.PI,
      center: g.rules.grid
        ? (c, full) =>
            full && inBox(c, 0.1 * Math.max(bb.width, bb.height))
              ? { x: nearest(c.x, xs), y: nearest(c.y, ys) }
              : null
        : undefined,
      axisLine: g.rules.grid ? (v, vertical) => nearest(v, vertical ? xs : ys) : undefined,
    };
    const sym = { phi: 'φ', sqrt2: '√2', '3:2': '1,5', '1:1': '1' }[g.ratio];
    const sup = ['', '', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    label = (r) => {
      if (q <= 1 + 1e-9 || R <= 0) return 'R';
      const e = Math.round((Math.log(R / r) / Math.log(q)) * 2) / 2;
      if (e === 0) return 'R';
      if (Number.isInteger(e)) return e === 1 ? `R/${sym}` : `R/${sym}${sup[e] ?? `^${e}`}`;
      return `R/${sym}^${String(e).replace('.', ',')}`;
    };
    guides = {
      grid: null,
      circles: [],
      axis: null,
      lines: [
        ...xs.map((x) => ({ x1: x, y1: bb.y, x2: x, y2: bb.y + bb.height })),
        ...ys.map((y) => ({ x1: bb.x, y1: y, x2: bb.x + bb.width, y2: y })),
      ],
      spiral: g.spiral && g.ratio === 'phi' ? goldenSpiral(bb) : [],
    };
    void PHI;
  } else if (mode === 'math') {
    const auto = a.specs.unitX ?? Math.max(0.5, Math.round((D / 24) * 2) / 2);
    module = opts.math.module && opts.math.module > 0 ? opts.math.module : auto;
    const step = opts.math.half ? module / 2 : module;
    const snap = (v: number, o: number) => o + Math.round((v - o) / step) * step;
    const base = (opts.math.angle * Math.PI) / 180;
    rules = {
      radius: opts.math.rules.radii
        ? (r) => Math.max(step, Math.round(r / step) * step)
        : undefined,
      angle: opts.math.rules.angles ? (t) => (Math.round(t / base) * base) % Math.PI : undefined,
      center: opts.math.rules.positions
        ? (c) => ({ x: snap(c.x, bb.x), y: snap(c.y, bb.y) })
        : undefined,
      axisLine: opts.math.rules.positions
        ? (v, vertical) => snap(v, vertical ? bb.x : bb.y)
        : undefined,
      corner: opts.math.rules.positions
        ? (p) => ({ x: snap(p.x, bb.x), y: snap(p.y, bb.y) })
        : undefined,
    };
    label = (r) => `r = ${round(r / module, 2)}m`;
    guides = {
      grid: { x: bb.x, y: bb.y, width: bb.width, height: bb.height, step },
      circles: [],
      axis: null,
      lines: [],
      spiral: [],
    };
  } else {
    // strutturato: raggi simili (entro l'8%) unificati, raccordi tangenti
    const rr = clusterValues(radii, 1.08);
    rules = { radius: rr };
  }
  solve(k, rules);
  // la rifinitura degli archi può incrinare un raccordo: qualche giro di risolutore e di nuovo
  for (let i = 0; i < 4; i++) {
    finalize(k, rules);
    solve(k, rules, 80);
  }
  finalize(k, rules);
  const out = fromConstruction(k);
  const bad = out.some((p) =>
    p.segments.some((sg) =>
      [sg.p0, sg.p1, ...(sg.kind === 'cubic' ? [sg.c1, sg.c2] : [])].some(
        (v) => !Number.isFinite(v.x) || !Number.isFinite(v.y),
      ),
    ),
  );
  if (bad) return null;
  const circles = constructionCircles(k);
  guides.circles = circles.map((c) => ({ ...c, label: label(c.r) }));
  let radiiChanged = 0;
  let centersMoved = 0;
  k.ctr.forEach((c, i) => {
    if (Math.abs(c.target - before[i]!.r) > 1e-6) radiiChanged++;
    if (Math.hypot(c.c.x - before[i]!.x, c.c.y - before[i]!.y) > 1e-6) centersMoved++;
  });
  const anglesAfter = lineAngles(k);
  let angles = 0;
  anglesAfter.forEach((t, i) => {
    const d = Math.abs(t - anglesBefore[i]!);
    if (Math.min(d, Math.PI - d) > 1e-6) angles++;
  });
  const freeArcs = k.paths.reduce((s, p) => s + p.els.filter((e) => e.kind === 'arc').length, 0);
  return {
    geometry: merge(start, out),
    counts: {
      radii: radiiChanged,
      positions: centersMoved,
      angles,
      arcs: freeArcs,
      // raggi diversi usati dalla costruzione
      arcCurves: new Set(circles.map((c) => Math.round(c.r * 100))).size,
      module: round(module, 3),
      division: opts.math.half ? 2 : 1,
    },
    guides,
    changed: radiiChanged + centersMoved + angles,
  };
}
