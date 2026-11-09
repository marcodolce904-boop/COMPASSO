import type { Circle, Vec2 } from '../model';
import { adjacent, type Anchor } from '../anchors';
import type { Tolerances } from '../tolerance';

export interface RowPoint {
  p: Vec2;
  anchors: Anchor[]; // anchor reali in questa posizione (vuoto per un estremo di cerchio)
  sources: string[]; // tracciati o cerchi di provenienza
}

export interface Row {
  kind: 'row' | 'column';
  value: number; // y (riga) o x (colonna), media
  span: number;
  points: RowPoint[];
  anchors: Anchor[];
  sources: Set<string>;
}

/**
 * Punti per gli allineamenti (§6.5): anchor reali + estremi dei cerchi (cx ± r, cy ± r),
 * fusi se coincidono nella stessa posizione.
 */
export function rowPoints(
  anchors: Anchor[],
  circles: Circle[],
  D: number,
  mergeDist = 0,
): RowPoint[] {
  const q = Math.max(1e-9, 1e-6 * D);
  const map = new Map<string, RowPoint>();
  const add = (p: Vec2, source: string, anchor?: Anchor) => {
    const key = `${Math.round(p.x / q)}:${Math.round(p.y / q)}`;
    let rp = map.get(key);
    if (!rp) {
      rp = { p, anchors: [], sources: [] };
      map.set(key, rp);
    }
    if (anchor) rp.anchors.push(anchor);
    if (!rp.sources.includes(source)) rp.sources.push(source);
  };
  for (const a of anchors) add(a.p, a.pathId, a);
  // un estremo di cerchio che cade su un anchor (entro ε_c) è lo stesso punto
  const anchorPts = [...map.values()];
  for (const c of circles) {
    for (const p of [
      { x: c.cx + c.r, y: c.cy },
      { x: c.cx - c.r, y: c.cy },
      { x: c.cx, y: c.cy + c.r },
      { x: c.cx, y: c.cy - c.r },
    ]) {
      const hit = anchorPts.find((rp) => Math.hypot(rp.p.x - p.x, rp.p.y - p.y) <= mergeDist);
      if (hit) {
        if (!hit.sources.includes(c.id)) hit.sources.push(c.id);
      } else add(p, c.id);
    }
  }
  return [...map.values()];
}

export function buildRows(points: RowPoint[], kind: 'row' | 'column', tol: Tolerances): Row[] {
  const coord = (p: Vec2) => (kind === 'row' ? p.y : p.x);
  const sorted = [...points].sort((a, b) => coord(a.p) - coord(b.p) || coord2(a.p) - coord2(b.p));
  function coord2(p: Vec2) {
    return kind === 'row' ? p.x : p.y;
  }
  const rows: Row[] = [];
  let cur: RowPoint[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    const vals = cur.map((rp) => coord(rp.p));
    const anchors = cur.flatMap((rp) => rp.anchors);
    rows.push({
      kind,
      value: vals.reduce((a, b) => a + b, 0) / vals.length,
      span: Math.max(...vals) - Math.min(...vals),
      points: cur,
      anchors,
      sources: new Set(cur.flatMap((rp) => rp.sources)),
    });
    cur = [];
  };
  for (const rp of sorted) {
    if (cur.length > 0 && coord(rp.p) - coord(cur[0]!.p) > tol.row.strict) flush();
    cur.push(rp);
  }
  flush();
  return rows;
}

/** Esiste una coppia di anchor da tracciati diversi o non adiacenti (§6.6)? */
export function qualifyingPair(a: Anchor[], b: Anchor[] = a): boolean {
  for (const x of a) for (const y of b) if (x !== y && !adjacent(x, y)) return true;
  return false;
}

/** Una riga diventa retta guida con ≥ 3 punti, ≥ 1 anchor reale e ≥ 2 provenienze. */
export const rowMakesGuide = (r: Row) =>
  r.points.length >= 3 && r.anchors.length >= 1 && r.sources.size >= 2;
