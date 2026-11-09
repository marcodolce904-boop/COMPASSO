import type { AnalysisResult, ConstructionPlan, DrawStyle, Level, Primitive } from '../model';
import { clipLine } from '../primitives/lines';
import { UNIT_ID, centerMarkerId, tangentMarkerId } from '../rank/rank';

export const LAYER_NAME = 'Compasso — Construction';
/** Margine dell'estensione delle rette: 12,5% per lato, cioè bbox + 25% [DA CALIBRARE]. */
const EXTENT_MARGIN = 0.125;

export interface PlanOptions {
  level: Level;
  style: DrawStyle;
  include?: string[];
  exclude?: string[];
  clearspace?: { enabled: boolean; multiplier: number };
}

/**
 * §6.11: trasforma il risultato dell'analisi in primitive da disegnare. `include` ed
 * `exclude` hanno la precedenza sul livello.
 */
export function plan(result: AnalysisResult, opts: PlanOptions): ConstructionPlan {
  const visible = new Set(result.levels[opts.level]);
  for (const id of opts.include ?? []) visible.add(id);
  for (const id of opts.exclude ?? []) visible.delete(id);

  const b = result.specs.bbox;
  const m = EXTENT_MARGIN * Math.max(b.width, b.height);
  // 'artboard': AnalysisResult non contiene la tavola; per ora si usa il bbox esteso.
  const extent = { x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m };
  const out: Primitive[] = [];

  for (const c of result.circles) {
    if (visible.has(c.id))
      out.push({ type: 'circle', id: c.id, cx: c.cx, cy: c.cy, r: c.r, group: 'circles' });
  }
  for (const l of result.lines) {
    if (!visible.has(l.id)) continue;
    const seg = clipLine(l.theta, l.rho, extent);
    if (seg) out.push({ type: 'line', id: l.id, a: seg[0], b: seg[1], group: 'lines' });
  }
  for (const a of result.axes) {
    if (!visible.has(a.id)) continue;
    const seg = clipLine(a.theta, a.rho, extent);
    if (seg) out.push({ type: 'line', id: a.id, a: seg[0], b: seg[1], group: 'axes' });
  }
  for (const c of result.circles) {
    if (visible.has(centerMarkerId(c.id)) && visible.has(c.id)) {
      out.push({
        type: 'marker',
        id: centerMarkerId(c.id),
        at: { x: c.cx, y: c.cy },
        shape: 'cross',
        group: 'markers',
      });
    }
  }
  for (const r of result.relations) {
    const id = tangentMarkerId(r.id);
    if (r.at && visible.has(id) && r.refs.every((x) => visible.has(x))) {
      out.push({ type: 'marker', id, at: r.at, shape: 'square', group: 'markers' });
    }
  }
  const x = result.specs.unitX;
  if (x !== null && visible.has(UNIT_ID)) {
    out.push({
      type: 'unit',
      id: UNIT_ID,
      x: b.x - 1.5 * x,
      y: b.y - 1.5 * x,
      size: x,
      label: 'x',
      group: 'specs',
    });
  }
  if (x !== null && opts.clearspace?.enabled) {
    const k = opts.clearspace.multiplier * x;
    const r = { x: b.x - k, y: b.y - k, w: b.width + 2 * k, h: b.height + 2 * k };
    out.push({ type: 'rect', id: 'clearspace', ...r, dashed: true, group: 'specs' });
    const corners = [
      [r.x, r.y],
      [r.x + r.w - x, r.y],
      [r.x, r.y + r.h - x],
      [r.x + r.w - x, r.y + r.h - x],
    ] as const;
    corners.forEach(([cx, cy], i) =>
      out.push({
        type: 'unit',
        id: `clearspace-x${i + 1}`,
        x: cx,
        y: cy,
        size: x,
        label: 'x',
        group: 'specs',
      }),
    );
  }
  return { layerName: LAYER_NAME, style: opts.style, primitives: out };
}
