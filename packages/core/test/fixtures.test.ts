import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arcTolerance, detectArcs, normalizeGeometry, parseSvg } from '../src';
import { FIXTURES } from '../../../scripts/fixtures-def';

const root = join(__dirname, '..', '..', '..');

describe.each(FIXTURES)('fixture $file', (fx) => {
  const svg = readFileSync(join(root, 'fixtures', 'svg', fx.file), 'utf8');
  const geom = normalizeGeometry(parseSvg(svg).paths);
  const { arcs } = detectArcs(geom, arcTolerance(geom.D));

  it('il file su disco coincide con il generatore', () => {
    expect(svg).toBe(fx.svg);
  });

  it('archi veri e centro/raggio/ampiezza corretti', () => {
    const strict = arcs.filter((a) => a.quality === 'arc');
    expect(strict).toHaveLength(fx.truth.arcs.length);
    for (const want of fx.truth.arcs) {
      const got = strict.find(
        (a) =>
          Math.hypot(a.cx - want.cx, a.cy - want.cy) < 0.01 * want.r &&
          Math.abs(a.r - want.r) < 0.005 * want.r,
      );
      expect(got, `arco r=${want.r} @(${want.cx},${want.cy})`).toBeDefined();
      expect((got?.sweep ?? 0) * (180 / Math.PI)).toBeCloseTo(want.sweepDeg, 0);
    }
  });

  it('quasi-archi (finding) e rette', () => {
    expect(arcs.filter((a) => a.quality === 'near-arc')).toHaveLength(fx.truth.nearArcs);
    const lines = geom.paths.flatMap((p) => p.segments).filter((s) => s.kind === 'line');
    expect(lines).toHaveLength(fx.truth.lines);
  });

  it('è deterministico', () => {
    const again = detectArcs(normalizeGeometry(parseSvg(svg).paths), arcTolerance(geom.D));
    expect(again).toEqual({ arcs, nearlyStraight: [] });
  });
});
