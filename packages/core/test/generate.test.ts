// GENERA (docs/GENERA.md): Matematico e Minimal.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  analyze,
  generate,
  generateDefaults,
  parseSvg,
  type DocumentGeometry,
  type Segment,
  type Vec2,
} from '../src';
import { geometryDrift } from '../src/generate/geometry';

// logo di prova sul modello della «A con coda» (gambe inclinate quasi parallele, coda libera)
const TAIL =
  'M20 190 C80 120 160 130 230 170 C260 185 280 175 300 150 C315 175 318 200 310 215 C290 262 240 272 200 252 C150 226 90 214 20 190 Z';
const LOGO_A = `<svg><path d="M121 21 L171 20 L151 152 L104 150 Z"/><path d="M201 19 L240 21 L291 331 L250 330 Z"/><path d="M95 231 L131 229 L110 331 L71 330 Z"/><path d="${TAIL}"/></svg>`;
// marchio con cerchi e rette leggermente fuori modulo
const LOGO_C =
  '<svg><path d="M20 20 L182 21 L181 101 L21 99 Z"/><circle cx="61" cy="141" r="31"/><circle cx="141.5" cy="142" r="30.6"/></svg>';

const anchors = (g: DocumentGeometry) =>
  g.paths.reduce((s, p) => s + p.segments.length + (p.closed ? 0 : 1), 0);
const diag = (g: DocumentGeometry) => {
  const pts = g.paths.flatMap((p) => p.segments.flatMap((s) => [s.p0, s.p1]));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};
const lines = (g: DocumentGeometry): Extract<Segment, { kind: 'line' }>[] =>
  g.paths.flatMap((p) =>
    p.segments.filter((s): s is Extract<Segment, { kind: 'line' }> => s.kind === 'line'),
  );
const angleDeg = (a: Vec2, b: Vec2) => {
  let d = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (d < 0) d += 180;
  return d % 180;
};
const offMultiple = (v: number, step: number) => {
  const r = Math.abs(v / step - Math.round(v / step));
  return r * step;
};

describe('GENERA: regole comuni', () => {
  for (const mode of ['math', 'minimal'] as const) {
    it(`${mode}: stesso numero di tracciati, entro lo scarto massimo, deterministico`, () => {
      for (const svg of [LOGO_A, LOGO_C]) {
        const g = parseSvg(svg);
        const o = generateDefaults(g);
        const a = generate(g, mode, o);
        const b = generate(g, mode, o);
        expect(a.geometry.paths).toHaveLength(g.paths.length);
        expect(a.geometry.paths.map((p) => p.id)).toEqual(g.paths.map((p) => p.id));
        expect(geometryDrift(a.geometry, g)).toBeLessThanOrEqual(o.maxDeviation + 1e-6);
        expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
        expect(a.report.similarity).toBeGreaterThan(90);
        expect(a.report.similarity).toBeLessThanOrEqual(100);
      }
    });
  }

  it('lo scarto massimo vale per qualsiasi valore (proprietà)', () => {
    const g = parseSvg(LOGO_C);
    const D = diag(g);
    fc.assert(
      fc.property(fc.double({ min: 0.005, max: 0.1, noNaN: true }), (f) => {
        const o = { ...generateDefaults(g), maxDeviation: f * D };
        for (const mode of ['math', 'minimal'] as const)
          expect(geometryDrift(generate(g, mode, o).geometry, g)).toBeLessThanOrEqual(
            o.maxDeviation + 1e-6,
          );
      }),
      { numRuns: 12 },
    );
  });
});

describe('GENERA: Matematico', () => {
  it('rette ad angoli multipli di 15°, quasi parallele rese parallele', () => {
    const g = parseSvg(LOGO_A);
    const o = { ...generateDefaults(g), maxDeviation: 0.06 * diag(g) };
    const r = generate(g, 'math', o);
    expect(r.report.strengthUsed).toBe(1);
    const ls = lines(r.geometry).filter((l) => Math.hypot(l.p1.x - l.p0.x, l.p1.y - l.p0.y) > 20);
    expect(ls.length).toBeGreaterThan(6);
    for (const l of ls) expect(offMultiple(angleDeg(l.p0, l.p1), 15)).toBeLessThan(0.01);
    expect(r.report.angles).toBeGreaterThan(0);
  });

  it('raggi e centri dei cerchi sul modulo (mezzo modulo)', () => {
    const g = parseSvg(LOGO_C);
    const o = { ...generateDefaults(g), maxDeviation: 0.06 * diag(g) };
    const r = generate(g, 'math', o);
    const step = r.report.module / 2;
    expect(step).toBeGreaterThan(0);
    const cs = analyze(r.geometry).circles.filter((c) => c.approx === undefined);
    expect(cs.length).toBeGreaterThanOrEqual(2);
    const gx = r.guides.grid!;
    for (const c of cs) {
      expect(offMultiple(c.r, step)).toBeLessThan(0.05);
      expect(offMultiple(c.cx - gx.x, step)).toBeLessThan(0.05);
      expect(offMultiple(c.cy - gx.y, step)).toBeLessThan(0.05);
    }
    expect(r.report.radii).toBeGreaterThan(0);
    expect(r.guides.circles.length).toBe(cs.length);
    expect(r.guides.circles[0]!.label).toMatch(/m$/);
  });

  it('se la regola deforma troppo, si adatta da sola e il riepilogo lo dice', () => {
    const g = parseSvg(LOGO_A);
    const o = { ...generateDefaults(g), maxDeviation: 0.004 * diag(g) };
    const r = generate(g, 'math', o);
    // griglia più fine, rette lasciate al loro angolo o intensità ridotta: e il riepilogo lo dice
    expect(r.report.division).toBeGreaterThan(2);
    expect(
      r.report.notes.some((n) => ['strength-reduced', 'angles-skipped', 'unchanged'].includes(n)),
    ).toBe(true);
    expect(geometryDrift(r.geometry, g)).toBeLessThanOrEqual(o.maxDeviation + 1e-6);
  });
});

describe('GENERA: Minimal', () => {
  it('meno anchor, spigoli veri conservati', () => {
    // contorno con troppi anchor: un rettangolo con i lati spezzati e una curva sovrabbondante
    const g = parseSvg(
      '<svg><path d="M0 0 L50 0.3 L100 0 L150 0.2 L200 0 L200 60 L200.2 120 C160 130 140 140 100 140 C60 140 40 130 20 125 C10 122 3 121 0 120 L0.2 60 Z"/></svg>',
    );
    const r = generate(g, 'minimal', generateDefaults(g));
    expect(r.report.anchorsBefore).toBe(anchors(g));
    expect(r.report.anchorsAfter).toBeLessThan(anchors(g));
    expect(r.report.anchorsAfter).toBeLessThanOrEqual(7);
    // gli spigoli del rettangolo restano anchor
    const pts = r.geometry.paths[0]!.segments.map((s) => s.p0);
    for (const c of [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 120 },
      { x: 0, y: 120 },
    ])
      expect(Math.min(...pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y)))).toBeLessThan(3);
  });

  it('numero massimo di anchor: si semplifica di più finché lo scarto lo permette', () => {
    const g = parseSvg(LOGO_A);
    const base = generate(g, 'minimal', generateDefaults(g));
    const o = { ...generateDefaults(g), minimal: { level: 'medium' as const, maxAnchors: 10 } };
    const r = generate(g, 'minimal', o);
    expect(r.report.anchorsAfter).toBeLessThanOrEqual(base.report.anchorsAfter);
    expect(geometryDrift(r.geometry, g)).toBeLessThanOrEqual(o.maxDeviation + 1e-6);
  });

  it('segnala le forme molto piccole (senza toglierle)', () => {
    const g = parseSvg(
      `<svg><path d="M0 0 L300 0 L300 300 L0 300 Z"/><circle cx="150" cy="150" r="3"/></svg>`,
    );
    const r = generate(g, 'minimal', generateDefaults(g));
    expect(r.geometry.paths).toHaveLength(2);
    expect(r.report.smallShapes).toBe(1);
  });
});
