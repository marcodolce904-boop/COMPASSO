import type { Segment, Vec2 } from '../model';

/** Matrice affine SVG [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function parseTransform(text: string | undefined): Matrix {
  let m: Matrix = IDENTITY;
  if (!text) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let r: RegExpExecArray | null;
  while ((r = re.exec(text)) !== null) {
    const a = (r[2] as string)
      .split(/[\s,]+/)
      .filter((s) => s !== '')
      .map(Number);
    const g = (i: number, def = 0) =>
      a[i] === undefined || Number.isNaN(a[i]) ? def : (a[i] as number);
    let t: Matrix = IDENTITY;
    switch (r[1]) {
      case 'matrix':
        t = [g(0, 1), g(1), g(2), g(3, 1), g(4), g(5)];
        break;
      case 'translate':
        t = [1, 0, 0, 1, g(0), g(1)];
        break;
      case 'scale':
        t = [g(0, 1), 0, 0, a[1] === undefined ? g(0, 1) : g(1, 1), 0, 0];
        break;
      case 'rotate': {
        const ang = (g(0) * Math.PI) / 180;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        t = [c, s, -s, c, 0, 0];
        if (a.length >= 3) {
          t = multiply(multiply([1, 0, 0, 1, g(1), g(2)], t), [1, 0, 0, 1, -g(1), -g(2)]);
        }
        break;
      }
      case 'skewX':
        t = [1, 0, Math.tan((g(0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan((g(0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = multiply(m, t);
  }
  return m;
}

export function applyToPoint(m: Matrix, p: Vec2): Vec2 {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** Una trasformazione affine manda cubiche in cubiche: basta trasformare i punti. */
export function applyToSegment(m: Matrix, s: Segment): Segment {
  if (s.kind === 'line')
    return { kind: 'line', p0: applyToPoint(m, s.p0), p1: applyToPoint(m, s.p1) };
  return {
    kind: 'cubic',
    p0: applyToPoint(m, s.p0),
    c1: applyToPoint(m, s.c1),
    c2: applyToPoint(m, s.c2),
    p1: applyToPoint(m, s.p1),
  };
}
