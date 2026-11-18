// GENERA · Minimal: lo stesso logo con meno anchor. Ogni contorno viene ricampionato, si tengono gli
// spigoli veri (gli smussi minuscoli diventano spigoli vivi) e ogni tratto tra due spigoli si rifà
// con il minimo di curve entro la tolleranza (lo stesso motore del ricalco).

import type { PathData, Segment, Vec2 } from '../model';
import { corners, fitLoop, fitPiece, resample } from '../trace/fit';
import { dist, samplePaths } from './geometry';

/** Sposta l'estremo di un tratto portandosi dietro la maniglia vicina. */
function setStart(s: Segment, p: Vec2): Segment {
  if (s.kind === 'line') return { ...s, p0: p };
  const dx = p.x - s.p0.x;
  const dy = p.y - s.p0.y;
  return { ...s, p0: p, c1: { x: s.c1.x + dx, y: s.c1.y + dy } };
}
function setEnd(s: Segment, p: Vec2): Segment {
  if (s.kind === 'line') return { ...s, p1: p };
  const dx = p.x - s.p1.x;
  const dy = p.y - s.p1.y;
  return { ...s, p1: p, c2: { x: s.c2.x + dx, y: s.c2.y + dy } };
}

/** Contorno in ordine di percorrenza, a passo costante. */
function outline(p: PathData, step: number): Vec2[] {
  const raw = samplePaths([p], step / 2);
  // samplePaths ripete l'estremo comune tra un tratto e il successivo: via i doppioni
  const pts: Vec2[] = [];
  for (const q of raw) if (!pts.length || dist(pts[pts.length - 1]!, q) > 1e-9) pts.push(q);
  if (p.closed && pts.length > 1 && dist(pts[0]!, pts[pts.length - 1]!) < 1e-9) pts.pop();
  return resample(pts, step, p.closed);
}

/** Rifà un tracciato con il minimo di anchor entro `tol` (pt). */
export function simplifyPath(p: PathData, tol: number, D: number): PathData {
  const step = Math.max(D / 600, 1e-3);
  const pts = outline(p, step);
  if (pts.length < 6) return p;
  // finestra degli spigoli ≈ 1% di D: gli smussi più piccoli contano come spigoli
  const k = Math.max(2, Math.round((0.01 * D) / step));
  const cs = corners(pts, k, (35 * Math.PI) / 180, p.closed);
  const n = pts.length;
  let segs: Segment[] = [];
  if (p.closed && cs.length === 0) segs = fitLoop(pts, tol);
  else {
    const cuts = p.closed ? cs : [0, ...cs.filter((i) => i > 0 && i < n - 1), n - 1];
    const pieces = p.closed ? cuts.length : cuts.length - 1;
    for (let c = 0; c < pieces; c++) {
      const a = cuts[c]!;
      const b = cuts[(c + 1) % cuts.length]!;
      const piece: Vec2[] = [];
      for (let i = a; ; i = (i + 1) % n) {
        piece.push(pts[i]!);
        if (i === b) break;
      }
      if (piece.length < 2) continue;
      const fit = fitPiece(piece, tol, Math.min(k, Math.max(1, Math.floor(piece.length / 3))));
      if (!fit.length) continue;
      // gli estremi restano esattamente sugli spigoli: i pezzi vicini si toccano
      fit[0] = setStart(fit[0]!, pts[a]!);
      fit[fit.length - 1] = setEnd(fit[fit.length - 1]!, pts[b]!);
      segs.push(...fit);
    }
  }
  if (!segs.length) return p;
  // continuità: ogni tratto parte dove finisce il precedente
  for (let i = 1; i < segs.length; i++) segs[i] = setStart(segs[i]!, segs[i - 1]!.p1);
  if (p.closed) segs[segs.length - 1] = setEnd(segs[segs.length - 1]!, segs[0]!.p0);
  return { ...p, segments: segs };
}

export function minimalCompose(paths: PathData[], tol: number, D: number): PathData[] {
  return paths.map((p) => {
    const q = simplifyPath(p, tol, D);
    // si tiene la versione nuova solo se ha davvero meno anchor
    return q.segments.length < p.segments.length ? q : p;
  });
}
