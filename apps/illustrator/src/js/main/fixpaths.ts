import type { DocumentGeometry } from '@compasso/core';
import type { FixPath } from '../../jsx/ilst/fix';

/**
 * Geometria corretta (segmenti) → tracciati per lo script di Illustrator (anchor + maniglie),
 * nello stesso sistema di coordinate del core: lo script li riporta su quelle del documento.
 */
export function toFixPaths(g: DocumentGeometry): FixPath[] {
  return g.paths.map((p) => {
    const segs = p.segments;
    const n = p.closed ? segs.length : segs.length + 1;
    const nodes: FixPath['nodes'] = [];
    for (let i = 0; i < n; i++) {
      const out = i < segs.length ? segs[i] : undefined;
      const inn = p.closed
        ? segs[(i - 1 + segs.length) % segs.length]
        : i > 0
          ? segs[i - 1]
          : undefined;
      const a = out ? out.p0 : inn!.p1;
      const r = out && out.kind === 'cubic' ? out.c1 : a;
      const l = inn && inn.kind === 'cubic' ? inn.c2 : a;
      nodes.push({ a: [a.x, a.y], l: [l.x, l.y], r: [r.x, r.y] });
    }
    return { id: p.id, closed: p.closed, nodes };
  });
}
