// Curve libere spiegate con archi tangenti (A) e rette disegnate solo sul loro tratto (C).
import { describe, expect, it } from 'vitest';
import { analyze, parseSvg, plan, arcSpline, type Vec2 } from '../src';

const bez = (p: Vec2[], t: number): Vec2 => {
  const u = 1 - t;
  return {
    x: u ** 3 * p[0]!.x + 3 * u * u * t * p[1]!.x + 3 * u * t * t * p[2]!.x + t ** 3 * p[3]!.x,
    y: u ** 3 * p[0]!.y + 3 * u * u * t * p[1]!.y + 3 * u * t * t * p[2]!.y + t ** 3 * p[3]!.y,
  };
};
const P = (x: number, y: number): Vec2 => ({ x, y });

// logo di prova sul modello della «A con coda»: due gambe e una coda a onda (curve libere)
const TAIL =
  'M20 190 C80 120 160 130 230 170 C260 185 280 175 300 150 C315 175 318 200 310 215 C290 262 240 272 200 252 C150 226 90 214 20 190 Z';
const LOGO = `<svg><path d="M120 20 L170 20 L150 150 L105 150 Z"/><path d="M200 20 L240 20 L290 330 L250 330 Z"/><path d="M95 230 L130 230 L110 330 L70 330 Z"/><path d="${TAIL}"/></svg>`;

describe('archi tangenti per le curve libere', () => {
  it('una curva a S si spiega con pochi archi, tangenti tra loro, entro la tolleranza', () => {
    const c = [P(0, 0), P(60, -80), P(140, 80), P(200, 0)];
    const pts = Array.from({ length: 401 }, (_, i) => bez(c, i / 400));
    const tol = 1.5;
    const arcs = arcSpline(pts, tol, 6)!;
    expect(arcs).not.toBeNull();
    expect(arcs.length).toBeGreaterThanOrEqual(2);
    expect(arcs.length).toBeLessThanOrEqual(4);
    for (const a of arcs) expect(a.deviation).toBeLessThanOrEqual(tol + 1e-9);
    // catena continua: ogni arco parte dove finisce il precedente, con la stessa tangente
    // (centri e punto di passaggio allineati)
    for (let i = 1; i < arcs.length; i++) {
      const a = arcs[i - 1]!;
      const b = arcs[i]!;
      expect(Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y)).toBeLessThan(1e-9);
      const u = { x: a.cx - a.to.x, y: a.cy - a.to.y };
      const v = { x: b.cx - b.from.x, y: b.cy - b.from.y };
      const cross = Math.abs(u.x * v.y - u.y * v.x) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
      expect(cross).toBeLessThan(1e-6);
    }
    expect(arcs[0]!.from).toEqual(pts[0]);
    expect(Math.hypot(arcs.at(-1)!.to.x - 200, arcs.at(-1)!.to.y)).toBeLessThan(1e-9);
  });

  it('se servirebbero troppi archi rinuncia (null)', () => {
    const pts = Array.from({ length: 801 }, (_, i) => P(i / 2, 20 * Math.sin(i / 20)));
    expect(arcSpline(pts, 0.2, 4)).toBeNull();
  });

  it('analisi: la coda ha la sua costruzione ad archi approssimati, tratteggiati', () => {
    const r = analyze(parseSvg(LOGO));
    const approx = r.circles.filter((c) => c.approx !== undefined);
    expect(approx.length).toBeGreaterThanOrEqual(2);
    for (const c of approx) {
      expect(c.approx!).toBeGreaterThan(0);
      expect(r.levels.structure).toContain(c.id);
      expect(r.levels.essential).not.toContain(c.id);
    }
    const p = plan(r, {
      level: 'structure',
      style: { lineExtent: 'segment' } as Parameters<typeof plan>[1]['style'],
    });
    const drawn = p.primitives.filter(
      (q) => q.type === 'circle' && approx.some((c) => c.id === q.id),
    );
    expect(drawn.length).toBe(approx.length);
    for (const q of drawn) expect(q.type === 'circle' && q.dashed).toBe(true);
    // i cerchi veri restano a tratto pieno
    const solid = p.primitives.filter(
      (q) => q.type === 'circle' && !approx.some((c) => c.id === q.id),
    );
    for (const q of solid) expect(q.type === 'circle' && q.dashed).toBeFalsy();
  });
});

describe('rette al tratto', () => {
  it('ogni retta ricorda il tratto che descrive e si disegna solo lì (più un margine)', () => {
    const r = analyze(parseSvg(LOGO));
    const D = Math.hypot(r.specs.bbox.width, r.specs.bbox.height);
    for (const l of r.lines) expect(l.span).toBeDefined();
    const long = plan(r, { level: 'full', style: { lineExtent: 'bbox-margin' } as never });
    const short = plan(r, { level: 'full', style: { lineExtent: 'segment' } as never });
    const len = (q: { a: Vec2; b: Vec2 }) => Math.hypot(q.b.x - q.a.x, q.b.y - q.a.y);
    let total = 0;
    let totalLong = 0;
    for (const l of r.lines) {
      const s = short.primitives.find((q) => q.id === l.id);
      const g = long.primitives.find((q) => q.id === l.id);
      if (!s || s.type !== 'line' || !g || g.type !== 'line') continue;
      const spanLen = Math.hypot(l.span![1].x - l.span![0].x, l.span![1].y - l.span![0].y);
      expect(len(s)).toBeLessThanOrEqual(spanLen + 2 * Math.max(0.1 * spanLen, 0.04 * D) + 1e-6);
      expect(len(s)).toBeGreaterThanOrEqual(spanLen - 1e-6);
      total += len(s);
      totalLong += len(g);
    }
    expect(total).toBeLessThan(0.7 * totalLong);
    // gli assi di simmetria restano lunghi
    for (const q of short.primitives)
      if (q.type === 'line' && q.group === 'axes')
        expect(len(q)).toBeGreaterThan(0.9 * r.specs.bbox.height);
  });
});
