// RICALCA · Crea forme: contorni precisi (sotto il pixel), forme intere e bordo regolabile.
import { describe, expect, it } from 'vitest';
import { analyze, trace, traceDefaults, type DocumentGeometry } from '../src';
import { circlePts, fill, paper, pencil } from './helpers/sketch';

const place = { x: 0, y: 0, scale: 1 };
const shapes = (w: number, h: number, patch: Record<string, unknown> = {}) => ({
  ...traceDefaults(w, h),
  mode: 'shapes' as const,
  ...patch,
});
/** Raggio medio del tracciato rispetto al centro dato (campioni sulle curve). */
const meanRadius = (g: DocumentGeometry, i: number, cx: number, cy: number) => {
  const p = g.paths[i]!;
  let s = 0;
  let n = 0;
  for (const seg of p.segments)
    for (let k = 0; k < 10; k++) {
      const t = k / 10;
      const u = 1 - t;
      const q =
        seg.kind === 'line'
          ? { x: seg.p0.x * u + seg.p1.x * t, y: seg.p0.y * u + seg.p1.y * t }
          : {
              x:
                u ** 3 * seg.p0.x +
                3 * u * u * t * seg.c1.x +
                3 * u * t * t * seg.c2.x +
                t ** 3 * seg.p1.x,
              y:
                u ** 3 * seg.p0.y +
                3 * u * u * t * seg.c1.y +
                3 * u * t * t * seg.c2.y +
                t ** 3 * seg.p1.y,
            };
      s += Math.hypot(q.x - cx, q.y - cy);
      n++;
    }
  return s / n;
};

describe('Crea forme: precisione', () => {
  it('un disco pieno: il contorno sta sul bordo vero entro mezzo pixel', () => {
    const img = paper(400, 400);
    fill(img, circlePts(200, 200, 150, 360));
    const out = trace(img, shapes(400, 400), place);
    expect(out.geometry.paths).toHaveLength(1);
    expect(Math.abs(meanRadius(out.geometry, 0, 200, 200) - 150)).toBeLessThan(0.5);
    const c = analyze(out.geometry, { tolerance: 'loose' }).circles[0]!;
    expect(Math.abs(c.r - 150)).toBeLessThan(0.6);
    // ricalco + analisi di un'immagine intera: sul server di rilascio, carico, supera i 5 s di base
  }, 20000);
});

describe('Crea forme: forme intere e bordo', () => {
  // un cerchio disegnato a matita con un tratto spesso (8 px): un contorno, non un anello
  const ring = () => {
    const img = paper(500, 500);
    pencil(img, circlePts(250, 250, 150), { width: 8, passes: 1, wobble: 0.3, seed: 2 });
    return img;
  };

  it('il tratto che chiude un contorno diventa una forma piena (un solo tracciato, senza buco)', () => {
    const out = trace(ring(), shapes(500, 500), place);
    expect(out.geometry.paths).toHaveLength(1);
  });

  it('bordo al 100%: il contorno parte dal filo esterno del tratto', () => {
    const out = trace(ring(), shapes(500, 500, { edge: 1 }), place);
    const r = meanRadius(out.geometry, 0, 250, 250);
    expect(r).toBeGreaterThan(152);
    expect(r).toBeLessThan(156);
  });

  it('bordo allo 0%: il contorno sta sulla linea centrale del tratto', () => {
    const out = trace(ring(), shapes(500, 500, { edge: 0 }), place);
    expect(Math.abs(meanRadius(out.geometry, 0, 250, 250) - 150)).toBeLessThan(1.5);
  });

  it('il bordo si sposta con continuità tra centro ed esterno', () => {
    const r = [0, 0.5, 1].map((e) =>
      meanRadius(trace(ring(), shapes(500, 500, { edge: e }), place).geometry, 0, 250, 250),
    );
    expect(r[0]!).toBeLessThan(r[1]!);
    expect(r[1]!).toBeLessThan(r[2]!);
  });

  it('con «riempi» spento torna l anello (bordo esterno e bordo interno del tratto)', () => {
    const out = trace(ring(), shapes(500, 500, { fill: false }), place);
    expect(out.geometry.paths).toHaveLength(2);
  });

  it('una O disegnata con due contorni: piena tra i due, buco dentro quello interno', () => {
    const img = paper(500, 500);
    pencil(img, circlePts(250, 250, 160), { width: 8, passes: 1, wobble: 0.3, seed: 2 });
    pencil(img, circlePts(250, 250, 80), { width: 8, passes: 1, wobble: 0.3, seed: 3 });
    const out = trace(img, shapes(500, 500), place);
    expect(out.geometry.paths).toHaveLength(2);
    const r = [0, 1].map((i) => meanRadius(out.geometry, i, 250, 250)).sort((a, b) => a - b);
    // bordo al 100%: fuori il filo esterno del cerchio grande, dentro il filo interno del piccolo
    expect(r[1]!).toBeGreaterThan(162);
    expect(r[0]!).toBeLessThan(78);
    expect(out.geometry.paths[0]!.glyphId).toBe(out.geometry.paths[1]!.glyphId);
  });

  it('due contorni che si sovrappongono (come la coda sopra la gamba): una forma unica, piena', () => {
    const img = paper(500, 400);
    const sq = (x: number, y: number, s: number) => [
      { x, y },
      { x: x + s, y },
      { x: x + s, y: y + s },
      { x, y: y + s },
      { x, y },
    ];
    pencil(img, sq(80, 80, 200), { width: 7, passes: 1, wobble: 0.3, seed: 4 });
    pencil(img, sq(200, 160, 200), { width: 7, passes: 1, wobble: 0.3, seed: 5 });
    const out = trace(img, shapes(500, 400), place);
    // unione: un solo contorno esterno, nessun buco nella sovrapposizione
    expect(out.geometry.paths).toHaveLength(1);
  });

  it('due gambe disegnate a contorno: lo spazio tra le gambe resta vuoto', () => {
    const img = paper(500, 400);
    const leg = (pts: [number, number][]) => [...pts, pts[0]!].map(([x, y]) => ({ x, y }));
    pencil(
      img,
      leg([
        [150, 60],
        [200, 60],
        [140, 340],
        [90, 340],
      ]),
      { width: 6, passes: 1, wobble: 0.3, seed: 6 },
    );
    pencil(
      img,
      leg([
        [250, 60],
        [300, 60],
        [360, 340],
        [310, 340],
      ]),
      { width: 6, passes: 1, wobble: 0.3, seed: 7 },
    );
    // barra che unisce le gambe in alto: tra le gambe si forma una zona chiusa che NON è una forma
    pencil(
      img,
      leg([
        [150, 60],
        [300, 60],
        [300, 40],
        [150, 40],
      ]),
      { width: 6, passes: 1, wobble: 0.3, seed: 8 },
    );
    const out = trace(img, shapes(500, 400), place);
    const g = out.geometry;
    // la zona tra le gambe (al centro, in basso) non è coperta: il punto (225, 250) resta fuori
    const inside = (x: number, y: number) => {
      let c = 0;
      for (const p of g.paths) {
        const pts = p.segments.map((sg) => sg.p0);
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i]!;
          const b = pts[j]!;
          if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c++;
        }
      }
      return c % 2 === 1;
    };
    expect(inside(225, 250)).toBe(false);
    expect(inside(145, 200)).toBe(true); // dentro la gamba sinistra
  });

  it('contorno riempito con un tratteggio (come gli schizzi di logo): una forma piena', () => {
    const img = paper(500, 400);
    const poly = [
      { x: 100, y: 80 },
      { x: 400, y: 80 },
      { x: 400, y: 320 },
      { x: 100, y: 320 },
      { x: 100, y: 80 },
    ];
    pencil(img, poly, { width: 6, passes: 2, wobble: 0.6, seed: 9 });
    // tratteggio verticale leggero, una linea ogni 7 px
    for (let x = 108; x < 395; x += 7)
      pencil(
        img,
        [
          { x, y: 86 },
          { x: x + 3, y: 314 },
        ],
        { width: 2, passes: 1, wobble: 0.8, tone: 120, seed: x },
      );
    const out = trace(img, shapes(500, 400), place);
    expect(out.geometry.paths).toHaveLength(1);
    const xs = out.geometry.paths[0]!.segments.map((sg) => sg.p0.x);
    expect(Math.min(...xs)).toBeLessThan(100);
    expect(Math.max(...xs)).toBeGreaterThan(400);
  });

  it('un anello pieno e spesso (non un tratto) resta un anello', () => {
    const img = paper(400, 400);
    fill(img, circlePts(200, 200, 150, 120));
    for (let y = 0; y < 400; y++)
      for (let x = 0; x < 400; x++)
        if (Math.hypot(x + 0.5 - 200, y + 0.5 - 200) < 80) {
          const i = (y * 400 + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        }
    const out = trace(img, shapes(400, 400), place);
    expect(out.geometry.paths).toHaveLength(2);
  });
});
