import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, parseSvg, tolerances, type AnalysisResult } from '../src';
import { FIXTURES } from '../../../scripts/fixtures-def';

const root = join(__dirname, '..', '..', '..');
const load = (file: string) => parseSvg(readFileSync(join(root, 'fixtures', 'svg', file), 'utf8'));
const strip = (r: AnalysisResult) => ({ ...r, durationMs: 0 });

describe.each(FIXTURES.filter((f) => f.analyze))('analyze $file', (fx) => {
  const t = fx.analyze!;
  const r = analyze(load(fx.file));

  if (t.circles !== undefined)
    it('numero di cerchi', () => expect(r.circles).toHaveLength(t.circles!));

  if (t.axes) {
    it('assi di simmetria', () => {
      expect(r.axes).toHaveLength(t.axes!.length);
      for (const want of t.axes!) {
        const theta = want.dir === 'v' ? 0 : Math.PI / 2;
        const hit = r.axes.find(
          (a) => Math.abs(a.theta - theta) < 1e-6 && Math.abs(a.rho - want.at) < 0.01,
        );
        expect(hit, `${want.dir}=${want.at}`).toBeDefined();
      }
    });
  }
  if (t.noAxes) it('nessun asse valido', () => expect(r.axes).toHaveLength(0));

  if (t.unitX !== undefined) {
    it('unità x', () => {
      if (t.unitX === null) expect(r.specs.unitX).toBeNull();
      else {
        expect(r.specs.unitX).toBeCloseTo(t.unitX!, 1);
        expect(r.specs.unitXConfidence).toBe('high');
      }
    });
  }

  if (t.clean) it('nessun finding', () => expect(r.findings).toEqual([]));
  if (t.findings) {
    it('findings attesi', () => {
      for (const k of t.findings!) expect(r.findings.map((f) => f.kind)).toContain(k);
    });
  }
  if (t.findingDelta) {
    it('delta del finding', () => {
      const f = r.findings.find((x) => x.kind === t.findingDelta!.kind);
      expect(Math.abs((f?.delta ?? Infinity) - t.findingDelta!.delta)).toBeLessThanOrEqual(
        t.findingDelta!.tol,
      );
    });
  }
  if (t.relations) {
    it('relazioni attese', () => {
      for (const k of t.relations!) expect(r.relations.map((x) => x.kind)).toContain(k);
    });
  }

  it('deterministico (id stabili)', () => {
    expect(strip(analyze(load(fx.file)))).toEqual(strip(r));
  });

  it('livelli cumulativi', () => {
    const { essential, structure, detail, full } = r.levels;
    for (const id of essential) expect(structure).toContain(id);
    for (const id of structure) expect(detail).toContain(id);
    for (const id of detail) expect(full).toContain(id);
  });

  it('stats coerenti', () => {
    expect(r.stats.circles).toBe(r.circles.length);
    expect(r.stats.lines).toBe(r.lines.length);
    expect(r.stats.axes).toBe(r.axes.length);
  });
});

describe('analyze: casi generali', () => {
  it('geometria vuota', () => {
    const r = analyze({ source: 'svg', paths: [], warnings: [] });
    expect(r.circles).toEqual([]);
    expect(r.findings).toEqual([]);
    expect(r.specs.unitX).toBeNull();
  });

  it('il preset Morbido allarga la fascia: il near-row 0,3 pt pesa di più', () => {
    const geom = load('11-anchor-fuori-riga-0.3pt.svg');
    const normal = analyze(geom);
    const loose = analyze(geom, { tolerance: 'loose' });
    expect(normal.findings.some((f) => f.kind === 'near-row')).toBe(true);
    expect(loose.tolerance).toBe('loose');
    // con ×2 la soglia larga raddoppia: il finding resta ma con importanza maggiore
    const fn = normal.findings.find((f) => f.kind === 'near-row')!;
    const fl = loose.findings.find((f) => f.kind === 'near-row')!;
    expect(fl.importance).toBeGreaterThan(fn.importance);
  });

  it('il preset Rigido non produce più findings del Normale sul 04', () => {
    const geom = load('04-quasi-cerchio-1.5pct.svg');
    expect(analyze(geom, { tolerance: 'strict' }).findings.length).toBeLessThanOrEqual(
      analyze(geom).findings.length,
    );
  });

  it('tolerances: moltiplicatori ×0,5 ×1 ×2 e minimo assoluto della riga', () => {
    const n = tolerances(100);
    expect(tolerances(100, 'strict').arc.strict).toBeCloseTo(n.arc.strict / 2);
    expect(tolerances(100, 'loose').center.wide).toBeCloseTo(n.center.wide * 2);
    expect(tolerances(10, 'normal').row.strict).toBe(0.02);
  });

  it('assi quasi coincidenti (PCA ≈ verticale) non vengono duplicati', () => {
    const r = analyze(
      parseSvg(
        '<svg><rect x="20" y="40" width="160" height="120" rx="30" transform="rotate(0.05 100 100)"/></svg>',
      ),
    );
    expect(r.axes.length).toBeLessThanOrEqual(2);
  });

  it('al massimo 30 findings, ordinati per importanza', () => {
    // 40 barre con il fondo sfalsato di 0,3 pt a righe alterne
    const rects = Array.from(
      { length: 40 },
      (_, i) => `<rect x="${i * 30}" y="0" width="20" height="${100 + (i % 2) * 0.3}"/>`,
    ).join('');
    const r = analyze(parseSvg(`<svg>${rects}</svg>`));
    expect(r.findings.length).toBeLessThanOrEqual(30);
    for (let i = 1; i < r.findings.length; i++) {
      expect(r.findings[i - 1]!.importance).toBeGreaterThanOrEqual(r.findings[i]!.importance);
    }
  });
});

describe('livelli: pari merito', () => {
  it('a parità di punteggio con l’ultimo incluso, Essenziale li prende tutti (05: 4 cerchi)', () => {
    const r = analyze(load('05-rettangolo-arrotondato.svg'));
    const circles = r.circles.map((c) => c.id);
    for (const id of circles) expect(r.levels.essential).toContain(id);
  });
});
