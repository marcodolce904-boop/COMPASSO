// Soglie di qualità del ricalco sul banco di prova (vedi `pnpm bench:trace` per i numeri).
// Se una modifica peggiora il ricalco, questo test se ne accorge.
import { describe, expect, it } from 'vitest';
import { trace, traceDefaults } from '../src';
import { FIGURES, LEVEL_WIDTH, score, sketch, type Level } from './helpers/tracebench';

describe.each(['normale', 'difficile'] as Level[])('qualità del ricalco, livello %s', (level) => {
  it.each(FIGURES.map((f) => [f.name, f] as const))('%s', (_name, fig) => {
    const out = trace(sketch(fig, level, 1), traceDefaults(fig.w, fig.h), { x: 0, y: 0, scale: 1 });
    const s = score(out.geometry, fig, LEVEL_WIDTH[level]);
    expect(s.paths, 'tracciati').toBe(s.expectedPaths);
    expect(s.missing, 'pezzi mancanti').toBeLessThan(0.01);
    expect(s.meanDev, 'scarto medio (px)').toBeLessThan(3);
    expect(s.maxDev, 'scarto massimo (px)').toBeLessThan(10);
    expect(s.anchors, 'anchor').toBeLessThanOrEqual(Math.ceil(fig.ideal * 1.5));
    if (fig.corners.length) expect(s.cornerErr, 'spigoli (px)').toBeLessThan(5);
    expect(s.oriented, 'verso').toBe(1);
  });
});

describe('qualità del ricalco a metà risoluzione (foto piccole)', () => {
  it.each(['fulmine', 'A (contorno)', 'quadrato', 'cerchio'])('%s', async (name) => {
    const { downscale } = await import('../src');
    const fig = FIGURES.find((f) => f.name === name)!;
    const { image } = downscale(sketch(fig, 'normale', 1), Math.ceil(Math.max(fig.w, fig.h) / 2));
    // si ricalca a metà e si riporta in scala 1:1 per confrontare con la forma vera
    const out = trace(image, traceDefaults(image.width, image.height), { x: 0, y: 0, scale: 2 });
    const s = score(out.geometry, fig, LEVEL_WIDTH.normale);
    expect(s.paths).toBe(s.expectedPaths);
    expect(s.anchors).toBe(fig.ideal);
    if (fig.corners.length) expect(s.cornerErr).toBeLessThan(6);
    expect(s.maxDev).toBeLessThan(12);
  });
});
