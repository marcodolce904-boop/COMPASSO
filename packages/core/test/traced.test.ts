import { describe, expect, it } from 'vitest';
import { analyze } from '../src';
import { circleFn, ellipseFn, geo, traced } from './helpers/traced';

// loghi "ricalcati": tre cerchi e un ovale, 16 anchor ciascuno, con rumore
const logo = (noise: number) =>
  geo([
    traced(circleFn(150, 150, 100), 16, noise, 1, 'a'),
    traced(circleFn(400, 150, 60), 16, noise, 2, 'b'),
    traced(circleFn(400, 300, 30), 16, noise, 3, 'c'),
    traced(ellipseFn(150, 350, 90, 45, 0.3), 16, noise, 4, 'e'),
  ]);
const fromPath = <T extends { refs: { pathId: string }[] }>(ids: T[], p: string): T[] =>
  ids.filter((c) => c.refs.some((r) => r.pathId === p));

describe('loghi ricalcati', () => {
  for (const noise of [0, 0.3, 0.8]) {
    it(`un solo cerchio per ogni cerchio ricalcato (rumore ±${noise} pt)`, () => {
      const r = analyze(logo(noise), { tolerance: 'normal' });
      for (const [p, R] of [
        ['a', 100],
        ['b', 60],
        ['c', 30],
      ] as const) {
        const cs = fromPath(r.circles, p);
        expect(cs, `cerchi dal tracciato ${p}`).toHaveLength(1);
        expect(Math.abs(cs[0]!.r - R)).toBeLessThan(1 + noise);
      }
    });
    it(`l'ovale è un ovale, non quattro cerchi (rumore ±${noise} pt)`, () => {
      const r = analyze(logo(noise), { tolerance: 'normal' });
      expect(fromPath(r.circles, 'e')).toHaveLength(0);
      const es = fromPath(r.ellipses, 'e');
      expect(es).toHaveLength(1);
      expect(es[0]!.rx).toBeCloseTo(90, 0);
      expect(es[0]!.ry).toBeCloseTo(45, 0);
      expect(es[0]!.rotation).toBeCloseTo(0.3, 1);
    });
  }
  it('gli ovali entrano nei livelli e hanno un id stabile', () => {
    const r = analyze(logo(0.3));
    expect(r.ellipses[0]!.id).toBe('e1');
    expect(r.levels.full).toContain('e1');
    expect(r.stats.ellipses).toBe(1);
  });
});

describe('livelli', () => {
  it('«Struttura» mostra tutti i cerchi che contano, non solo quelli del 60%', () => {
    const paths = [traced(circleFn(300, 300, 200), 16, 0, 1, 'big')];
    for (let i = 0; i < 6; i++)
      paths.push(traced(circleFn(150 + 60 * i, 300, 15), 8, 0, 2 + i, `s${i}`));
    const r = analyze(geo(paths));
    expect(r.circles).toHaveLength(7);
    for (const c of r.circles) expect(r.levels.structure).toContain(c.id);
  });
});
