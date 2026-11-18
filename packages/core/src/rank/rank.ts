import type { Axis, Circle, Ellipse, GuideLine, Level, Relation } from '../model';
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
  ellipses: Ellipse[] = [],
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
    ...ellipses.map((e) => e.support),
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
  for (const e of ellipses) {
    e.score = score(e.id, e.support / maxSupport, (e.rx + e.ry) / D, 0.3);
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
  ellipses?: Ellipse[];
  lines: GuideLine[];
  axes: Axis[];
  relations: Relation[];
  totalLength: number;
  hasUnit: boolean;
  /** Diagonale del bbox: serve a riconoscere rette e cerchi superflui (senza, nessuna potatura). */
  D?: number;
}

const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
};
/** Distanza tra due rette quasi parallele in forma normale (θ in [0, π)). */
const rhoGap = (a: { theta: number; rho: number }, b: { theta: number; rho: number }) =>
  Math.abs(a.theta - b.theta) > Math.PI / 2 ? Math.abs(a.rho + b.rho) : Math.abs(a.rho - b.rho);

/**
 * Elementi che non aggiungono nulla alla costruzione nei livelli base (restano in «dettaglio» e
 * «tutto»): rette sopra un asse di simmetria, rette parallele quasi coincidenti con una più
 * importante (es. i due bordi di un tratto sottile), cerchi minuscoli (raccordi, punte arrotondate).
 */
function superfluous(inp: LevelInput): Set<string> {
  const out = new Set<string>();
  const D = inp.D;
  if (!D) return out;
  const ANG = (2 * Math.PI) / 180;
  const near = 0.03 * D;
  for (const l of inp.lines)
    if (inp.axes.some((a) => angleGap(a.theta, l.theta) <= ANG && rhoGap(a, l) <= 0.01 * D))
      out.add(l.id);
  const byScore = [...inp.lines].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const kept: GuideLine[] = [];
  for (const l of byScore) {
    if (out.has(l.id)) continue;
    const twin = kept.some((k) => angleGap(k.theta, l.theta) <= ANG && rhoGap(k, l) < near);
    const onAxis = inp.axes.some((a) => angleGap(a.theta, l.theta) <= ANG && rhoGap(a, l) < near);
    if (twin || onAxis) out.add(l.id);
    else kept.push(l);
  }
  for (const c of inp.circles) if (c.r < 0.02 * D) out.add(c.id);
  return out;
}

export const centerMarkerId = (circleId: string) => `m:${circleId}`;
export const tangentMarkerId = (relId: string) => `t:${relId}`;
export const UNIT_ID = 'unit-x';

const TANGENT = new Set(['tangent-line-circle', 'tangent-circle-circle']);

/** §6.10: elementi visibili per livello (cumulativi). */
export function buildLevels(inp: LevelInput): Record<Level, string[]> {
  const { circles, lines, axes, relations, totalLength } = inp;
  const ellipses = inp.ellipses ?? [];
  const skip = superfluous(inp);
  const elems = [...circles, ...ellipses, ...lines].sort(
    (a, b) => b.score - a.score || (a.id < b.id ? -1 : 1),
  );
  const essential: string[] = [];
  let covered = 0;
  let lastScore: number | null = null;
  for (const e of elems) {
    if (e.support <= 0) break;
    if (skip.has(e.id)) continue;
    // raggiunto il 60%, entrano ancora gli elementi a pari merito con l'ultimo incluso
    // (approvato 10/11/2026: es. 4 cerchi uguali del rettangolo arrotondato)
    if (covered >= 0.6 * totalLength && e.score !== lastScore) break;
    essential.push(e.id);
    covered += e.support;
    lastScore = e.score;
  }
  essential.push(...axes.map((a) => a.id));

  // liste ordinate senza doppioni (Set per la verifica: le liste possono avere migliaia di id)
  const list = (init: string[]) => {
    const arr = [...init];
    const seen = new Set(arr);
    return {
      arr,
      has: (id: string) => seen.has(id),
      add: (id: string) => {
        if (!seen.has(id)) {
          seen.add(id);
          arr.push(id);
        }
      },
    };
  };
  const structure = list(essential);
  for (const l of lines)
    if (!skip.has(l.id) && (l.score >= 0.35 || l.origin === 'anchor-row')) structure.add(l.id);
  // tutti i cerchi e gli ovali che descrivono una parte non trascurabile del logo (≥ 2% del
  // contorno): la struttura non deve "dimenticare" cerchi oltre la soglia del 60% dell'essenziale
  for (const c of [...circles, ...ellipses])
    if (!skip.has(c.id) && c.support >= 0.02 * totalLength) structure.add(c.id);
  if (inp.hasUnit) structure.add(UNIT_ID);

  const detail = list(structure.arr);
  for (const l of lines) if (skip.has(l.id) && l.score >= 0.35) detail.add(l.id);
  for (const c of circles) if (skip.has(c.id)) detail.add(c.id);
  for (const c of [...circles, ...ellipses]) if (c.support >= 0.02 * totalLength) detail.add(c.id);
  const markersFor = (l: ReturnType<typeof list>) => {
    for (const c of [...circles, ...ellipses]) if (l.has(c.id)) l.add(centerMarkerId(c.id));
    for (const r of relations) {
      if (TANGENT.has(r.kind) && r.at && r.refs.every((id) => l.has(id))) {
        l.add(tangentMarkerId(r.id));
      }
    }
  };
  markersFor(detail);

  const full = list([
    ...circles.map((c) => c.id),
    ...ellipses.map((e) => e.id),
    ...lines.map((l) => l.id),
    ...axes.map((a) => a.id),
  ]);
  if (inp.hasUnit) full.add(UNIT_ID);
  markersFor(full);

  return { essential, structure: structure.arr, detail: detail.arr, full: full.arr };
}
