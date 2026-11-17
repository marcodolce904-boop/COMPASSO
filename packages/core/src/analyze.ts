import type { AnalysisResult, Circle, DocumentGeometry, GuideLine, TolerancePreset } from './model';
import { collectAnchors } from './anchors';
import { detectArcs } from './fit/arcs';
import { normalizeGeometry } from './normalize';
import { tolerances } from './tolerance';
import { canonicalCircles } from './primitives/circles';
import { canonicalEllipses } from './primitives/ellipses';
import { clusterLines, lineSegments, normalForm } from './primitives/lines';
import { buildRows, rowMakesGuide, rowPoints, type Row } from './primitives/rows';
import { findRelations, nearRows } from './relations/relations';
import { findAxes } from './symmetry/symmetry';
import { bboxSpec, radiiSpecs, unitX } from './specs/specs';
import { rankFindings, round, type FindingCandidate } from './findings/findings';
import { buildLevels, scoreElements } from './rank/rank';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Analisi completa (§6): dalla geometria del documento alla costruzione dedotta. */
export function analyze(
  geom: DocumentGeometry,
  opts: { tolerance?: TolerancePreset } = {},
): AnalysisResult {
  const t0 = now();
  const preset = opts.tolerance ?? 'normal';
  const ng = normalizeGeometry(geom.paths);
  const { D, bbox, totalLength, paths } = ng;
  const tol = tolerances(D, preset);
  const glyphOf = new Map(paths.map((p) => [p.id, p.glyphId ?? p.id]));
  const glyph = (id: string) => glyphOf.get(id) ?? id;

  // 1. archi e cerchi
  const { arcs, nearlyStraight, ellipses: foundEllipses } = detectArcs(ng, tol.arc);
  const circles = canonicalCircles(arcs, tol);
  const ellipses = canonicalEllipses(foundEllipses, tol);

  // 2. rette (i quasi-dritti con r > 5·D entrano come corde)
  const extra = nearlyStraight.map((ref) => {
    const s = paths.find((p) => p.id === ref.pathId)!.segments[ref.index]!;
    return { ref, p0: s.p0, p1: s.p1 };
  });
  const segs = lineSegments(paths, tol, extra);
  const clusters = clusterLines(segs, tol);

  // 3. allineamenti di anchor
  const anchors = collectAnchors(paths);
  const points = rowPoints(anchors, circles, D, tol.center.strict);
  const rows: Row[] = [...buildRows(points, 'row', tol), ...buildRows(points, 'column', tol)];
  const rowGuides: GuideLine[] = [];
  const rowLink: {
    row: Row;
    lineId?: string;
    guide?: GuideLine;
    cluster?: (typeof clusters)[number];
  }[] = [];
  for (const row of rows) {
    const theta = row.kind === 'row' ? Math.PI / 2 : 0;
    const existing = clusters.find(
      (c) =>
        Math.abs(c.line.theta - theta) < 1e-9 && Math.abs(c.line.rho - row.value) <= tol.row.strict,
    );
    if (existing) {
      rowLink.push({ row, cluster: existing });
    } else if (rowMakesGuide(row)) {
      const guide: GuideLine = {
        id: '',
        theta,
        rho: row.value,
        orientation: row.kind === 'row' ? 'h' : 'v',
        origin: 'anchor-row',
        support: 0,
        score: 0,
      };
      rowGuides.push(guide);
      rowLink.push({ row, guide });
    } else {
      rowLink.push({ row });
    }
  }

  // id stabili delle rette: segmenti per supporto, poi righe di anchor per posizione
  const segLines = clusters
    .map((c) => c.line)
    .sort((a, b) => b.support - a.support || a.theta - b.theta || a.rho - b.rho);
  rowGuides.sort((a, b) => a.theta - b.theta || a.rho - b.rho);
  const lines = [...segLines, ...rowGuides];
  lines.forEach((l, i) => (l.id = `l${i + 1}`));
  const linkedRows = rowLink.map((r) => {
    const lineId = r.cluster?.line.id ?? r.guide?.id;
    return lineId ? { row: r.row, lineId } : { row: r.row };
  });

  // 4. relazioni, simmetrie
  const { relations, candidates } = findRelations({
    circles,
    lines,
    anchors,
    rows: linkedRows,
    bbox,
    D,
    tol,
  });
  candidates.push(...nearRows(linkedRows, tol));
  const sym = findAxes(paths, anchors, bbox, tol);
  candidates.push(...sym.candidates);

  // 5. near-arc e near-angle
  const arcScoreIds = new Map<string, number>();
  const maxSupport = Math.max(
    1e-12,
    ...circles.map((c) => c.support),
    ...lines.map((l) => l.support),
  );
  for (const a of arcs) {
    if (a.quality !== 'near-arc') continue;
    const id = `arc:${a.pathId}:${a.from}`;
    arcScoreIds.set(id, Math.min(1, a.length / maxSupport));
    candidates.push({
      kind: 'near-arc',
      band: tol.arc,
      delta: a.deviation,
      unit: 'pt',
      refs: a.refs.map((r) => `s:${r.pathId}:${r.index}`),
      scoreRefs: [id],
      params: {
        delta: round(a.deviation, 2),
        r: round(a.r, 2),
        cx: round(a.cx, 2),
        cy: round(a.cy, 2),
      },
    });
  }
  for (const c of clusters) {
    for (const s of c.segs) {
      if (!s.nearAngle) continue;
      candidates.push({
        kind: 'near-angle',
        band: tol.angle,
        delta: s.nearAngle.deviation,
        unit: 'deg',
        refs: [c.line.id, `s:${s.ref.pathId}:${s.ref.index}`],
        scoreRefs: [c.line.id],
        params: {
          angle: round((normalForm(s.phi, s.p0).theta - Math.PI / 2) * (180 / Math.PI), 2),
          target: round((s.nearAngle.target * 180) / Math.PI, 2),
          delta: round((s.nearAngle.deviation * 180) / Math.PI, 2),
        },
      });
    }
  }

  // 6. punteggi, specs, findings, livelli
  const scores = scoreElements(circles, lines, sym.axes, relations, bbox, D, ellipses);
  const concentric = relations
    .filter((r) => r.kind === 'concentric')
    .map((r) => r.refs.map((id) => circles.find((c) => c.id === id)!) as [Circle, Circle]);
  const ux = unitX(segs, glyph, concentric, D, tol);
  const findings = rankFindings(
    candidates as FindingCandidate[],
    (id) => scores.get(id) ?? arcScoreIds.get(id) ?? 0.5,
  );
  const levels = buildLevels({
    circles,
    ellipses,
    lines,
    axes: sym.axes,
    relations,
    totalLength,
    hasUnit: ux.unitX !== null,
  });

  return {
    stats: {
      paths: paths.length,
      anchors: anchors.length,
      circles: circles.length,
      ellipses: ellipses.length,
      lines: lines.length,
      axes: sym.axes.length,
    },
    circles,
    ellipses,
    lines,
    axes: sym.axes,
    relations,
    findings,
    specs: {
      unitX: ux.unitX,
      unitXConfidence: ux.confidence,
      bbox: bboxSpec(bbox),
      ...radiiSpecs(circles, tol),
    },
    levels,
    ...(geom.artboard ? { artboard: { ...geom.artboard } } : {}),
    tolerance: preset,
    durationMs: now() - t0,
  };
}
