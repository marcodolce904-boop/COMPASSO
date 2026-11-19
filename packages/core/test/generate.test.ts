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
/** Modalità limitata (vecchio comportamento): scarto massimo al 3% della diagonale. */
const limited = (g: DocumentGeometry) => ({ ...generateDefaults(g), maxDeviation: 0.03 * diag(g) });

const offMultiple = (v: number, step: number) => {
  const r = Math.abs(v / step - Math.round(v / step));
  return r * step;
};

describe('GENERA: regole comuni', () => {
  for (const mode of ['math', 'minimal', 'symmetric', 'structured', 'golden'] as const) {
    it(`${mode}: stesso numero di tracciati, entro lo scarto massimo, deterministico`, () => {
      for (const svg of [LOGO_A, LOGO_C]) {
        const g = parseSvg(svg);
        const o = limited(g);
        const a = generate(g, mode, o);
        const b = generate(g, mode, o);
        expect(a.geometry.paths).toHaveLength(g.paths.length);
        expect(a.geometry.paths.map((p) => p.id)).toEqual(g.paths.map((p) => p.id));
        expect(geometryDrift(a.geometry, g)).toBeLessThanOrEqual(o.maxDeviation! + 1e-6);
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
        for (const mode of ['math', 'minimal', 'symmetric', 'structured', 'golden'] as const)
          expect(geometryDrift(generate(g, mode, o).geometry, g)).toBeLessThanOrEqual(
            o.maxDeviation! + 1e-6,
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
    const base = generate(g, 'minimal', limited(g));
    const o = { ...limited(g), minimal: { level: 'medium' as const, maxAnchors: 10 } };
    const r = generate(g, 'minimal', o);
    expect(r.report.anchorsAfter).toBeLessThanOrEqual(base.report.anchorsAfter);
    expect(geometryDrift(r.geometry, g)).toBeLessThanOrEqual(o.maxDeviation! + 1e-6);
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

// cuore disegnato a mano: quasi simmetrico, punti diversi sui due lati
const HEART =
  '<svg><path d="M249.43 413.50C185.87 364.47 88.31 282.09 72.57 199.31C48.22 71.21 179.35 64.14 250.50 134.66C314.20 66.78 448.94 68.63 427.75 191.50C412.23 281.54 316.33 359.40 249.43 413.50Z"/></svg>';

/** Scarto massimo tra il disegno e il suo riflesso rispetto alla verticale x = c. */
const mirrorGap = (g: DocumentGeometry, c: number) => {
  const pts: Vec2[] = [];
  for (const p of g.paths)
    for (const s of p.segments)
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const u = 1 - t;
        pts.push(
          s.kind === 'line'
            ? { x: s.p0.x * u + s.p1.x * t, y: s.p0.y * u + s.p1.y * t }
            : {
                x:
                  u ** 3 * s.p0.x +
                  3 * u * u * t * s.c1.x +
                  3 * u * t * t * s.c2.x +
                  t ** 3 * s.p1.x,
                y:
                  u ** 3 * s.p0.y +
                  3 * u * u * t * s.c1.y +
                  3 * u * t * t * s.c2.y +
                  t ** 3 * s.p1.y,
              },
        );
      }
  let worst = 0;
  for (const p of pts) {
    let best = Infinity;
    for (const q of pts) best = Math.min(best, Math.hypot(2 * c - p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
};

describe('GENERA: Simmetrico', () => {
  it('un logo quasi simmetrico disegnato a mano diventa simmetrico, con l asse nelle guide', () => {
    const g = parseSvg(HEART);
    const r = generate(g, 'symmetric', generateDefaults(g));
    expect(r.guides.axis).not.toBeNull();
    const ax = r.guides.axis!;
    expect(Math.abs(ax.x1 - ax.x2)).toBeLessThan(1e-9); // asse verticale
    expect(mirrorGap(r.geometry, ax.x1)).toBeLessThan(1);
    expect(mirrorGap(g, ax.x1)).toBeGreaterThan(3);
    expect(r.report.notes).not.toContain('no-axis');
  });

  it('metà scelta: la metà sinistra resta com era', () => {
    const g = parseSvg(HEART);
    const o = generateDefaults(g);
    const r = generate(g, 'symmetric', { ...o, symmetric: { axis: 'auto', keep: 'left' } });
    expect(r.guides.axis).not.toBeNull();
    expect(mirrorGap(r.geometry, r.guides.axis!.x1)).toBeLessThan(1);
  });

  it('modalità limitata: un logo asimmetrico resta com è e il riepilogo dice perché', () => {
    const g = parseSvg(LOGO_A);
    const r = generate(g, 'symmetric', limited(g));
    expect(r.guides.axis).toBeNull();
    expect(r.report.notes).toContain('no-axis');
  });
});

describe('GENERA: Strutturato', () => {
  it('le curve libere diventano archi di cerchio veri, tangenti tra loro', () => {
    const g = parseSvg(LOGO_A);
    const before = analyze(g);
    const r = generate(g, 'structured', limited(g));
    expect(r.report.arcCurves).toBeGreaterThan(0);
    expect(r.report.arcs).toBeGreaterThanOrEqual(r.report.arcCurves);
    expect(r.guides.circles.length).toBe(r.report.arcs);
    // dopo: la coda è fatta di archi veri (più cerchi veri, meno curve libere approssimate)
    const after = analyze(r.geometry);
    const real = (a: typeof before) => a.circles.filter((c) => c.approx === undefined).length;
    const free = (a: typeof before) => a.circles.filter((c) => c.approx !== undefined).length;
    expect(real(after)).toBeGreaterThan(real(before));
    expect(free(after)).toBeLessThan(free(before));
    // ogni anchor della coda sta su una curva liscia (niente spigoli nuovi tra gli archi)
    const tail = r.geometry.paths.find((p) => p.id === g.paths[3]!.id)!;
    let kinks = 0;
    tail.segments.forEach((s, i) => {
      const n = tail.segments[(i + 1) % tail.segments.length]!;
      if (s.kind !== 'cubic' || n.kind !== 'cubic') return;
      const a = Math.atan2(s.p1.y - s.c2.y, s.p1.x - s.c2.x);
      const b = Math.atan2(n.c1.y - n.p0.y, n.c1.x - n.p0.x);
      let d = Math.abs(a - b);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > (3 * Math.PI) / 180) kinks++;
    });
    const kinksBefore = g.paths[3]!.segments.reduce((k, s, i, arr) => {
      const n = arr[(i + 1) % arr.length]!;
      if (s.kind !== 'cubic' || n.kind !== 'cubic') return k;
      const a = Math.atan2(s.p1.y - s.c2.y, s.p1.x - s.c2.x);
      const b = Math.atan2(n.c1.y - n.p0.y, n.c1.x - n.p0.x);
      let d = Math.abs(a - b);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d > (3 * Math.PI) / 180 ? k + 1 : k;
    }, 0);
    expect(kinks).toBeLessThanOrEqual(kinksBefore);
  });

  it('modalità limitata: un logo fatto solo di rette e cerchi non cambia', () => {
    const g = parseSvg(LOGO_C);
    const r = generate(g, 'structured', limited(g));
    expect(r.report.arcCurves).toBe(0);
    expect(r.report.notes).toContain('nothing-to-do');
  });
});

const PHI = (1 + Math.sqrt(5)) / 2;

describe('GENERA: Sezione aurea', () => {
  // riquadro 0..200 (cornice) con tre cerchi quasi in serie aurea: 50, 31.5 (≈ 50/φ), 19.6 (≈ 50/φ²)
  const RINGS =
    '<svg><path d="M0 0 L200 0 L200 200 L0 200 Z M8 8 L8 192 L192 192 L192 8 Z"/><circle cx="100" cy="100" r="50"/><circle cx="76" cy="160" r="31.5"/><circle cx="150" cy="45" r="19.6"/></svg>';

  it('raggi in serie R, R/φ, R/φ² (il più grande resta com è), con le etichette', () => {
    const g = parseSvg(RINGS);
    const o = { ...generateDefaults(g), maxDeviation: 0.05 * diag(g) };
    const r = generate(g, 'golden', o);
    const cs = analyze(r.geometry)
      .circles.filter((c) => c.approx === undefined && c.r < 90)
      .map((c) => c.r)
      .sort((a, b) => b - a);
    expect(cs.length).toBe(3);
    expect(cs[0]).toBeCloseTo(50, 1);
    expect(cs[1]).toBeCloseTo(50 / PHI, 1);
    expect(cs[2]).toBeCloseTo(50 / PHI ** 2, 1);
    expect(r.report.radii).toBeGreaterThanOrEqual(2);
    const labels = r.guides.circles.map((c) => c.label).sort();
    expect(labels).toEqual(['R', 'R/φ', 'R/φ²'].sort());
  });

  it('centri vicini alla griglia aurea ci si appoggiano (0,382 della larghezza)', () => {
    const g = parseSvg(RINGS);
    const o = { ...generateDefaults(g), maxDeviation: 0.05 * diag(g) };
    const r = generate(g, 'golden', o);
    const c = analyze(r.geometry).circles.find(
      (k) => k.approx === undefined && Math.abs(k.cy - 160) < 10,
    )!;
    expect(c.cx).toBeCloseTo(200 / PHI ** 2, 1); // 76,39
    expect(r.report.positions).toBeGreaterThan(0);
    expect(r.guides.lines.length).toBeGreaterThan(4);
    expect(r.guides.spiral.length).toBeGreaterThan(10);
  });

  it('spessori quasi in rapporto φ diventano esattamente φ', () => {
    // due barre verticali larghe 30 e 19 (30/19 ≈ 1,58)
    const g = parseSvg(
      '<svg><path d="M0 0 L30 0 L30 200 L0 200 Z"/><path d="M100 0 L119 0 L119 200 L100 200 Z"/></svg>',
    );
    const o = { ...generateDefaults(g), maxDeviation: 0.05 * diag(g) };
    const r = generate(g, 'golden', o);
    const w = r.geometry.paths.map((p) => {
      const xs = p.segments.map((s) => s.p0.x);
      return Math.max(...xs) - Math.min(...xs);
    });
    const [thick, thin] = [Math.max(...w), Math.min(...w)];
    expect(thick / thin).toBeCloseTo(PHI, 2);
    expect(r.report.thickness).toBeGreaterThan(0);
  });

  it('rapporto 1:1: i cerchi diventano tutti uguali', () => {
    const g = parseSvg(RINGS);
    const o = generateDefaults(g);
    const r = generate(g, 'golden', {
      ...o,
      maxDeviation: 0.2 * diag(g),
      golden: { ...o.golden, ratio: '1:1' },
    });
    const cs = analyze(r.geometry).circles.filter((c) => c.approx === undefined && c.r < 90);
    for (const c of cs) expect(c.r).toBeCloseTo(50, 1);
  });

  it('nessuna misura vicina alla sezione aurea: il logo resta com era e la nota lo dice', () => {
    const g = parseSvg('<svg><path d="M0 0 L100 0 L30 80 Z"/></svg>');
    const r = generate(g, 'golden', limited(g));
    expect(r.report.notes).toContain('no-golden');
    expect(geometryDrift(r.geometry, g)).toBeLessThan(1);
  });
});
