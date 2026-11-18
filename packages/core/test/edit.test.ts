import { describe, expect, it } from 'vitest';
import {
  fromEdit,
  insertNode,
  isSmooth,
  moveHandle,
  moveNodes,
  nearestOnPaths,
  parseSvg,
  removeNode,
  toEdit,
  toggleCorner,
  type EditPath,
} from '../src';

const sq = () => toEdit(parseSvg('<svg><path d="M0 0 L100 0 L100 100 L0 100 Z"/></svg>'));
// cerchio r=50 centrato in (50,50), 4 archi
const K = 0.5522847498 * 50;
const circle = () =>
  toEdit(
    parseSvg(
      `<svg><path d="M100 50 C100 ${50 + K} ${50 + K} 100 50 100 C${50 - K} 100 0 ${50 + K} 0 50 C0 ${50 - K} ${50 - K} 0 50 0 C${50 + K} 0 100 ${50 - K} 100 50 Z"/></svg>`,
    ),
  );
const bez = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
  t: number,
) => {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
  };
};
const radius = (paths: EditPath[], t: number) => {
  // punto della prima curva al parametro t, distanza dal centro
  const n = paths[0]!.nodes;
  const p = bez(n[0]!.p, n[0]!.hout, n[1]!.hin, n[1]!.p, t);
  return Math.hypot(p.x - 50, p.y - 50);
};

describe('penna: andata e ritorno', () => {
  it('toEdit → fromEdit conserva la geometria', () => {
    const g = parseSvg(
      '<svg><path d="M0 0 C 10 0 20 10 20 20 L 0 20 Z"/><path d="M0 50 L 50 60" fill="none" stroke="#000"/></svg>',
    );
    expect(fromEdit(toEdit(g), g)).toEqual(g);
  });
});

describe('penna: aggiungere un punto', () => {
  it("su una retta: punto d'angolo, la retta resta retta", () => {
    const { paths, ref } = insertNode(sq(), 0, 0, 0.25);
    expect(ref).toEqual({ path: 0, node: 1 });
    expect(paths[0]!.nodes).toHaveLength(5);
    expect(paths[0]!.nodes[1]!.p).toEqual({ x: 25, y: 0 });
    const g = fromEdit(paths, parseSvg('<svg/>'));
    expect(g.paths[0]!.segments.every((s) => s.kind === 'line')).toBe(true);
  });
  it('su una curva: la forma non cambia (de Casteljau)', () => {
    const before = circle();
    const { paths } = insertNode(before, 0, 0, 0.5);
    expect(paths[0]!.nodes).toHaveLength(5);
    expect(isSmooth(paths[0]!.nodes[1]!)).toBe(true);
    for (const t of [0.2, 0.5, 0.8]) expect(radius(paths, t)).toBeCloseTo(radius(before, t / 2), 6);
  });
});

describe('penna: togliere un punto', () => {
  it('il precedente si collega al successivo', () => {
    const paths = removeNode(sq(), { path: 0, node: 1 });
    expect(paths[0]!.nodes.map((n) => n.p)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
  });
  it('togliere un punto aggiunto su una curva ridà la curva di prima', () => {
    const before = circle();
    const { paths } = insertNode(before, 0, 0, 0.4);
    const back = removeNode(paths, { path: 0, node: 1 });
    expect(back[0]!.nodes).toHaveLength(4);
    for (const t of [0.25, 0.5, 0.75]) expect(radius(back, t)).toBeCloseTo(50, 0);
  });
  it('un tracciato con meno di 2 punti sparisce', () => {
    const g = parseSvg('<svg><path d="M0 0 L 50 0" fill="none" stroke="#000"/></svg>');
    expect(removeNode(toEdit(g), { path: 0, node: 0 })).toHaveLength(0);
  });
});

describe('penna: spostare', () => {
  it('i punti selezionati si spostano con le loro maniglie', () => {
    const c = circle();
    const out = moveNodes(c, [{ path: 0, node: 0 }], 10, -5);
    const a = c[0]!.nodes[0]!;
    const b = out[0]!.nodes[0]!;
    expect(b.p).toEqual({ x: a.p.x + 10, y: a.p.y - 5 });
    expect(b.hout).toEqual({ x: a.hout.x + 10, y: a.hout.y - 5 });
    expect(c[0]!.nodes[0]!.p).toEqual(a.p); // l'originale non cambia
  });
  it("maniglia di un punto curvo: l'opposta segue (stessa lunghezza)", () => {
    const c = circle();
    const out = moveHandle(c, { path: 0, node: 0 }, 'out', { x: 120, y: 80 }, false);
    const n = out[0]!.nodes[0]!;
    expect(n.hout).toEqual({ x: 120, y: 80 });
    const lin = Math.hypot(c[0]!.nodes[0]!.hin.x - 100, c[0]!.nodes[0]!.hin.y - 50);
    expect(Math.hypot(n.hin.x - 100, n.hin.y - 50)).toBeCloseTo(lin, 9);
    expect(isSmooth(n)).toBe(true);
  });
  it('con Alt la maniglia si muove da sola (diventa spigolo)', () => {
    const out = moveHandle(circle(), { path: 0, node: 0 }, 'out', { x: 120, y: 80 }, true);
    expect(isSmooth(out[0]!.nodes[0]!)).toBe(false);
  });
});

describe('penna: spigolo ↔ curva', () => {
  it('curva → spigolo → curva', () => {
    const c = circle();
    const corner = toggleCorner(c, { path: 0, node: 0 });
    const n = corner[0]!.nodes[0]!;
    expect(n.hin).toEqual(n.p);
    expect(n.hout).toEqual(n.p);
    const smooth = toggleCorner(corner, { path: 0, node: 0 });
    expect(isSmooth(smooth[0]!.nodes[0]!)).toBe(true);
  });
  it('lo spigolo di un quadrato diventa curvo', () => {
    const s = toggleCorner(sq(), { path: 0, node: 1 });
    expect(isSmooth(s[0]!.nodes[1]!)).toBe(true);
  });
});

describe('penna: colpire una curva', () => {
  it('trova la curva e il parametro più vicini', () => {
    const hit = nearestOnPaths(sq(), { x: 30, y: 2 }, 5)!;
    expect(hit.path).toBe(0);
    expect(hit.seg).toBe(0);
    expect(hit.t).toBeCloseTo(0.3, 2);
    expect(nearestOnPaths(sq(), { x: 50, y: 50 }, 5)).toBeNull();
  });
});
