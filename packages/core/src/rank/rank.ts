import type { Axis, Circle, GuideLine, Level, Relation } from '../model';
import type { BBox } from '../math';
import { clipLine } from '../primitives/lines';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * §6.10: score = 0,45·supporto + 0,20·relazioni + 0,15·dimensione + 0,20·bonus.
 * Modifica `score` in place e restituisce una mappa id → score.
 */
export function scoreElements(
  circles: Circle[],
  lines: GuideLine[],
  axes: Axis[],
  relations: Relation[],
  bbox: BBox,
  D: number,
): Map<string, number> {
  const relCount = new Map<string, number>();
  const has = new Map<string, Set<string>>();
  for (const r of relations) {
    for (const id of r.refs) {
      relCount.set(id, (relCount.get(id) ?? 0) + 1);
      let s = has.get(id);
      if (!s) has.set(id, (s = new Set()));
      s.add(r.kind);
    }
  }
  const maxSupport = Math.max(
    1e-12,
    ...circles.map((c) => c.support),
    ...lines.map((l) => l.support),
  );
  const lengthIn = (theta: number, rho: number) => {
    const seg = clipLine(theta, rho, bbox);
    return seg ? Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y) : 0;
  };
  const scores = new Map<string, number>();
  const score = (id: string, support: number, size: number, bonus: number) => {
    const s =
      0.45 * clamp01(support) +
      0.2 * (Math.min(relCount.get(id) ?? 0, 5) / 5) +
      0.15 * clamp01(size) +
      0.2 * clamp01(bonus);
    const r = Math.round(s * 1e4) / 1e4;
    scores.set(id, r);
    return r;
  };
  for (const c of circles) {
    const kinds = has.get(c.id) ?? new Set();
    const bonus = (kinds.has('equal-radius') ? 0.5 : 0) + (kinds.has('concentric') ? 0.5 : 0);
    c.score = score(c.id, c.support / maxSupport, c.r / (D / 2), bonus);
  }
  for (const l of lines) {
    const bonus = l.orientation === 'h' || l.orientation === 'v' ? 0.3 : 0;
    l.score = score(l.id, l.support / maxSupport, lengthIn(l.theta, l.rho) / D, bonus);
  }
  for (const a of axes) a.score = score(a.id, 1, lengthIn(a.theta, a.rho) / D, 1);
  return scores;
}

export interface LevelInput {
  circles: Circle[];
  lines: GuideLine[];
  axes: Axis[];
  relations: Relation[];
  totalLength: number;
  hasUnit: boolean;
}

export const centerMarkerId = (circleId: string) => `m:${circleId}`;
export const tangentMarkerId = (relId: string) => `t:${relId}`;
export const UNIT_ID = 'unit-x';

const TANGENT = new Set(['tangent-line-circle', 'tangent-circle-circle']);

/** §6.10: elementi visibili per livello (cumulativi). */
export function buildLevels(inp: LevelInput): Record<Level, string[]> {
  const { circles, lines, axes, relations, totalLength } = inp;
  const elems = [...circles, ...lines].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const essential: string[] = [];
  let covered = 0;
  let lastScore: number | null = null;
  for (const e of elems) {
    if (e.support <= 0) break;
    // raggiunto il 60%, entrano ancora gli elementi a pari merito con l'ultimo incluso
    // (approvato 10/11/2026: es. 4 cerchi uguali del rettangolo arrotondato)
    if (covered >= 0.6 * totalLength && e.score !== lastScore) break;
    essential.push(e.id);
    covered += e.support;
    lastScore = e.score;
  }
  essential.push(...axes.map((a) => a.id));

  const structure = [...essential];
  const addTo = (arr: string[], id: string) => {
    if (!arr.includes(id)) arr.push(id);
  };
  for (const l of lines) if (l.score >= 0.35 || l.origin === 'anchor-row') addTo(structure, l.id);
  if (inp.hasUnit) addTo(structure, UNIT_ID);

  const detail = [...structure];
  for (const c of circles) if (c.support >= 0.02 * totalLength) addTo(detail, c.id);
  const markersFor = (visible: Set<string>, out: string[]) => {
    for (const c of circles) if (visible.has(c.id)) addTo(out, centerMarkerId(c.id));
    for (const r of relations) {
      if (TANGENT.has(r.kind) && r.at && r.refs.every((id) => visible.has(id))) {
        addTo(out, tangentMarkerId(r.id));
      }
    }
  };
  markersFor(new Set(detail), detail);

  const full: string[] = [
    ...circles.map((c) => c.id),
    ...lines.map((l) => l.id),
    ...axes.map((a) => a.id),
  ];
  if (inp.hasUnit) full.push(UNIT_ID);
  markersFor(new Set(full), full);

  return { essential, structure, detail, full };
}
