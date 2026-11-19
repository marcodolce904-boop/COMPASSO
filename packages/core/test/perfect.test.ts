// RICALCA · Perfeziona: ricalco fedele, archi tangenti, simmetria sul campo (docs/PERFEZIONA.md).
import { describe, expect, it } from 'vitest';
import { trace, traceDefaults, type DocumentGeometry, type Segment, type Vec2 } from '../src';
import { circlePts, fill, paper } from './helpers/sketch';

const place = { x: 0, y: 0, scale: 1 };
const perfect = (w: number, h: number, p: Record<string, unknown> = {}) => ({
  ...traceDefaults(w, h),
  mode: 'perfect' as const,
  perfect: { tolerance: 0.003, symmetry: 'auto' as const, softness: 0.5, ...p },
});

const at = (s: Segment, t: number): Vec2 => {
  if (s.kind === 'line')
    return { x: s.p0.x + (s.p1.x - s.p0.x) * t, y: s.p0.y + (s.p1.y - s.p0.y) * t };
  const u = 1 - t;
  return {
    x: u ** 3 * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t ** 3 * s.p1.x,
    y: u ** 3 * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t ** 3 * s.p1.y,
  };
};
const samples = (g: DocumentGeometry, i = 0): Vec2[] =>
  g.paths[i]!.segments.flatMap((s) => Array.from({ length: 12 }, (_, k) => at(s, k / 12)));
/** Direzioni d'uscita e d'entrata di un segmento (per la continuità delle tangenti). */
const dirIn = (s: Segment) => {
  const q = s.kind === 'line' ? s.p0 : s.c2;
  const d = { x: s.p1.x - q.x, y: s.p1.y - q.y };
  const l = Math.hypot(d.x, d.y) || 1;
  return { x: d.x / l, y: d.y / l };
};
const dirOut = (s: Segment) => {
  const q = s.kind === 'line' ? s.p1 : s.c1;
  const d = { x: q.x - s.p0.x, y: q.y - s.p0.y };
  const l = Math.hypot(d.x, d.y) || 1;
  return { x: d.x / l, y: d.y / l };
};
/** Numero di spigoli (tangenti che non continuano) lungo un tracciato chiuso. */
const kinks = (g: DocumentGeometry, i = 0) => {
  const s = g.paths[i]!.segments;
  let n = 0;
  for (let k = 0; k < s.length; k++) {
    const a = dirIn(s[k]!),
      b = dirOut(s[(k + 1) % s.length]!);
    if (a.x * b.x + a.y * b.y < Math.cos((20 * Math.PI) / 180)) n++;
  }
  return n;
};

describe('Perfeziona: precisione e archi', () => {
  it('un disco piccolo diventa pochi archi sul bordo vero', () => {
    const img = paper(140, 140);
    fill(img, circlePts(70, 70, 50, 180));
    const out = trace(img, perfect(140, 140), place);
    expect(out.geometry.paths).toHaveLength(1);
    const pts = samples(out.geometry);
    const err = Math.max(...pts.map((p) => Math.abs(Math.hypot(p.x - 70, p.y - 70) - 50)));
    expect(err).toBeLessThan(1);
    // pochi archi: al più 6 per metà (la metà destra è il riflesso della sinistra)
    expect(out.perfect!.arcs).toBeLessThanOrEqual(12);
    expect(kinks(out.geometry)).toBe(0);
  });

  it('le punte di una stella restano spigoli, il resto è tangente', () => {
    const star: Vec2[] = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5,
        r = k % 2 ? 60 : 140;
      star.push({ x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) });
    }
    const img = paper(400, 400);
    fill(img, star);
    const out = trace(img, perfect(400, 400, { symmetry: 'none' }), place);
    expect(out.geometry.paths).toHaveLength(1);
    const n = kinks(out.geometry);
    expect(n).toBeGreaterThanOrEqual(10);
    expect(n).toBeLessThanOrEqual(12);
  });

  it('disegno chiaro su fondo scuro: stesso risultato', () => {
    const img = paper(160, 160);
    for (let i = 0; i < img.data.length; i += 4)
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 30;
    fill(img, circlePts(80, 80, 55, 180), 240);
    const out = trace(img, perfect(160, 160), place);
    expect(out.geometry.paths).toHaveLength(1);
    const pts = samples(out.geometry);
    expect(Math.max(...pts.map((p) => Math.abs(Math.hypot(p.x - 80, p.y - 80) - 55)))).toBeLessThan(
      1.2,
    );
  });
});

describe('Perfeziona: simmetria', () => {
  // goccia quasi simmetrica: il lato destro è un po' più gonfio
  const drop = () => {
    const pts: Vec2[] = [];
    for (let k = 0; k < 240; k++) {
      const a = (k / 240) * 2 * Math.PI;
      const bulge = Math.cos(a) > 0 ? 1.04 : 1;
      const r = 90 * (1 - 0.35 * Math.sin(a));
      pts.push({ x: 200 + r * Math.cos(a) * bulge, y: 210 + r * Math.sin(a) });
    }
    const img = paper(400, 400);
    fill(img, pts);
    return img;
  };
  const mirrorGap = (g: DocumentGeometry, axis: number) => {
    const pts = samples(g);
    let worst = 0;
    for (const p of pts) {
      const m = { x: 2 * axis - p.x, y: p.y };
      worst = Math.max(worst, Math.min(...pts.map((q) => Math.hypot(q.x - m.x, q.y - m.y))));
    }
    return worst;
  };

  it('auto: trova l’asse verticale e rende le due metà uguali', () => {
    const out = trace(drop(), perfect(400, 400), place);
    const r = out.perfect!;
    expect(r.symmetry).toBe('vertical');
    expect(Math.abs(r.axis! - 200)).toBeLessThan(3);
    expect(mirrorGap(out.geometry, r.axis!)).toBeLessThan(1.5);
  });

  it('simmetria spenta: la forma resta com’è (asimmetrica)', () => {
    const out = trace(drop(), perfect(400, 400, { symmetry: 'none' }), place);
    expect(out.perfect!.symmetry).toBeNull();
    expect(mirrorGap(out.geometry, 200)).toBeGreaterThan(2);
  });

  it('una forma per niente simmetrica: la simmetria si rifiuta e lo dice', () => {
    const img = paper(400, 400);
    fill(img, [
      { x: 60, y: 60 },
      { x: 340, y: 90 },
      { x: 120, y: 340 },
    ]);
    fill(img, circlePts(300, 300, 50, 120));
    const out = trace(img, perfect(400, 400), place);
    expect(out.perfect!.symmetry).toBeNull();
    expect(out.perfect!.note).toBe('too-different');
  });
});

describe('Perfeziona: forme e fori', () => {
  it('un anello pieno: forma esterna e foro, nel verso giusto', () => {
    const img = paper(300, 300);
    fill(img, circlePts(150, 150, 110, 240));
    fill(img, circlePts(150, 150, 60, 240), 255);
    const out = trace(img, perfect(300, 300), place);
    expect(out.geometry.paths).toHaveLength(2);
    expect(out.perfect!.shapes).toBe(2);
  });
});

describe('Perfeziona: costruzione da disegnare', () => {
  it('cerchi degli archi e asse di simmetria nel piano, sul layer di costruzione', async () => {
    const { perfectPlan, geometryBBox, LAYER_NAME } = await import('../src');
    const img = paper(300, 300);
    fill(img, circlePts(150, 150, 100, 240));
    const out = trace(img, perfect(300, 300), place);
    const plan = perfectPlan(out.perfect!, geometryBBox(out.geometry.paths), {
      strokeWidth: 0.5,
      markerSize: 4,
      color: 'auto',
      axisDash: [4, 3],
      lineExtent: 'segment',
    });
    expect(plan.layerName).toBe(LAYER_NAME);
    const circles = plan.primitives.filter((p) => p.type === 'circle');
    expect(circles.length).toBeGreaterThan(0);
    // il cerchio della costruzione è quello vero del disco
    expect(circles.some((c) => c.type === 'circle' && Math.abs(c.r - 100) < 2)).toBe(true);
    expect(plan.primitives.some((p) => p.type === 'line' && p.group === 'axes')).toBe(true);
  });
});

describe('Perfeziona: asse della costruzione', () => {
  it('l’asse verticale passa per il centro e copre tutta l’altezza', async () => {
    const { perfectPlan, geometryBBox } = await import('../src');
    const img = paper(300, 300);
    fill(img, circlePts(150, 150, 100, 240));
    const out = trace(img, perfect(300, 300, { symmetry: 'vertical' }), place);
    const plan = perfectPlan(out.perfect!, geometryBBox(out.geometry.paths), {
      strokeWidth: 0.5,
      markerSize: 4,
      color: 'auto',
      axisDash: [4, 3],
      lineExtent: 'segment',
    });
    const ax = plan.primitives.find((p) => p.type === 'line');
    expect(
      ax && ax.type === 'line' && Math.abs(ax.a.x - 150) < 2 && ax.a.y < 50 && ax.b.y > 250,
    ).toBe(true);
  });
});
