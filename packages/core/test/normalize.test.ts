import { describe, expect, it } from 'vitest';
import { normalizeGeometry, parseSvg } from '../src';

const norm = (d: string) => normalizeGeometry(parseSvg(`<svg><path d="${d}"/></svg>`).paths);

describe('normalizeGeometry', () => {
  it('cubica con maniglie sugli anchor diventa retta', () => {
    const g = norm('M0 0 C0 0 100 0 100 0 L100 100');
    expect(g.paths[0]?.segments.map((s) => s.kind)).toEqual(['line', 'line']);
  });

  it('cubica con maniglie collineari alla corda diventa retta', () => {
    const g = norm('M0 0 C30 0.01 60 -0.01 100 0 L100 100');
    expect(g.paths[0]?.segments[0]?.kind).toBe('line');
  });

  it('una curva vera resta cubica', () => {
    const g = norm('M0 0 C0 50 100 50 100 0');
    expect(g.paths[0]?.segments[0]?.kind).toBe('cubic');
  });

  it('elimina i segmenti degeneri', () => {
    const g = norm('M0 0 L100 0 L100.001 0 L100 100');
    expect(g.paths[0]?.segments).toHaveLength(2);
  });

  it('calcola bbox, D e lunghezza totale', () => {
    const g = norm('M0 0 L30 0 L30 40');
    expect(g.bbox).toEqual({ x: 0, y: 0, width: 30, height: 40 });
    expect(g.D).toBeCloseTo(50);
    expect(g.totalLength).toBeCloseTo(70);
  });

  it('il bbox segue la curva, non i punti di controllo', () => {
    const g = norm('M0 0 C0 100 100 100 100 0');
    expect(g.bbox.height).toBeCloseTo(75, 0);
  });
});
