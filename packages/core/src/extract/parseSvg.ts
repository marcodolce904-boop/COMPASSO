import type { DocumentGeometry, PathData, Segment, Vec2 } from '../model';
import { KAPPA, arcToCubics, parsePathData, type SubPath } from './pathParser';
import { IDENTITY, applyToSegment, multiply, parseTransform, type Matrix } from './transform';

interface Tag {
  name: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  closing: boolean;
}

function* tags(svg: string): Generator<Tag> {
  const clean = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '');
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const attrs: Record<string, string> = {};
    const ar = /([^\s=>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    while ((a = ar.exec(m[3] as string)) !== null) attrs[a[1] as string] = (a[2] ?? a[3]) as string;
    yield {
      name: (m[2] as string).toLowerCase(),
      attrs,
      closing: m[1] === '/',
      selfClosing: m[4] === '/',
    };
  }
}

const n = (v: string | undefined, def = 0): number => {
  if (v === undefined) return def;
  const x = parseFloat(v);
  return Number.isNaN(x) ? def : x;
};

function ellipseSegments(cx: number, cy: number, rx: number, ry: number): Segment[] {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const P = (x: number, y: number): Vec2 => ({ x, y });
  return [
    {
      kind: 'cubic',
      p0: P(cx + rx, cy),
      c1: P(cx + rx, cy + ky),
      c2: P(cx + kx, cy + ry),
      p1: P(cx, cy + ry),
    },
    {
      kind: 'cubic',
      p0: P(cx, cy + ry),
      c1: P(cx - kx, cy + ry),
      c2: P(cx - rx, cy + ky),
      p1: P(cx - rx, cy),
    },
    {
      kind: 'cubic',
      p0: P(cx - rx, cy),
      c1: P(cx - rx, cy - ky),
      c2: P(cx - kx, cy - ry),
      p1: P(cx, cy - ry),
    },
    {
      kind: 'cubic',
      p0: P(cx, cy - ry),
      c1: P(cx + kx, cy - ry),
      c2: P(cx + rx, cy - ky),
      p1: P(cx + rx, cy),
    },
  ];
}

function rectSubPath(
  x: number,
  y: number,
  w: number,
  h: number,
  rxIn: number,
  ryIn: number,
): SubPath {
  let rx = rxIn;
  let ry = ryIn;
  if (rx > 0 && ry === 0) ry = rx;
  if (ry > 0 && rx === 0) rx = ry;
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  const P = (px: number, py: number): Vec2 => ({ x: px, y: py });
  const segs: Segment[] = [];
  const line = (a: Vec2, b: Vec2) => {
    if (a.x !== b.x || a.y !== b.y) segs.push({ kind: 'line', p0: a, p1: b });
  };
  const arc = (a: Vec2, b: Vec2) => {
    if (rx > 0) segs.push(...arcToCubics(a, rx, ry, 0, false, true, b));
  };
  line(P(x + rx, y), P(x + w - rx, y));
  arc(P(x + w - rx, y), P(x + w, y + ry));
  line(P(x + w, y + ry), P(x + w, y + h - ry));
  arc(P(x + w, y + h - ry), P(x + w - rx, y + h));
  line(P(x + w - rx, y + h), P(x + rx, y + h));
  arc(P(x + rx, y + h), P(x, y + h - ry));
  line(P(x, y + h - ry), P(x, y + ry));
  arc(P(x, y + ry), P(x + rx, y));
  return { segments: segs, closed: true };
}

function polySubPath(points: string, closed: boolean): SubPath | null {
  const v = points
    .split(/[\s,]+/)
    .filter((s) => s !== '')
    .map(Number);
  const pts: Vec2[] = [];
  for (let i = 0; i + 1 < v.length; i += 2) pts.push({ x: v[i] as number, y: v[i + 1] as number });
  if (pts.length < 2) return null;
  const segments: Segment[] = [];
  for (let i = 1; i < pts.length; i++)
    segments.push({ kind: 'line', p0: pts[i - 1] as Vec2, p1: pts[i] as Vec2 });
  if (closed) segments.push({ kind: 'line', p0: pts[pts.length - 1] as Vec2, p1: pts[0] as Vec2 });
  return { segments, closed };
}

/**
 * Legge un SVG (path, circle, rect, ellipse, polygon, polyline) e applica le `transform`
 * degli elementi e dei gruppi. Un elemento con più sotto-tracciati condivide un `glyphId`.
 * Gli id sono deterministici: `e<n>` per elemento, `e<n>.<k>` per sotto-tracciato.
 */
export function parseSvg(svgText: string): DocumentGeometry {
  const paths: PathData[] = [];
  const stack: Matrix[] = [IDENTITY];
  let hidden = 0; // profondità dentro <defs>/<clipPath>/<mask>
  let elementIndex = 0;

  for (const tag of tags(svgText)) {
    const isHidden = ['defs', 'clippath', 'mask', 'symbol'].includes(tag.name);
    if (tag.closing) {
      if (tag.name === 'g' || tag.name === 'svg') stack.pop();
      if (isHidden) hidden--;
      continue;
    }
    const parent = stack[stack.length - 1] as Matrix;
    const m = multiply(parent, parseTransform(tag.attrs['transform']));
    if (isHidden) {
      if (!tag.selfClosing) hidden++;
      continue;
    }
    if (tag.name === 'g' || tag.name === 'svg') {
      if (!tag.selfClosing) stack.push(m);
      continue;
    }
    if (hidden > 0) continue;

    const a = tag.attrs;
    let subs: SubPath[] = [];
    switch (tag.name) {
      case 'path':
        subs = parsePathData(a['d'] ?? '');
        break;
      case 'circle': {
        const r = n(a['r']);
        if (r > 0)
          subs = [{ segments: ellipseSegments(n(a['cx']), n(a['cy']), r, r), closed: true }];
        break;
      }
      case 'ellipse': {
        const rx = n(a['rx']);
        const ry = n(a['ry']);
        if (rx > 0 && ry > 0)
          subs = [{ segments: ellipseSegments(n(a['cx']), n(a['cy']), rx, ry), closed: true }];
        break;
      }
      case 'rect': {
        const w = n(a['width']);
        const h = n(a['height']);
        if (w > 0 && h > 0)
          subs = [rectSubPath(n(a['x']), n(a['y']), w, h, n(a['rx']), n(a['ry']))];
        break;
      }
      case 'polygon':
      case 'polyline': {
        const sp = polySubPath(a['points'] ?? '', tag.name === 'polygon');
        if (sp) subs = [sp];
        break;
      }
      default:
        continue;
    }
    if (subs.length === 0) continue;

    const eid = `e${elementIndex++}`;
    const fill = a['fill'];
    const stroke = a['stroke'];
    const filled = fill !== 'none';
    const stroked = stroke !== undefined && stroke !== 'none';
    subs.forEach((sp, k) => {
      const segments = sp.segments.map((s) => applyToSegment(m, s));
      const pd: PathData = {
        id: subs.length > 1 ? `${eid}.${k}` : eid,
        closed: sp.closed,
        filled,
        stroked,
        segments,
      };
      if (subs.length > 1) pd.glyphId = eid;
      if (stroked && a['stroke-width'] !== undefined) pd.strokeWidth = n(a['stroke-width']);
      paths.push(pd);
    });
  }
  return { source: 'svg', paths, warnings: [] };
}
