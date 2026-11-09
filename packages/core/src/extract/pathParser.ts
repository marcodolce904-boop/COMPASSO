import type { Segment, Vec2 } from '../model';

/** Un sotto-tracciato (da un `M` al successivo). */
export interface SubPath {
  segments: Segment[];
  closed: boolean;
}

/** Costante kappa: rapporto maniglia/raggio per un quarto di cerchio. */
export const KAPPA = 0.5522847498307936;

const ARG_COUNT: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

function tokenize(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
    else out.push(parseFloat(m[2] as string));
  }
  return out;
}

/** Il flag degli archi può essere attaccato al numero successivo ("a1 1 0 01.5 2"): qui è già token. */
export function parsePathData(d: string): SubPath[] {
  const tokens = tokenize(d);
  const subs: SubPath[] = [];
  let cur: SubPath | null = null;
  let pos: Vec2 = { x: 0, y: 0 };
  let start: Vec2 = { x: 0, y: 0 };
  let lastCubicC2: Vec2 | null = null; // per S
  let lastQuadC: Vec2 | null = null; // per T
  let i = 0;
  let cmd = '';

  const ensure = (): SubPath => {
    if (!cur) {
      cur = { segments: [], closed: false };
      subs.push(cur);
    }
    return cur;
  };
  const num = (): number => {
    const t = tokens[i++];
    if (typeof t !== 'number') throw new Error(`Path non valido: numero atteso in "${d}"`);
    return t;
  };
  const finishOpen = () => {
    cur = null;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === 'string') {
      cmd = t;
      i++;
      if (cmd === 'z' || cmd === 'Z') {
        if (cur) {
          const sp: SubPath = cur;
          if (pos.x !== start.x || pos.y !== start.y) {
            sp.segments.push({ kind: 'line', p0: pos, p1: start });
          }
          sp.closed = true;
        }
        pos = start;
        cur = null;
        lastCubicC2 = lastQuadC = null;
        continue;
      }
    } else if (cmd === '') {
      throw new Error('Path non valido: manca il comando iniziale');
    } else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';

    const rel = cmd === cmd.toLowerCase();
    const lc = cmd.toLowerCase();
    if (ARG_COUNT[lc] === undefined) throw new Error(`Comando path sconosciuto: ${cmd}`);
    const ox = rel ? pos.x : 0;
    const oy = rel ? pos.y : 0;

    switch (lc) {
      case 'm': {
        finishOpen();
        pos = { x: ox + num(), y: oy + num() };
        start = pos;
        ensure();
        lastCubicC2 = lastQuadC = null;
        break;
      }
      case 'l':
      case 'h':
      case 'v': {
        const p1: Vec2 =
          lc === 'l'
            ? { x: ox + num(), y: oy + num() }
            : lc === 'h'
              ? { x: ox + num(), y: pos.y }
              : { x: pos.x, y: oy + num() };
        ensure().segments.push({ kind: 'line', p0: pos, p1 });
        pos = p1;
        lastCubicC2 = lastQuadC = null;
        break;
      }
      case 'c': {
        const c1 = { x: ox + num(), y: oy + num() };
        const c2 = { x: ox + num(), y: oy + num() };
        const p1 = { x: ox + num(), y: oy + num() };
        ensure().segments.push({ kind: 'cubic', p0: pos, c1, c2, p1 });
        pos = p1;
        lastCubicC2 = c2;
        lastQuadC = null;
        break;
      }
      case 's': {
        const c1 = lastCubicC2
          ? { x: 2 * pos.x - lastCubicC2.x, y: 2 * pos.y - lastCubicC2.y }
          : pos;
        const c2 = { x: ox + num(), y: oy + num() };
        const p1 = { x: ox + num(), y: oy + num() };
        ensure().segments.push({ kind: 'cubic', p0: pos, c1, c2, p1 });
        pos = p1;
        lastCubicC2 = c2;
        lastQuadC = null;
        break;
      }
      case 'q':
      case 't': {
        let q: Vec2;
        if (lc === 'q') q = { x: ox + num(), y: oy + num() };
        else q = lastQuadC ? { x: 2 * pos.x - lastQuadC.x, y: 2 * pos.y - lastQuadC.y } : pos;
        const p1 = { x: ox + num(), y: oy + num() };
        ensure().segments.push(quadToCubic(pos, q, p1));
        pos = p1;
        lastQuadC = q;
        lastCubicC2 = null;
        break;
      }
      case 'a': {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num() !== 0;
        const sweep = num() !== 0;
        const p1 = { x: ox + num(), y: oy + num() };
        ensure().segments.push(...arcToCubics(pos, rx, ry, rot, large, sweep, p1));
        pos = p1;
        lastCubicC2 = lastQuadC = null;
        break;
      }
    }
  }
  return subs.filter((s) => s.segments.length > 0);
}

export function quadToCubic(p0: Vec2, q: Vec2, p1: Vec2): Segment {
  return {
    kind: 'cubic',
    p0,
    c1: { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
    c2: { x: p1.x + (2 / 3) * (q.x - p1.x), y: p1.y + (2 / 3) * (q.y - p1.y) },
    p1,
  };
}

/**
 * Arco ellittico SVG → cubiche (conversione endpoint → centro, appendice B.2.4 della
 * specifica SVG; poi un segmento per ogni al più 90° di ampiezza).
 */
export function arcToCubics(
  p0: Vec2,
  rxIn: number,
  ryIn: number,
  rotDeg: number,
  large: boolean,
  sweep: boolean,
  p1: Vec2,
): Segment[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if ((p0.x === p1.x && p0.y === p1.y) || rx === 0 || ry === 0) {
    return p0.x === p1.x && p0.y === p1.y ? [] : [{ kind: 'line', p0, p1 }];
  }
  const phi = (rotDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  const x1 = cosP * dx + sinP * dy;
  const y1 = -sinP * dx + cosP * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cosP * cxp - sinP * cyp + (p0.x + p1.x) / 2;
  const cy = sinP * cxp + cosP * cyp + (p0.y + p1.y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dTheta = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const n = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2) - 1e-9));
  const step = dTheta / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (a: number): Vec2 => ({
    x: cx + rx * Math.cos(a) * cosP - ry * Math.sin(a) * sinP,
    y: cy + rx * Math.cos(a) * sinP + ry * Math.sin(a) * cosP,
  });
  const deriv = (a: number): Vec2 => ({
    x: -rx * Math.sin(a) * cosP - ry * Math.cos(a) * sinP,
    y: -rx * Math.sin(a) * sinP + ry * Math.cos(a) * cosP,
  });
  const out: Segment[] = [];
  let a0 = theta1;
  let start = p0;
  for (let i = 0; i < n; i++) {
    const a1 = a0 + step;
    const end = i === n - 1 ? p1 : point(a1);
    const d0 = deriv(a0);
    const d1 = deriv(a1);
    out.push({
      kind: 'cubic',
      p0: start,
      c1: { x: start.x + k * d0.x, y: start.y + k * d0.y },
      c2: { x: end.x - k * d1.x, y: end.y - k * d1.y },
      p1: end,
    });
    start = end;
    a0 = a1;
  }
  return out;
}
