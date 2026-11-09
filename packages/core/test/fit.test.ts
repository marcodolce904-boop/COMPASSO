import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  arcTolerance,
  detectArcs,
  fitCircleKasa,
  fitCircleTaubin,
  kappaArc,
  maxRadialDeviation,
  normalizeGeometry,
  parseSvg,
  KAPPA,
  type PathData,
  type Segment,
  type Vec2,
} from '../src';
import { arcCubic } from '../../../scripts/fixtures-def';

const onCircle = (cx: number, cy: number, r: number, a0: number, a1: number, n: number): Vec2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

/** Cerchio come 4 cubiche kappa, in un PathData. */
function circlePath(cx: number, cy: number, r: number, rx = r, ry = r): PathData {
  const d = `M ${cx + 1} ${cy} ${[0, 1, 2, 3]
    .map((i) => arcCubic(cx, cy, 1, (Math.PI / 2) * i, (Math.PI / 2) * (i + 1)))
    .join(' ')}`;
  const g = parseSvg(
    `<svg><path transform="translate(${cx} ${cy}) scale(${rx} ${ry}) translate(${-cx} ${-cy})" d="${d} Z"/></svg>`,
  );
  return g.paths[0] as PathData;
}

describe('Taubin / Kåsa', () => {
  it('recupera cerchio esatto da 3 punti', () => {
    const f = fitCircleTaubin(onCircle(10, -5, 7, 0, 4, 3));
    expect(f).not.toBeNull();
    expect(f?.cx).toBeCloseTo(10, 6);
    expect(f?.cy).toBeCloseTo(-5, 6);
    expect(f?.r).toBeCloseTo(7, 6);
  });

  it('punti allineati → null', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ x: i, y: 2 * i }));
    expect(fitCircleTaubin(pts)).toBeNull();
    expect(fitCircleKasa(pts)).toBeNull();
  });

  it('property: arco di cerchio casuale → centro e raggio entro 0,1%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: 1, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 6.28, noNaN: true }),
        fc.double({ min: 0.5, max: 6, noNaN: true }),
        (cx, cy, r, a0, sweep) => {
          const f = fitCircleTaubin(onCircle(cx, cy, r, a0, a0 + sweep, 16));
          expect(f).not.toBeNull();
          if (!f) return;
          expect(Math.abs(f.r - r) / r).toBeLessThan(0.001);
          expect(Math.hypot(f.cx - cx, f.cy - cy) / r).toBeLessThan(0.001);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Taubin è più accurato di Kåsa su un arco corto con rumore', () => {
    const pts = onCircle(0, 0, 100, 0, 0.6, 16).map((p, i) => ({
      x: p.x + (i % 2 ? 0.2 : -0.2),
      y: p.y + (i % 3 ? 0.1 : -0.1),
    }));
    const t = fitCircleTaubin(pts);
    const k = fitCircleKasa(pts);
    expect(t && k && Math.abs(t.r - 100) <= Math.abs(k.r - 100)).toBe(true);
  });
});

describe('kappaArc', () => {
  const quarter = (s = 1): Segment => {
    const k = KAPPA * 10 * s;
    return {
      kind: 'cubic',
      p0: { x: 10, y: 0 },
      c1: { x: 10, y: k },
      c2: { x: k, y: 10 },
      p1: { x: 0, y: 10 },
    };
  };

  it('riconosce un quarto di cerchio esatto', () => {
    const a = kappaArc(quarter());
    expect(a?.r).toBeCloseTo(10, 6);
    expect(a?.cx).toBeCloseTo(0, 6);
    expect(a?.theta).toBeCloseTo(Math.PI / 2, 9);
  });

  it('maniglie sbagliate di oltre il 2% → non è un arco', () => {
    expect(kappaArc(quarter(1.05))).toBeNull();
    expect(kappaArc(quarter(0.95))).toBeNull();
  });

  it('S di Bézier (normali parallele) e rette → null', () => {
    expect(
      kappaArc({
        kind: 'cubic',
        p0: { x: 0, y: 0 },
        c1: { x: 0, y: 5 },
        c2: { x: 10, y: 5 },
        p1: { x: 10, y: 10 },
      }),
    ).toBeNull();
    expect(kappaArc({ kind: 'line', p0: { x: 0, y: 0 }, p1: { x: 1, y: 1 } })).toBeNull();
  });
});

describe('detectArcs', () => {
  const detect = (paths: PathData[]) => {
    const g = normalizeGeometry(paths);
    return detectArcs(g, arcTolerance(g.D));
  };

  it('4 cubiche → un solo cerchio completo', () => {
    const { arcs } = detect([circlePath(50, 60, 40)]);
    expect(arcs).toHaveLength(1);
    expect(arcs[0]).toMatchObject({ quality: 'arc' });
    expect(arcs[0]?.r).toBeCloseTo(40, 1);
    expect((arcs[0]?.sweep ?? 0) * (180 / Math.PI)).toBeCloseTo(360, 0);
  });

  it('ellisse 1,5% → non è un arco stretto', () => {
    const { arcs } = detect([circlePath(0, 0, 80, 80, 80 * 0.985)]);
    expect(arcs.every((a) => a.quality !== 'arc' || a.refs.length < 4)).toBe(true);
  });

  it('ellisse molto schiacciata → nessun cerchio', () => {
    const { arcs } = detect([circlePath(0, 0, 80, 80, 40)]);
    expect(arcs.filter((a) => a.refs.length === 4)).toHaveLength(0);
  });

  it('property: cerchio casuale da 4 cubiche → centro/raggio entro 0,1%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -300, max: 300, noNaN: true }),
        fc.double({ min: -300, max: 300, noNaN: true }),
        fc.double({ min: 5, max: 300, noNaN: true }),
        (cx, cy, r) => {
          const { arcs } = detect([circlePath(cx, cy, r)]);
          expect(arcs).toHaveLength(1);
          const a = arcs[0];
          expect(Math.abs((a?.r ?? 0) - r) / r).toBeLessThan(0.001);
          expect(Math.hypot((a?.cx ?? 0) - cx, (a?.cy ?? 0) - cy) / r).toBeLessThan(0.001);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: cerchio deformato oltre ε larga non è riconosciuto come cerchio', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.7, max: 0.9, noNaN: true }), (squash) => {
        const { arcs } = detect([circlePath(0, 0, 100, 100, 100 * squash)]);
        expect(arcs.some((a) => a.quality === 'arc' && a.refs.length === 4)).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('arco con raggio > 5·D è trattato come retta', () => {
    const g = parseSvg(
      `<svg><path d="M0 0 ${arcCubic(0, 5000, 5000, -Math.PI / 2, -Math.PI / 2 + 0.02)}"/><path d="M0 0 L100 0 L100 100 L0 100 Z"/></svg>`,
    );
    const n = normalizeGeometry(g.paths);
    const res = detectArcs(n, arcTolerance(n.D));
    expect(res.arcs.every((a) => a.r <= 5 * n.D)).toBe(true);
  });

  it('maxRadialDeviation misura lo scarto', () => {
    expect(
      maxRadialDeviation(
        [
          { x: 11, y: 0 },
          { x: 0, y: 9.5 },
        ],
        { cx: 0, cy: 0, r: 10 },
      ),
    ).toBeCloseTo(1);
  });
});
