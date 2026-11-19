// CORREGGI: perché una correzione accesa resta a 0 (docs/MIGLIORIE.md §2).
import { describe, expect, it } from 'vitest';
import { explainZero, parseSvg, refine, refineDefaults, type RefineOptions } from '../src';

const svg = (body: string) =>
  parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${body}</svg>`);
const run = (g: ReturnType<typeof svg>, patch: (o: RefineOptions) => void) => {
  const { options } = refineDefaults(g);
  patch(options);
  const r = refine(g, options);
  return { options, report: r.report, why: explainZero(g, options, r.report) };
};

describe('explainZero', () => {
  it('logo tutto dritto: per gli archi non c’è niente da correggere', () => {
    const g = svg('<path d="M50 50 L350 50 L350 350 L50 350 Z"/>');
    const { report, why } = run(g, () => {});
    expect(report.arcs).toBe(0);
    expect(why.arcs?.kind).toBe('none');
  });

  it('curva quasi circolare fuori tolleranza: dice di quanto si scosta', () => {
    // un «cerchio» un po' schiacciato: 150 e 140 di raggio
    const g = svg(
      '<path d="M50 200 C50 117 117 60 200 60 C283 60 350 117 350 200 C350 283 283 340 200 340 C117 340 50 283 50 200 Z"/>',
    );
    const { report, why, options } = run(g, (o) => {
      o.arcs.tolerance = 0.5;
      o.ellipses.enabled = false;
    });
    expect(report.arcs).toBe(0);
    expect(why.arcs?.kind).toBe('near');
    if (why.arcs?.kind === 'near') {
      expect(why.arcs.value).toBeGreaterThan(options.arcs.tolerance);
      expect(why.arcs.value).toBeLessThan(15);
      // la tolleranza proposta basta davvero
      const o2 = { ...options, arcs: { ...options.arcs, tolerance: why.arcs.suggest } };
      expect(refine(g, o2).report.arcs).toBeGreaterThan(0);
    }
  });

  it('retta storta di 4° con tolleranza 2°: dice 4°', () => {
    const t = Math.tan((4 * Math.PI) / 180) * 300;
    const g = svg(`<path d="M50 50 L350 ${50 + t} L350 350 L50 350 Z"/>`);
    const { report, why } = run(g, (o) => {
      o.lines.angle = 2;
      o.align.enabled = false;
      o.symmetry.enabled = false;
    });
    expect(report.lines).toBe(0);
    expect(why.lines?.kind).toBe('near');
    if (why.lines?.kind === 'near') expect(Math.abs(why.lines.value - 4)).toBeLessThan(0.3);
  });

  it('due anchor quasi alla stessa altezza: dice la distanza', () => {
    const g = svg('<path d="M50 50 L200 52 L350 300 Z"/>');
    const { report, why } = run(g, (o) => {
      o.align.tolerance = 0.5;
      o.lines.enabled = false;
      o.symmetry.enabled = false;
      o.grid.enabled = false;
    });
    expect(report.aligned).toBe(0);
    expect(why.align?.kind).toBe('near');
    if (why.align?.kind === 'near') expect(Math.abs(why.align.value - 2)).toBeLessThan(0.2);
  });

  it('correzioni che hanno agito o spente: nessuna spiegazione', () => {
    const g = svg('<path d="M50 50 L350 50 L350 350 L50 350 Z"/>');
    const { why } = run(g, (o) => {
      o.arcs.enabled = false;
    });
    expect(why.arcs).toBeUndefined();
  });
});
