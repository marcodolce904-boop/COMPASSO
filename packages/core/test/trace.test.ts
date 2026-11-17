import { describe, expect, it } from 'vitest';
import { analyze, trace, traceDefaults, type DocumentGeometry } from '../src';
import { circlePts, fill, paper, pencil } from './helpers/sketch';

const place = { x: 0, y: 0, scale: 1 };
const anchors = (g: DocumentGeometry) =>
  g.paths.reduce((s, p) => s + p.segments.length + (p.closed ? 0 : 1), 0);
const area = (g: DocumentGeometry, i: number) => {
  // anchor e punti a metà delle cubiche (con due soli anchor l'area sugli anchor è nulla)
  const pts = g.paths[i]!.segments.flatMap((s) =>
    s.kind === 'line'
      ? [s.p0]
      : [
          s.p0,
          {
            x: (s.p0.x + 3 * s.c1.x + 3 * s.c2.x + s.p1.x) / 8,
            y: (s.p0.y + 3 * s.c1.y + 3 * s.c2.y + s.p1.y) / 8,
          },
        ],
  );
  let a = 0;
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k]!;
    const q = pts[(k + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
};

describe('ricalco: linee', () => {
  it('un cerchio a matita (3 passate storte) → un tracciato chiuso con pochi anchor', () => {
    const img = paper(500, 500);
    pencil(img, circlePts(250, 250, 150), { passes: 3, wobble: 2.5, seed: 3 });
    const out = trace(img, traceDefaults(500, 500), place);
    expect(out.geometry.paths).toHaveLength(1);
    const p = out.geometry.paths[0]!;
    expect(p.closed).toBe(true);
    expect(anchors(out.geometry)).toBeLessThanOrEqual(8);
    const cs = analyze(out.geometry, { tolerance: 'loose' }).circles;
    expect(cs.length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(cs[0]!.r - 150)).toBeLessThan(5);
  });

  it('un quadrato a matita con i lati ripassati → 4 lati dritti, 4 spigoli', () => {
    const img = paper(400, 400);
    const sq = [
      { x: 80, y: 80 },
      { x: 320, y: 80 },
      { x: 320, y: 320 },
      { x: 80, y: 320 },
      { x: 80, y: 80 },
    ];
    pencil(img, sq, { passes: 2, wobble: 1.5, seed: 5 });
    const out = trace(img, traceDefaults(400, 400), place);
    expect(out.geometry.paths).toHaveLength(1);
    const segs = out.geometry.paths[0]!.segments;
    expect(segs.length).toBe(4);
    expect(segs.every((s) => s.kind === 'line')).toBe(true);
  });

  it('una curva a S aperta → un tracciato aperto, morbido, con pochi anchor', () => {
    const img = paper(600, 300);
    const s = Array.from({ length: 121 }, (_, i) => {
      const t = i / 120;
      return { x: 50 + 500 * t, y: 150 + 90 * Math.sin(t * 2 * Math.PI) };
    });
    pencil(img, s, { passes: 3, wobble: 2, seed: 9 });
    const out = trace(img, traceDefaults(600, 300), place);
    expect(out.geometry.paths).toHaveLength(1);
    expect(out.geometry.paths[0]!.closed).toBe(false);
    expect(anchors(out.geometry)).toBeLessThanOrEqual(6);
  });

  it('macchie e puntini spariscono; deterministico', () => {
    const img = paper(400, 400);
    pencil(img, circlePts(200, 200, 100), { seed: 2 });
    for (let k = 0; k < 20; k++)
      pencil(
        img,
        [
          { x: 20 + k * 18, y: 380 },
          { x: 21 + k * 18, y: 380 },
        ],
        { width: 2, passes: 1, wobble: 0 },
      );
    const a = trace(img, traceDefaults(400, 400), place);
    const b = trace(img, traceDefaults(400, 400), place);
    expect(a.geometry.paths).toHaveLength(1);
    expect(a.geometry).toEqual(b.geometry);
  });
});

describe('ricalco: forme piene', () => {
  it('anello pieno → contorno esterno orario e buco antiorario, stesso glifo', () => {
    const img = paper(400, 400);
    fill(img, circlePts(200, 200, 150, 120));
    // buco: ridipinge di bianco
    const hole = paper(400, 400);
    fill(hole, circlePts(200, 200, 80, 120), 255);
    for (let y = 0; y < 400; y++)
      for (let x = 0; x < 400; x++)
        if (Math.hypot(x + 0.5 - 200, y + 0.5 - 200) < 80) {
          const i = (y * 400 + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        }
    const out = trace(img, { ...traceDefaults(400, 400), mode: 'shapes' }, place);
    const g = out.geometry;
    expect(g.paths).toHaveLength(2);
    const [outer, inner] = Math.abs(area(g, 0)) > Math.abs(area(g, 1)) ? [0, 1] : [1, 0];
    expect(area(g, outer)).toBeGreaterThan(0); // y in giù: area positiva = senso orario
    expect(area(g, inner)).toBeLessThan(0);
    expect(g.paths[0]!.glyphId).toBe(g.paths[1]!.glyphId);
    expect(anchors(g)).toBeLessThanOrEqual(14);
    expect(analyze(g, { tolerance: 'loose' }).circles.length).toBe(2);
  });
});

describe('ricalco: casi realistici', () => {
  it('fulmine a matita (poligono con spigoli vivi) → un tracciato, un lato per segmento', () => {
    const img = paper(500, 600);
    const bolt = [
      { x: 300, y: 40 },
      { x: 140, y: 330 },
      { x: 250, y: 320 },
      { x: 180, y: 560 },
      { x: 380, y: 240 },
      { x: 270, y: 255 },
      { x: 300, y: 40 },
    ];
    pencil(img, bolt, { passes: 3, wobble: 1.8, width: 3, seed: 11 });
    const out = trace(img, traceDefaults(500, 600), place);
    expect(out.geometry.paths).toHaveLength(1);
    const p = out.geometry.paths[0]!;
    expect(p.closed).toBe(true);
    expect(p.segments).toHaveLength(6);
    expect(p.segments.every((s) => s.kind === 'line')).toBe(true);
  });

  it('due tratti che si incrociano restano due linee intere', () => {
    const img = paper(500, 500);
    pencil(
      img,
      [
        { x: 60, y: 250 },
        { x: 440, y: 250 },
      ],
      { seed: 1 },
    );
    pencil(
      img,
      [
        { x: 250, y: 60 },
        { x: 250, y: 440 },
      ],
      { seed: 2 },
    );
    const out = trace(img, traceDefaults(500, 500), place);
    expect(out.geometry.paths).toHaveLength(2);
    for (const p of out.geometry.paths) {
      expect(p.segments).toHaveLength(1);
      expect(p.segments[0]!.kind).toBe('line');
    }
  });

  it('foto grande (1600×1200) in tempi da pannello', () => {
    const img = paper(1600, 1200);
    pencil(img, circlePts(430, 600, 300), { width: 6, wobble: 4, seed: 4 });
    pencil(img, circlePts(1180, 600, 250, 200, 330), { width: 6, wobble: 4, seed: 6 });
    const t = performance.now();
    const out = trace(img, traceDefaults(1600, 1200), place);
    const ms = performance.now() - t;
    expect(out.geometry.paths).toHaveLength(2);
    expect(ms).toBeLessThan(6000);
    const a = analyze(out.geometry, { tolerance: 'loose' });
    expect(a.circles.length + a.ellipses.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ricalco: tratti quasi chiusi', () => {
  it('un triangolo con un lato che non arriva fino in fondo si chiude', () => {
    const img = paper(500, 500);
    pencil(
      img,
      [
        { x: 100, y: 400 },
        { x: 250, y: 100 },
        { x: 400, y: 400 },
        { x: 112, y: 400 },
      ],
      {
        passes: 2,
        wobble: 1.5,
        seed: 3,
      },
    );
    const out = trace(img, traceDefaults(500, 500), place);
    expect(out.geometry.paths).toHaveLength(1);
    const p = out.geometry.paths[0]!;
    expect(p.closed).toBe(true);
    expect(p.segments).toHaveLength(3);
  });
});
