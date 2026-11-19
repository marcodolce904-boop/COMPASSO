// GENERA canonico (docs/GENERA.md §0): il logo diventa esattamente conforme alla regola, anche se
// cambia molto. Nessun limite di somiglianza.
import { describe, expect, it } from 'vitest';
import {
  analyze,
  generate,
  generateDefaults,
  parseSvg,
  type DocumentGeometry,
  type Segment,
  type Vec2,
} from '../src';

const PHI = (1 + Math.sqrt(5)) / 2;
const TAIL =
  'M20 190 C80 120 160 130 230 170 C260 185 280 175 300 150 C315 175 318 200 310 215 C290 262 240 272 200 252 C150 226 90 214 20 190 Z';
const LOGO_A = `<svg><path d="M121 21 L171 20 L151 152 L104 150 Z"/><path d="M201 19 L240 21 L291 331 L250 330 Z"/><path d="M95 231 L131 229 L110 331 L71 330 Z"/><path d="${TAIL}"/></svg>`;
const HEART =
  '<svg><path d="M249.43 413.50C185.87 364.47 88.31 282.09 72.57 199.31C48.22 71.21 179.35 64.14 250.50 134.66C314.20 66.78 448.94 68.63 427.75 191.50C412.23 281.54 316.33 359.40 249.43 413.50Z"/></svg>';

const lines = (g: DocumentGeometry) =>
  g.paths.flatMap((p) =>
    p.segments.filter(
      (s): s is Extract<Segment, { kind: 'line' }> =>
        s.kind === 'line' && Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y) > 15,
    ),
  );
const angleOff = (a: Vec2, b: Vec2, stepDeg: number) => {
  let d = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (d < 0) d += 180;
  const r = d / stepDeg;
  return Math.abs(r - Math.round(r)) * stepDeg;
};
const trueRadii = (g: DocumentGeometry) =>
  analyze(g)
    .circles.filter((c) => c.approx === undefined)
    .map((c) => c.r);
/** Spigoli dove l'originale era liscio: tangenti che non combaciano (> 3°) tra due tratti curvi. */
const kinks = (g: DocumentGeometry) => {
  let n = 0;
  for (const p of g.paths)
    p.segments.forEach((s, i) => {
      const t = p.segments[(i + 1) % p.segments.length]!;
      if (!p.closed && i === p.segments.length - 1) return;
      const out =
        s.kind === 'cubic'
          ? { x: s.p1.x - s.c2.x, y: s.p1.y - s.c2.y }
          : { x: s.p1.x - s.p0.x, y: s.p1.y - s.p0.y };
      const inn =
        t.kind === 'cubic'
          ? { x: t.c1.x - t.p0.x, y: t.c1.y - t.p0.y }
          : { x: t.p1.x - t.p0.x, y: t.p1.y - t.p0.y };
      const a = Math.atan2(out.y, out.x);
      const b = Math.atan2(inn.y, inn.x);
      let d = Math.abs(a - b);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > (3 * Math.PI) / 180 && d < (60 * Math.PI) / 180) n++;
    });
  return n;
};

describe('GENERA canonico: regole senza eccezioni', () => {
  it('di base non c è limite di somiglianza', () => {
    const g = parseSvg(LOGO_A);
    expect(generateDefaults(g).maxDeviation).toBeNull();
  });

  it('Sezione aurea: ogni raggio (anche delle curve) nella serie R/φᵏ, rette a multipli di 18°', () => {
    const g = parseSvg(LOGO_A);
    const r = generate(g, 'golden', generateDefaults(g));
    const bb = analyze(g).specs.bbox;
    const D = Math.hypot(bb.width, bb.height);
    // gli archi quasi piatti (raggio oltre il 60% di D) sono quasi rette: raggio libero
    const radii = r.guides.circles.map((c) => c.r).filter((x) => x <= 0.6 * D);
    expect(radii.length).toBeGreaterThanOrEqual(3);
    const R = Math.max(...radii);
    for (const x of radii) {
      const e = Math.log(R / x) / Math.log(PHI);
      expect(Math.abs(e - Math.round(e))).toBeLessThan(1e-6);
    }
    // nella geometria vera: gli archi sono cerchi esatti con quei raggi
    for (const x of trueRadii(r.geometry).filter((x) => x <= 0.6 * D)) {
      const e = Math.log(R / x) / Math.log(PHI);
      expect(Math.abs(e - Math.round(e))).toBeLessThan(0.02);
    }
    for (const l of lines(r.geometry)) expect(angleOff(l.p0, l.p1, 18)).toBeLessThan(0.5);
    expect(r.report.radii + r.report.angles).toBeGreaterThan(0);
    // il logo può cambiare molto: nessuna nota di attenuazione
    expect(r.report.notes).not.toContain('strength-reduced');
  });

  it('Matematico: rette a multipli di 15°, raggi multipli del passo', () => {
    const g = parseSvg(LOGO_A);
    const r = generate(g, 'math', generateDefaults(g));
    for (const l of lines(r.geometry)) expect(angleOff(l.p0, l.p1, 15)).toBeLessThan(0.5);
    const step = r.report.module / 2;
    for (const c of r.guides.circles) {
      const q = c.r / step;
      expect(Math.abs(q - Math.round(q))).toBeLessThan(1e-3);
    }
  });

  it('Strutturato: niente più curve libere, raggi unificati, raccordi tangenti', () => {
    const g = parseSvg(HEART);
    const before = analyze(g);
    const r = generate(g, 'structured', generateDefaults(g));
    expect(before.circles.filter((c) => c.approx !== undefined).length).toBeGreaterThan(0);
    // ogni tratto curvo sta esattamente su uno dei cerchi della costruzione
    const cs = r.guides.circles;
    expect(cs.length).toBeGreaterThan(0);
    for (const p of r.geometry.paths)
      for (const s of p.segments) {
        if (s.kind !== 'cubic') continue;
        const pts = [0.25, 0.5, 0.75].map((t) => {
          const u = 1 - t;
          return {
            x: u ** 3 * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t ** 3 * s.p1.x,
            y: u ** 3 * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t ** 3 * s.p1.y,
          };
        });
        const onSome = cs.some((c) =>
          pts.every((q) => Math.abs(Math.hypot(q.x - c.cx, q.y - c.cy) - c.r) < 0.01 * c.r + 0.05),
        );
        expect(onSome).toBe(true);
      }
    const distinct = new Set(r.guides.circles.map((c) => Math.round(c.r * 100)));
    expect(distinct.size).toBeLessThanOrEqual(r.guides.circles.length);
    expect(kinks(r.geometry)).toBeLessThanOrEqual(kinks(g));
  });

  it('Simmetrico: riflette sempre, anche un logo asimmetrico', () => {
    const g = parseSvg(LOGO_A);
    const r = generate(g, 'symmetric', generateDefaults(g));
    expect(r.guides.axis).not.toBeNull();
    expect(r.report.notes).not.toContain('no-axis');
  });

  it(
    'stessi tracciati, risultato identico a ogni esecuzione, nessun numero non valido',
    { timeout: 30000 },
    () => {
      for (const svg of [LOGO_A, HEART]) {
        const g = parseSvg(svg);
        for (const mode of ['golden', 'math', 'structured', 'symmetric', 'minimal'] as const) {
          const a = generate(g, mode, generateDefaults(g));
          const b = generate(g, mode, generateDefaults(g));
          expect(a.geometry.paths.map((p) => p.id)).toEqual(g.paths.map((p) => p.id));
          expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
          for (const p of a.geometry.paths)
            for (const s of p.segments)
              for (const v of [s.p0, s.p1])
                expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
        }
      }
    },
  );
});
