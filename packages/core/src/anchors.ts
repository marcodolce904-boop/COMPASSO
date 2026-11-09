import type { PathData, Vec2 } from './model';

export interface Anchor {
  id: string; // a:<pathId>:<indice>
  pathId: string;
  glyph: string; // glyphId, oppure l'id del tracciato
  index: number;
  count: number; // anchor del tracciato
  closed: boolean;
  p: Vec2;
}

export function collectAnchors(paths: PathData[]): Anchor[] {
  const out: Anchor[] = [];
  for (const path of paths) {
    const pts = path.segments.map((s) => s.p0);
    const last = path.segments[path.segments.length - 1];
    if (!path.closed && last) pts.push(last.p1);
    pts.forEach((p, index) =>
      out.push({
        id: `a:${path.id}:${index}`,
        pathId: path.id,
        glyph: path.glyphId ?? path.id,
        index,
        count: pts.length,
        closed: path.closed,
        p,
      }),
    );
  }
  return out;
}

/** Due anchor consecutivi dello stesso tracciato (estremi dello stesso segmento). */
export function adjacent(a: Anchor, b: Anchor): boolean {
  if (a.pathId !== b.pathId) return false;
  const d = Math.abs(a.index - b.index);
  return d === 1 || (a.closed && d === a.count - 1);
}
