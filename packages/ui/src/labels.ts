import type {
  AnalysisResult,
  Finding,
  GenerateResult,
  GuideLine,
  RefineReport,
} from '@compasso/core';
import { num, t, type Lang, type Params } from './strings';

const deg = (rad: number) => (rad * 180) / Math.PI;

export interface ElementItem {
  id: string;
  name: string;
  score: number;
}
export interface ElementGroups {
  circles: ElementItem[];
  lines: ElementItem[];
  axes: ElementItem[];
  rows: ElementItem[];
}

function orientation(
  lang: Lang,
  l: { orientation?: GuideLine['orientation']; theta: number },
): string {
  const o =
    l.orientation ??
    (Math.abs(l.theta) < 1e-6 ? 'v' : Math.abs(l.theta - Math.PI / 2) < 1e-6 ? 'h' : 'free');
  if (o === 'free') return t(lang, 'orient.free', { a: num(lang, (deg(l.theta) + 90) % 180, 1) });
  return t(lang, `orient.${o}`);
}

const index = (id: string) => id.replace(/^\D+/, '');

/** Elenco degli elementi per gruppi (§4.2 B1): nomi tradotti e punteggio. */
export function elementGroups(r: AnalysisResult, lang: Lang): ElementGroups {
  const rows = r.lines.filter((l) => l.origin === 'anchor-row');
  return {
    circles: [
      ...r.circles.map((c) => ({
        id: c.id,
        name: t(lang, 'el.circle', { n: index(c.id), r: num(lang, c.r, 1) }),
        score: c.score,
      })),
      ...(r.ellipses ?? []).map((e) => ({
        id: e.id,
        name: t(lang, 'el.ellipse', {
          n: index(e.id),
          a: num(lang, 2 * e.rx, 1),
          b: num(lang, 2 * e.ry, 1),
        }),
        score: e.score,
      })),
    ],
    lines: r.lines
      .filter((l) => l.origin !== 'anchor-row')
      .map((l) => ({
        id: l.id,
        name: t(lang, 'el.line', { n: index(l.id), o: orientation(lang, l) }),
        score: l.score,
      })),
    axes: r.axes.map((a) => ({
      id: a.id,
      name: t(lang, 'el.axis', { n: index(a.id), o: orientation(lang, a) }),
      score: a.score,
    })),
    rows: rows.map((l, i) => ({
      id: l.id,
      name: t(lang, 'el.row', {
        n: i + 1,
        c: l.orientation === 'v' ? 'x' : 'y',
        v: num(lang, l.rho, 1),
      }),
      score: l.score,
    })),
  };
}

/** Nome breve di un elemento a partire dall'id (`c3` → «Cerchio 3»). */
export function refLabel(lang: Lang, id: string): string {
  if (/^c\d+$/.test(id)) return t(lang, 'el.ref.circle', { n: index(id) });
  if (/^ax\d+$/.test(id)) return t(lang, 'el.ref.axis', { n: index(id) });
  if (/^l\d+$/.test(id)) return t(lang, 'el.ref.line', { n: index(id) });
  return id;
}

/** Frase leggibile di un finding (§4.2 B2), con numeri nella forma della lingua. */
export function findingMessage(lang: Lang, f: Finding): string {
  const p: Params = {};
  for (const [k, v] of Object.entries(f.params)) {
    if (typeof v === 'number')
      p[k] = num(lang, v, k === 'count' || k === 'theta' ? 0 : k === 'delta' ? 2 : 1);
    else p[k] = refLabel(lang, v);
  }
  if (f.kind === 'near-symmetry') {
    const theta = Number(f.params['theta']);
    const v = num(lang, Number(f.params['rho']), 1);
    p['axis'] =
      theta === 0
        ? t(lang, 'axis.vertical', { v })
        : theta === 90
          ? t(lang, 'axis.horizontal', { v })
          : t(lang, 'axis.oblique', { a: theta });
  }
  return t(lang, f.messageKey as Parameters<typeof t>[1], p);
}

/** Delta del finding con unità: «0.80 pt», «0.73°». */
export function findingDelta(f: Finding): string {
  return f.unit === 'deg' ? `${f.delta.toFixed(2)}°` : `${f.delta.toFixed(2)} ${f.unit}`;
}

/** Riga sotto la miniatura di GENERA: «somiglianza 97% · 64 → 22 anchor». */
export function generateCaption(lang: Lang, r: GenerateResult): string {
  const parts = [t(lang, 'gen.similarity', { n: num(lang, r.report.similarity, 1) })];
  if (r.report.mode === 'minimal' || r.report.anchorsAfter !== r.report.anchorsBefore)
    parts.push(t(lang, 'gen.anchors', { a: r.report.anchorsBefore, b: r.report.anchorsAfter }));
  return parts.join(' · ');
}

/** Riepilogo della versione scelta: cosa ha cambiato, cosa no e perché. */
export function generateSummary(lang: Lang, r: GenerateResult): string {
  const rp = r.report;
  const parts: string[] = [];
  if (rp.canonical && (rp.mode === 'golden' || rp.mode === 'math' || rp.mode === 'structured')) {
    if (rp.arcs) parts.push(t(lang, 'gen.sum.canon', { a: rp.arcs, r: rp.arcCurves }));
    const rk =
      rp.mode === 'math'
        ? 'gen.sum.radii'
        : rp.mode === 'golden'
          ? 'gen.sum.goldenRadii'
          : 'gen.sum.unified';
    if (rp.radii) parts.push(t(lang, rk, { n: rp.radii }));
    if (rp.angles) parts.push(t(lang, 'gen.sum.angles', { n: rp.angles }));
    if (rp.positions && rp.mode !== 'structured')
      parts.push(t(lang, 'gen.sum.canonCenters', { n: rp.positions }));
    if (rp.mode === 'math')
      parts.push(t(lang, 'gen.sum.module', { m: num(lang, rp.module, 2), d: rp.division }));
  } else if (rp.mode === 'math') {
    if (rp.angles) parts.push(t(lang, 'gen.sum.angles', { n: rp.angles }));
    if (rp.radii) parts.push(t(lang, 'gen.sum.radii', { n: rp.radii }));
    if (rp.positions) parts.push(t(lang, 'gen.sum.positions', { n: rp.positions }));
    parts.push(t(lang, 'gen.sum.module', { m: num(lang, rp.module, 2), d: rp.division }));
  } else if (rp.mode === 'golden') {
    if (rp.radii) parts.push(t(lang, 'gen.sum.goldenRadii', { n: rp.radii }));
    if (rp.positions) parts.push(t(lang, 'gen.sum.goldenGrid', { n: rp.positions }));
    if (rp.thickness) parts.push(t(lang, 'gen.sum.goldenThickness', { n: rp.thickness }));
    if (rp.boxed) parts.push(t(lang, 'gen.sum.goldenBox'));
  } else if (rp.mode === 'symmetric') {
    if (!rp.notes.includes('no-axis')) parts.push(t(lang, 'gen.sum.symmetric'));
  } else if (rp.mode === 'structured') {
    if (rp.arcCurves) parts.push(t(lang, 'gen.sum.structured', { n: rp.arcCurves, a: rp.arcs }));
  } else {
    parts.push(t(lang, 'gen.anchors', { a: rp.anchorsBefore, b: rp.anchorsAfter }));
    if (rp.anchorsAfter >= rp.anchorsBefore) parts.push(t(lang, 'gen.sum.alreadyMinimal'));
    if (rp.smallShapes) parts.push(t(lang, 'gen.sum.small', { n: rp.smallShapes }));
  }
  parts.push(t(lang, 'gen.similarity', { n: num(lang, rp.similarity, 1) }));
  for (const n of rp.notes)
    parts.push(t(lang, `gen.note.${n}`, { s: Math.round(rp.strengthUsed * 100) }));
  return parts.join(' · ');
}

/** Riepilogo delle correzioni: «4 archi · 2 allineati · spostamento max 0,97 pt». */
export function fixSummary(lang: Lang, r: RefineReport): string {
  const parts: string[] = [];
  const add = (n: number, key: Parameters<typeof t>[1]) => {
    if (n > 0) parts.push(t(lang, key, { n }));
  };
  add(r.arcs, 'fix.summary.arcs');
  add(r.ellipses, r.ellipses === 1 ? 'fix.summary.ellipse' : 'fix.summary.ellipses');
  add(r.radii, 'fix.summary.radii');
  add(r.centers, 'fix.summary.centers');
  add(r.lines, 'fix.summary.lines');
  add(r.aligned, 'fix.summary.aligned');
  add(r.symmetric, 'fix.summary.symmetric');
  add(r.gridded, 'fix.summary.gridded');
  add(r.smoothed, 'fix.summary.smoothed');
  add(r.removedAnchors, 'fix.summary.removed');
  if (parts.length === 0 || r.changedPaths === 0) return t(lang, 'fix.none');
  parts.push(t(lang, 'fix.summary.shift', { d: num(lang, r.maxShift, 2) }));
  return parts.join(' · ');
}
