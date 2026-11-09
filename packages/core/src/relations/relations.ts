import type { Circle, GuideLine, Relation, Vec2 } from '../model';
import type { Anchor } from '../anchors';
import type { BBox } from '../math';
import { inBand, type Tolerances } from '../tolerance';
import type { FindingCandidate } from '../findings/findings';
import { qualifyingPair, type Row } from '../primitives/rows';
import { round } from '../findings/findings';

export interface RelationInput {
  circles: Circle[];
  lines: GuideLine[];
  anchors: Anchor[];
  rows: { row: Row; lineId?: string }[];
  bbox: BBox;
  D: number;
  tol: Tolerances;
}

const lineDist = (l: GuideLine, p: Vec2) =>
  Math.cos(l.theta) * p.x + Math.sin(l.theta) * p.y - l.rho;

/** §6.6: relazioni vere (ε stretta) e candidati finding (fascia stretta–larga). */
export function findRelations(inp: RelationInput): {
  relations: Relation[];
  candidates: FindingCandidate[];
} {
  const { circles, lines, anchors, tol, bbox, D } = inp;
  const relations: Relation[] = [];
  const candidates: FindingCandidate[] = [];
  const rel = (r: Omit<Relation, 'id'>) =>
    relations.push({ id: `rel${relations.length + 1}`, ...r, error: round(r.error, 6) });
  const ext = {
    x0: bbox.x - 0.25 * D,
    y0: bbox.y - 0.25 * D,
    x1: bbox.x + bbox.width + 0.25 * D,
    y1: bbox.y + bbox.height + 0.25 * D,
  };
  const inside = (p: Vec2) => p.x >= ext.x0 && p.x <= ext.x1 && p.y >= ext.y0 && p.y <= ext.y1;

  // cerchio–cerchio
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i]!;
      const b = circles[j]!;
      const ids = [a.id, b.id];
      const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
      const dr = Math.abs(a.r - b.r);
      if (d < tol.center.strict) {
        rel({ kind: 'concentric', refs: ids, error: d });
      } else if (inBand(d, tol.center)) {
        candidates.push({
          kind: 'near-concentric',
          band: tol.center,
          delta: d,
          unit: 'pt',
          refs: ids,
          scoreRefs: ids,
          params: { a: a.id, b: b.id, delta: round(d, 2) },
        });
      }
      const concentricish = d <= tol.center.wide;
      if (dr < tol.radius.strict) {
        if (!concentricish) rel({ kind: 'equal-radius', refs: ids, error: dr });
      } else if (inBand(dr, tol.radius) && !concentricish) {
        candidates.push({
          kind: 'near-equal-radius',
          band: tol.radius,
          delta: dr,
          unit: 'pt',
          refs: ids,
          scoreRefs: ids,
          params: { a: a.id, b: b.id, ra: round(a.r, 2), rb: round(b.r, 2), delta: round(dr, 2) },
        });
      }
      if (d >= tol.center.strict) {
        const ext_ = Math.abs(d - (a.r + b.r));
        const int_ = Math.abs(d - dr);
        const err = Math.min(ext_, int_);
        // punto di contatto sulla retta dei centri
        const u = { x: (b.cx - a.cx) / d, y: (b.cy - a.cy) / d };
        const sgn = ext_ <= int_ ? 1 : a.r >= b.r ? 1 : -1;
        const at = { x: a.cx + u.x * a.r * sgn, y: a.cy + u.y * a.r * sgn };
        if (err < tol.tangent.strict) {
          rel({
            kind: 'tangent-circle-circle',
            refs: ids,
            error: err,
            at: { x: round(at.x), y: round(at.y) },
          });
        } else if (inBand(err, tol.tangent)) {
          candidates.push({
            kind: 'near-tangent',
            band: tol.tangent,
            delta: err,
            unit: 'pt',
            refs: ids,
            scoreRefs: ids,
            params: { a: a.id, b: b.id, delta: round(err, 2) },
          });
        }
      }
    }
  }

  // retta–cerchio, centro su retta
  for (const l of lines) {
    for (const c of circles) {
      const sd = lineDist(l, { x: c.cx, y: c.cy });
      const err = Math.abs(Math.abs(sd) - c.r);
      const n = { x: Math.cos(l.theta), y: Math.sin(l.theta) };
      const at = { x: c.cx - n.x * sd, y: c.cy - n.y * sd };
      const ids = [l.id, c.id];
      if (err < tol.tangent.strict && inside(at)) {
        rel({
          kind: 'tangent-line-circle',
          refs: ids,
          error: err,
          at: { x: round(at.x), y: round(at.y) },
        });
      } else if (inBand(err, tol.tangent) && inside(at)) {
        candidates.push({
          kind: 'near-tangent',
          band: tol.tangent,
          delta: err,
          unit: 'pt',
          refs: ids,
          scoreRefs: ids,
          params: { a: l.id, b: c.id, delta: round(err, 2) },
        });
      }
      if (Math.abs(sd) < tol.center.strict) {
        rel({ kind: 'center-on-line', refs: [c.id, l.id], error: Math.abs(sd) });
      }
    }
  }

  // centro su anchor
  for (const c of circles) {
    let best: Anchor | null = null;
    let bd = Infinity;
    for (const a of anchors) {
      const d = Math.hypot(a.p.x - c.cx, a.p.y - c.cy);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (best && bd < tol.center.strict)
      rel({ kind: 'center-on-anchor', refs: [c.id, best.id], error: bd });
  }

  // righe e colonne di anchor
  for (const { row, lineId } of inp.rows) {
    if (row.anchors.length < 2 || !qualifyingPair(row.anchors)) continue;
    rel({
      kind: row.kind === 'row' ? 'anchor-row' : 'anchor-column',
      refs: [...(lineId ? [lineId] : []), ...row.anchors.map((a) => a.id)],
      error: row.span,
    });
  }

  return { relations, candidates };
}

/** Coppie di righe vicine (fascia stretta–larga) con anchor qualificati → near-row/near-column. */
export function nearRows(
  rows: { row: Row; lineId?: string }[],
  tol: Tolerances,
): FindingCandidate[] {
  const out: FindingCandidate[] = [];
  for (const kind of ['row', 'column'] as const) {
    const rs = rows.filter((r) => r.row.kind === kind && r.row.anchors.length > 0);
    for (let i = 0; i + 1 < rs.length; i++) {
      const a = rs[i]!;
      const b = rs[i + 1]!;
      const gap = Math.abs(b.row.value - a.row.value);
      if (!inBand(gap, tol.row) || !qualifyingPair(a.row.anchors, b.row.anchors)) continue;
      // l'anchor "fuori riga" sta nel gruppo più piccolo
      const [main, odd] = a.row.anchors.length >= b.row.anchors.length ? [a, b] : [b, a];
      out.push({
        kind: kind === 'row' ? 'near-row' : 'near-column',
        band: tol.row,
        delta: gap,
        unit: 'pt',
        refs: [...odd.row.anchors.map((x) => x.id), ...(main.lineId ? [main.lineId] : [])],
        scoreRefs: main.lineId ? [main.lineId] : [],
        params: {
          value: round(main.row.value, 2),
          off: round(odd.row.value, 2),
          delta: round(gap, 2),
        },
      });
    }
  }
  return out;
}
