// GENERA (docs/GENERA.md): versioni del logo ricomposte secondo una regola, entro uno scarto massimo.

import type { DocumentGeometry, PathData } from '../model';
import { analyze } from '../analyze';
import { normalizeGeometry } from '../normalize';
import { refine, refineDefaults } from '../fix/refine';
import { anchorCount, bboxOf, driftStats, toNodes, fromNodes } from './geometry';
import { mathCompose, type MathOptions } from './math';
import { minimalCompose } from './minimal';
import { structureCompose } from './structured';
import type { MirrorKeep } from '../fix/mirror';
import type { SymmetryAxis } from '../fix/refine';

export type GenerateMode = 'math' | 'minimal' | 'symmetric' | 'structured';
export type MinimalLevel = 'light' | 'medium' | 'strong';

export interface GenerateOptions {
  /** 0 = logo corretto, 1 = regola piena. */
  strength: number;
  /** Scarto massimo dall'originale, in pt (di base il 3% della diagonale del logo). */
  maxDeviation: number;
  math: MathOptions;
  minimal: { level: MinimalLevel; maxAnchors: number | null };
  /** Simmetrico: asse e metà da tenere (come in CORREGGI). */
  symmetric: { axis: SymmetryAxis; keep: 'auto' | MirrorKeep };
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
  | 'curves-skipped';

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
  notes: GenerateNote[];
}

export interface GenerateGuides {
  /** Griglia del modulo (Matematico). */
  grid: { x: number; y: number; width: number; height: number; step: number } | null;
  /** Cerchi di costruzione con il raggio in moduli (es. «r = 3m»). */
  circles: { cx: number; cy: number; r: number; label: string }[];
  /** Asse di simmetria (Simmetrico). */
  axis: { x1: number; y1: number; x2: number; y2: number } | null;
}

export interface GenerateResult {
  geometry: DocumentGeometry;
  report: GenerateReport;
  guides: GenerateGuides;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Valori di base (approvati da Marco il 18/11/2026). */
export function generateDefaults(geom: DocumentGeometry): GenerateOptions {
  const D = normalizeGeometry(geom.paths).D || 100;
  return {
    strength: 1,
    maxDeviation: round(0.03 * D, 2),
    math: {
      angle: 15,
      module: null,
      half: true,
      rules: { angles: true, radii: true, positions: true },
    },
    minimal: { level: 'medium', maxAnchors: null },
    symmetric: { axis: 'auto', keep: 'auto' },
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
  const limit = Math.max(0, opts.maxDeviation);
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
  };
  let guides: GenerateGuides = { grid: null, circles: [], axis: null };

  if (mode === 'math') {
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
    };
  } else if (mode === 'symmetric') {
    // simmetria sulle forme (la stessa di CORREGGI, con la tolleranza = scarto massimo)
    const strength = Math.max(0, Math.min(1, opts.strength));
    const ro = refineDefaults(start).options;
    const r =
      strength > 0
        ? refine(start, {
            ...ro,
            symmetry: {
              enabled: true,
              tolerance: Math.max(1e-6, limit),
              axis: opts.symmetric.axis,
              keep: opts.symmetric.keep,
            },
          })
        : null;
    if (r && r.report.axis && within(r.geometry)) {
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
      anchorsBefore: anchorCount(geom),
      anchorsAfter: anchorCount(out),
      ...report,
      notes,
    },
    guides,
  };
}
