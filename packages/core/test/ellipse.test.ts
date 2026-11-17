import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { fitEllipse, ellipseDistance, ellipsePoint } from '../src/fit/ellipse';

const sample = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  t0: number,
  t1: number,
  n: number,
) =>
  Array.from({ length: n }, (_, i) =>
    ellipsePoint({ cx, cy, rx, ry, rotation: rot }, t0 + ((t1 - t0) * i) / (n - 1)),
  );

describe('fitEllipse', () => {
  it('ritrova un ovale ruotato esatto', () => {
    const e = fitEllipse(sample(200, 120, 90, 40, 0.5, 0, 2 * Math.PI, 40))!;
    expect(e.cx).toBeCloseTo(200, 6);
    expect(e.cy).toBeCloseTo(120, 6);
    expect(e.rx).toBeCloseTo(90, 6);
    expect(e.ry).toBeCloseTo(40, 6);
    expect(e.rotation).toBeCloseTo(0.5, 6);
  });
  it('funziona anche su mezzo ovale', () => {
    const e = fitEllipse(sample(0, 0, 50, 20, 0, 0, Math.PI, 30))!;
    expect(e.rx).toBeCloseTo(50, 5);
    expect(e.ry).toBeCloseTo(20, 5);
  });
  it('rx ≥ ry e rotazione in [0, π)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 5, max: 500, noNaN: true }),
        fc.double({ min: 0.2, max: 0.95, noNaN: true }),
        fc.double({ min: 0, max: Math.PI * 2, noNaN: true }),
        (rx, ratio, rot) => {
          const e = fitEllipse(sample(10, -30, rx, rx * ratio, rot, 0, 2 * Math.PI, 24))!;
          expect(e.rx).toBeGreaterThanOrEqual(e.ry);
          expect(e.rotation).toBeGreaterThanOrEqual(0);
          expect(e.rotation).toBeLessThan(Math.PI);
          expect(Math.abs(e.rx - rx) / rx).toBeLessThan(1e-6);
          expect(Math.abs(e.ry - rx * ratio) / rx).toBeLessThan(1e-6);
        },
      ),
    );
  });
  it('null su punti allineati', () => {
    expect(fitEllipse(Array.from({ length: 10 }, (_, i) => ({ x: i, y: 2 * i })))).toBeNull();
  });
});

describe('ellipseDistance', () => {
  const e = { cx: 0, cy: 0, rx: 100, ry: 50, rotation: 0 };
  it('distanza vera dal contorno', () => {
    expect(ellipseDistance({ x: 110, y: 0 }, e)).toBeCloseTo(10, 6);
    expect(ellipseDistance({ x: 0, y: 40 }, e)).toBeCloseTo(10, 6);
    expect(ellipseDistance(ellipsePoint(e, 1.1), e)).toBeLessThan(1e-9);
  });
});
