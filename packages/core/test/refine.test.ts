import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyze,
  parseSvg,
  refine,
  refineDefaults,
  type DocumentGeometry,
  type RefineOptions,
  ellipseDistance,
  fitEllipse,
} from '../src';
import { circleFn, ellipseFn, geo, traced } from './helpers/traced';

const load = (file: string) =>
  parseSvg(readFileSync(join(__dirname, '..', '..', '..', 'fixtures', 'svg', file), 'utf8'));

/** Tutte le correzioni spente, salvo quelle indicate. */
function only(geom: DocumentGeometry, patch: Partial<RefineOptions>): RefineOptions {
  const { options } = refineDefaults(geom);
  const off: RefineOptions = {
    ...options,
    arcs: { ...options.arcs, enabled: false },
    ellipses: { ...options.ellipses, enabled: false },
    radii: { ...options.radii, enabled: false },
    centers: { ...options.centers, enabled: false },
    lines: { ...options.lines, enabled: false },
    align: { ...options.align, enabled: false },
    symmetry: { ...options.symmetry, enabled: false },
    grid: { ...options.grid, enabled: false },
    clean: { enabled: false },
  };
  return { ...off, ...patch };
}

const anchors = (g: DocumentGeometry) => g.paths.flatMap((p) => p.segments.map((s) => s.p0));
const kinds = (g: DocumentGeometry, k: string) => analyze(g).findings.filter((f) => f.kind === k);

describe('refine: proprietà generali', () => {
  it('intensità 0: nessuna modifica', () => {
    const g = load('10-marchio-quasi-simmetrico.svg');
    const { options } = refineDefaults(g);
    const r = refine(g, { ...options, strength: 0 });
    expect(r.report.maxShift).toBe(0);
    expect(r.report.changedPaths).toBe(0);
  });

  it('loghi già esatti restano invariati (05, 06, 09)', () => {
    for (const f of [
      '05-rettangolo-arrotondato.svg',
      '06-lettera-o.svg',
      '09-marchio-simmetrico.svg',
    ]) {
      const g = load(f);
      const r = refine(g, refineDefaults(g).options);
      expect(r.report.maxShift, f).toBeLessThan(0.01);
      expect(analyze(r.geometry).stats, f).toEqual(analyze(g).stats);
    }
  });

  it('idempotente: correggere due volte = correggere una volta', () => {
    const g = load('10-marchio-quasi-simmetrico.svg');
    const o = refineDefaults(g).options;
    const once = refine(g, o).geometry;
    const twice = refine(once, o);
    expect(twice.report.maxShift).toBeLessThan(1e-6);
    expect(twice.report.changedPaths).toBe(0);
    expect(
      twice.report.arcs + twice.report.lines + twice.report.aligned + twice.report.symmetric,
    ).toBe(0);
  });

  it('intensità 50%: a metà strada', () => {
    const g = load('11-anchor-fuori-riga-0.3pt.svg');
    const o = only(g, { align: { enabled: true, tolerance: 1 } });
    const half = refine(g, { ...o, strength: 0.5 });
    expect(half.report.maxShift).toBeCloseTo(0.15, 3);
  });

  it('id, glifi e numero di tracciati conservati', () => {
    const g = load('06-lettera-o.svg');
    const r = refine(g, refineDefaults(g).options);
    expect(r.geometry.paths.map((p) => [p.id, p.glyphId])).toEqual(
      g.paths.map((p) => [p.id, p.glyphId]),
    );
  });
});

describe('refine: le 8 correzioni', () => {
  it('curve → archi perfetti (04: il quarto gonfiato torna sul cerchio)', () => {
    const g = load('04-quasi-cerchio-1.5pct.svg');
    expect(kinds(g, 'near-arc')).toHaveLength(1);
    const o = only(g, { arcs: { enabled: true, tolerance: 2 } });
    const r = refine(g, o);
    expect(r.report.arcs).toBeGreaterThan(0);
    const a = analyze(r.geometry);
    expect(kinds(r.geometry, 'near-arc')).toHaveLength(0);
    expect(a.circles).toHaveLength(1);
    expect(Math.abs(a.circles[0]!.r - 80)).toBeLessThan(0.0005 * 80);
  });

  it('raggi uguali', () => {
    const g = parseSvg(
      '<svg><circle cx="50" cy="50" r="30"/><circle cx="150" cy="50" r="30.8"/></svg>',
    );
    const r = refine(
      g,
      only(g, { arcs: { enabled: true, tolerance: 1 }, radii: { enabled: true, tolerance: 1 } }),
    );
    expect(r.report.radii).toBe(2);
    const c = analyze(r.geometry).circles;
    expect(c[0]!.r).toBeCloseTo(c[1]!.r, 6);
    expect(Math.abs(c[0]!.r - 30.4)).toBeLessThan(0.0005 * 30.4 + 0.01);
  });

  it('centri comuni', () => {
    const g = parseSvg(
      '<svg><circle cx="100" cy="100" r="60"/><circle cx="100.6" cy="100.4" r="30"/></svg>',
    );
    const r = refine(
      g,
      only(g, {
        arcs: { enabled: true, tolerance: 1 },
        centers: { enabled: true, tolerance: 1.5 },
      }),
    );
    expect(r.report.centers).toBeGreaterThan(0);
    const c = analyze(r.geometry).circles;
    expect(Math.hypot(c[0]!.cx - c[1]!.cx, c[0]!.cy - c[1]!.cy)).toBeLessThan(0.01);
    expect(analyze(r.geometry).relations.some((x) => x.kind === 'concentric')).toBe(true);
  });

  it('rette e angoli esatti (lato a 44,3° → 45°)', () => {
    const g = load('10-marchio-quasi-simmetrico.svg');
    expect(kinds(g, 'near-angle')).toHaveLength(1);
    const r = refine(g, only(g, { lines: { enabled: true, angle: 2 } }));
    expect(r.report.lines).toBeGreaterThan(0);
    expect(kinds(r.geometry, 'near-angle')).toHaveLength(0);
  });

  it('allinea anchor (11: il fondo a 150,3 torna a 150)', () => {
    const g = load('11-anchor-fuori-riga-0.3pt.svg');
    const r = refine(g, only(g, { align: { enabled: true, tolerance: 0.5 } }));
    expect(r.report.aligned).toBe(2);
    expect(kinds(r.geometry, 'near-row')).toHaveLength(0);
    expect(anchors(r.geometry).every((p) => Math.abs(p.y - 150.3) > 1e-6)).toBe(true);
  });

  it('simmetria (10: la gronda destra torna speculare, asse x = 100)', () => {
    const g = load('10-marchio-quasi-simmetrico.svg');
    const r = refine(g, only(g, { symmetry: { enabled: true, tolerance: 3, axis: 'auto' } }));
    expect(r.report.axis).toEqual({ theta: 0, rho: 100 });
    expect(r.report.symmetric).toBeGreaterThan(0);
    const a = analyze(r.geometry);
    expect(a.axes.some((x) => Math.abs(x.theta) < 1e-6 && Math.abs(x.rho - 100) < 0.01)).toBe(true);
    expect(kinds(r.geometry, 'near-symmetry')).toHaveLength(0);
  });

  it('simmetria: un logo non simmetrico non viene forzato', () => {
    const g = parseSvg('<svg><path d="M0 0 L100 0 L30 80 Z"/></svg>');
    const r = refine(g, only(g, { symmetry: { enabled: true, tolerance: 2, axis: 'auto' } }));
    expect(r.report.symmetric).toBe(0);
    expect(r.report.axis).toBeNull();
  });

  it('griglia: anchor sui multipli del passo, raggi arrotondati', () => {
    const g = parseSvg(
      '<svg><path d="M10.3 10.6 L80.2 10.6 L80.2 60.4 Z"/><circle cx="150.2" cy="40.4" r="20.3"/></svg>',
    );
    const r = refine(
      g,
      only(g, {
        arcs: { enabled: true, tolerance: 1 },
        grid: { enabled: true, step: 1, radii: true },
      }),
    );
    for (const p of anchors(r.geometry)) {
      const onGrid =
        Math.abs(p.x - Math.round(p.x)) < 1e-6 && Math.abs(p.y - Math.round(p.y)) < 1e-6;
      const onCircle = Math.abs(Math.hypot(p.x - 150, p.y - 40) - 20) < 1e-6;
      expect(onGrid || onCircle).toBe(true);
    }
    expect(Math.abs(analyze(r.geometry).circles[0]!.r - 20)).toBeLessThan(0.0005 * 20);
  });

  it('pulisci: arco spezzato in 3 tratti → minimo di tratti; rette allineate unite', () => {
    const g3 = load('03-arco-3-cubiche-irregolari.svg'); // arco di 200° in 3 cubiche
    const r3 = refine(
      g3,
      only(g3, { arcs: { enabled: true, tolerance: 1 }, clean: { enabled: true } }),
    );
    expect(r3.geometry.paths[0]!.segments).toHaveLength(3); // ceil(200/90) = 3, a passo regolare
    const g = parseSvg('<svg><path d="M0 0 L50 0 L100 0 L100 50 L0 50 Z"/></svg>');
    const r = refine(g, only(g, { clean: { enabled: true } }));
    expect(r.report.removedAnchors).toBe(1);
    expect(r.geometry.paths[0]!.segments).toHaveLength(4);
  });

  it('pulisci: cerchio ricalcato con 8 tratti → 4 quarti esatti', () => {
    const k = (4 / 3) * Math.tan(Math.PI / 16);
    let d = 'M 150 100';
    for (let i = 0; i < 8; i++) {
      const a0 = (i * Math.PI) / 4,
        a1 = ((i + 1) * Math.PI) / 4,
        r = 50;
      const p0 = [100 + r * Math.cos(a0), 100 + r * Math.sin(a0)];
      const p1 = [100 + r * Math.cos(a1), 100 + r * Math.sin(a1)];
      const c1 = [p0[0]! - k * r * Math.sin(a0), p0[1]! + k * r * Math.cos(a0)];
      const c2 = [p1[0]! + k * r * Math.sin(a1), p1[1]! - k * r * Math.cos(a1)];
      d += ` C ${c1.join(' ')} ${c2.join(' ')} ${p1.join(' ')}`;
    }
    const g = parseSvg(`<svg><path d="${d} Z"/></svg>`);
    const r = refine(
      g,
      only(g, { arcs: { enabled: true, tolerance: 1 }, clean: { enabled: true } }),
    );
    expect(r.geometry.paths[0]!.segments).toHaveLength(4);
    expect(r.report.removedAnchors).toBe(4);
    expect(Math.abs(analyze(r.geometry).circles[0]!.r - 50)).toBeLessThan(0.0005 * 50);
  });

  it('tutte insieme sul marchio quasi simmetrico: niente più anomalie', () => {
    const g = load('10-marchio-quasi-simmetrico.svg');
    expect(analyze(g).findings.length).toBeGreaterThan(0);
    const r = refine(g, refineDefaults(g).options);
    expect(analyze(r.geometry).findings).toEqual([]);
  });
});

describe('refine: ovali', () => {
  const oval = () => geo([traced(ellipseFn(200, 150, 120, 60, 0.4), 16, 0.4, 7, 'o')]);
  const ctrl = (g: DocumentGeometry) => {
    // anchor e punti a metà di ogni tratto: su un arco esatto stanno sull'ovale
    const pts = [];
    for (const p of g.paths)
      for (const s of p.segments) {
        pts.push(s.p0);
        if (s.kind === 'cubic')
          pts.push({
            x: (s.p0.x + 3 * s.c1.x + 3 * s.c2.x + s.p1.x) / 8,
            y: (s.p0.y + 3 * s.c1.y + 3 * s.c2.y + s.p1.y) / 8,
          });
      }
    return pts;
  };

  it('un ovale ricalcato diventa un ovale esatto', () => {
    const g = oval();
    const r = refine(g, only(g, { ellipses: refineDefaults(g).options.ellipses }));
    expect(r.report.ellipses).toBe(1);
    const pts = ctrl(r.geometry);
    const e = fitEllipse(pts)!;
    expect(e.rx).toBeCloseTo(120, 0);
    expect(e.ry).toBeCloseTo(60, 0);
    for (const p of pts) expect(ellipseDistance(p, e)).toBeLessThan(1e-6);
  });

  it('pulizia: ovale completo con 4 anchor, idempotente', () => {
    const g = oval();
    const { options } = refineDefaults(g);
    const r1 = refine(g, options);
    expect(r1.geometry.paths[0]!.segments).toHaveLength(4);
    const r2 = refine(r1.geometry, options);
    expect(r2.report.changedPaths).toBe(0);
    expect(r2.report.ellipses).toBe(0);
  });

  it('«trasforma in cerchi»: l’ovale diventa un cerchio perfetto', () => {
    const g = geo([traced(ellipseFn(100, 100, 66, 54, 0), 12, 0.2, 3, 'o')]);
    const base = refineDefaults(g).options.ellipses;
    const r = refine(g, only(g, { ellipses: { ...base, toCircle: true } }));
    expect(r.report.ellipses).toBe(1);
    const cs = analyze(r.geometry).circles;
    expect(cs).toHaveLength(1);
    const c = cs[0]!;
    expect(Math.hypot(c.cx - 100, c.cy - 100)).toBeLessThan(0.5);
    expect(c.r).toBeCloseTo(60, 0);
    const ds = ctrl(r.geometry).map((p) => Math.hypot(p.x - c.cx, p.y - c.cy));
    expect(Math.max(...ds) - Math.min(...ds)).toBeLessThan(1e-6);
  });

  it('un cerchio ricalcato non diventa un ovale', () => {
    const g = geo([traced(circleFn(100, 100, 80), 16, 0.3, 5, 'c')]);
    const r = refine(g, refineDefaults(g).options);
    expect(r.report.ellipses).toBe(0);
    expect(r.report.arcs).toBeGreaterThan(0);
  });
});

describe('refine: nessun pezzo mancante', () => {
  it('tracciati degeneri o aperti restano nella copia corretta', () => {
    const g = parseSvg(
      '<svg><path d="M0 0 L 100 0 L 100 100 Z"/><path d="M50 50 L 50 50"/>' +
        '<path d="M0 120 C 30 150 70 150 100 120" fill="none" stroke="#000"/></svg>',
    );
    const r = refine(g, refineDefaults(g).options);
    expect(r.geometry.paths.map((p) => p.id)).toEqual(g.paths.map((p) => p.id));
  });
  it('tutti i loghi di prova: stessi tracciati, nessun tracciato vuoto', () => {
    for (const f of [
      '01-cerchio-4-cubiche.svg',
      '03-arco-3-cubiche-irregolari.svg',
      '04-quasi-cerchio-1.5pct.svg',
      '05-rettangolo-arrotondato.svg',
      '06-lettera-o.svg',
      '09-marchio-simmetrico.svg',
      '10-marchio-quasi-simmetrico.svg',
      '11-anchor-fuori-riga-0.3pt.svg',
      '12-diagonali-parallele.svg',
    ]) {
      const g = load(f);
      const r = refine(g, refineDefaults(g).options);
      expect(
        r.geometry.paths.map((p) => p.id),
        f,
      ).toEqual(g.paths.map((p) => p.id));
      for (const p of r.geometry.paths) expect(p.segments.length, f).toBeGreaterThan(0);
    }
  });
});

describe('refine: elementi esclusi', () => {
  it('un tracciato o un glifo escluso resta identico, gli altri si correggono', () => {
    const g = geo([
      traced(circleFn(100, 100, 50), 16, 0.4, 1, 'a'),
      { ...traced(circleFn(300, 100, 50), 16, 0.4, 2, 'b'), glyphId: 'g1' },
    ]);
    const { options } = refineDefaults(g);
    const r = refine(g, { ...options, exclude: ['a', 'g1'] });
    expect(r.geometry.paths).toEqual(g.paths);
    expect(r.report.changedPaths).toBe(0);
    const r2 = refine(g, { ...options, exclude: ['g1'] });
    expect(r2.geometry.paths[1]).toEqual(g.paths[1]);
    expect(r2.geometry.paths[0]).not.toEqual(g.paths[0]);
  });
});
