// Simmetria sulle forme: loghi quasi simmetrici disegnati a mano, ricalcati e corretti.
import { describe, expect, it } from 'vitest';
import {
  parseSvg,
  refine,
  refineDefaults,
  trace,
  traceDefaults,
  type DocumentGeometry,
  type RefineOptions,
  type Vec2,
} from '../src';
import { sketch, type Figure } from './helpers/tracebench';

const P = (x: number, y: number): Vec2 => ({ x, y });
const bez = (p: Vec2[], t: number): Vec2 => {
  const u = 1 - t;
  return {
    x: u ** 3 * p[0]!.x + 3 * u * u * t * p[1]!.x + 3 * u * t * t * p[2]!.x + t ** 3 * p[3]!.x,
    y: u ** 3 * p[0]!.y + 3 * u * u * t * p[1]!.y + 3 * u * t * t * p[2]!.y + t ** 3 * p[3]!.y,
  };
};
const chain = (cs: Vec2[][]) =>
  cs.flatMap((c) => Array.from({ length: 120 }, (_, i) => bez(c, i / 120)));
const circle = (cx: number, cy: number, r: number) =>
  Array.from({ length: 300 }, (_, i) =>
    P(cx + r * Math.cos((i / 300) * 2 * Math.PI), cy + r * Math.sin((i / 300) * 2 * Math.PI)),
  );

const SHIELD: Figure = {
  name: 'scudo',
  w: 500,
  h: 560,
  ideal: 5,
  corners: [],
  paths: [
    {
      closed: true,
      pts: chain([
        [P(250, 60), P(320, 100), P(380, 105), P(430, 100)],
        [P(430, 100), P(435, 280), P(390, 420), P(250, 500)],
        [P(250, 500), P(110, 420), P(65, 280), P(70, 100)],
        [P(70, 100), P(120, 105), P(180, 100), P(250, 60)],
      ]),
    },
  ],
};
const HEART: Figure = {
  name: 'cuore',
  w: 500,
  h: 480,
  ideal: 4,
  corners: [],
  paths: [
    {
      closed: true,
      pts: chain([
        [P(250, 140), P(290, 60), P(430, 60), P(430, 170)],
        [P(430, 170), P(430, 270), P(320, 340), P(250, 420)],
        [P(250, 420), P(180, 340), P(70, 270), P(70, 170)],
        [P(70, 170), P(70, 60), P(210, 60), P(250, 140)],
      ]),
    },
  ],
};
const DROP: Figure = {
  name: 'goccia con occhi',
  w: 500,
  h: 500,
  ideal: 12,
  corners: [],
  paths: [
    {
      closed: true,
      pts: chain([
        [P(250, 50), P(330, 170), P(400, 250), P(400, 330)],
        [P(400, 330), P(400, 420), P(330, 470), P(250, 470)],
        [P(250, 470), P(170, 470), P(100, 420), P(100, 330)],
        [P(100, 330), P(100, 250), P(170, 170), P(250, 50)],
      ]),
    },
    { closed: true, pts: circle(190, 320, 34) },
    { closed: true, pts: circle(310, 320, 34) },
  ],
};

const traced = (fig: Figure, level: 'normale' | 'difficile'): DocumentGeometry =>
  trace(sketch(fig, level, 1), traceDefaults(fig.w, fig.h), { x: 0, y: 0, scale: 1 }).geometry;

const samples = (g: DocumentGeometry): Vec2[] =>
  g.paths.flatMap((p) =>
    p.segments.flatMap((s) =>
      Array.from({ length: 30 }, (_, k) => {
        const t = k / 30;
        return s.kind === 'line'
          ? P(s.p0.x + (s.p1.x - s.p0.x) * t, s.p0.y + (s.p1.y - s.p0.y) * t)
          : bez([s.p0, s.c1, s.c2, s.p1], t);
      }),
    ),
  );
/** Scarto massimo tra il disegno e il suo riflesso rispetto alla verticale x = c. */
const mirrorGap = (g: DocumentGeometry, c: number) => {
  const pts = samples(g);
  let worst = 0;
  for (const p of pts) {
    let best = Infinity;
    for (const q of pts) best = Math.min(best, Math.hypot(2 * c - p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
};
/** Distanza massima di ogni punto di `a` dal disegno `b` (quanto è cambiata la forma). */
const drift = (a: DocumentGeometry, b: DocumentGeometry) => {
  const pb = samples(b);
  let worst = 0;
  for (const p of samples(a)) {
    let best = Infinity;
    for (const q of pb) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
};
const withSym = (g: DocumentGeometry, patch: Partial<RefineOptions['symmetry']>) => {
  const o = refineDefaults(g).options;
  return { ...o, symmetry: { ...o.symmetry, ...patch } };
};

describe('simmetria sulle forme (loghi disegnati a mano e ricalcati)', () => {
  for (const fig of [SHIELD, HEART, DROP]) {
    for (const level of ['normale', 'difficile'] as const) {
      it(`${fig.name}, ${level}: con i valori predefiniti diventa simmetrico`, () => {
        const g = traced(fig, level);
        const r = refine(g, refineDefaults(g).options);
        expect(r.report.axis?.theta).toBe(0);
        const c = r.report.axis!.rho;
        expect(Math.abs(c - 250)).toBeLessThan(6);
        expect(mirrorGap(r.geometry, c)).toBeLessThan(0.05 * fig.w * 0.02 + 0.6);
        // stessa forma di prima, a meno di qualche px; stesso numero di tracciati
        expect(drift(r.geometry, g)).toBeLessThan(0.03 * fig.w);
        expect(r.geometry.paths).toHaveLength(g.paths.length);
      });
    }
  }

  it('metà scelta: la sinistra resta com era, la destra ne è il riflesso', () => {
    const g = parseSvg(
      '<svg><path d="M100 0 C150 0 210 50 200 110 C190 170 150 200 100 200 C50 200 0 160 0 100 C0 40 50 0 100 0 Z"/></svg>',
    );
    const r = refine(g, withSym(g, { keep: 'left' }));
    expect(r.report.axis).toEqual({ theta: 0, rho: expect.closeTo(100, 0) });
    const c = r.report.axis!.rho;
    expect(mirrorGap(r.geometry, c)).toBeLessThan(0.5);
    // il lato sinistro (x < 90) non si muove
    const left = samples(g).filter((p) => p.x < 90);
    const out = samples(r.geometry);
    for (const p of left) {
      const d = Math.min(...out.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
      expect(d).toBeLessThan(3); // le altre correzioni (archi esatti) la ritoccano appena
    }
  });

  it('in automatico non forza un logo chiaramente asimmetrico', () => {
    const g = parseSvg('<svg><path d="M0 0 L100 0 L30 80 Z"/></svg>');
    const r = refine(g, refineDefaults(g).options);
    expect(r.report.axis).toBeNull();
    expect(r.report.symmetryNote).toBe('too-different');
  });
});
