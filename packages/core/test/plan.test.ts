import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, parseSvg, plan, LAYER_NAME, type DrawStyle } from '../src';

const root = join(__dirname, '..', '..', '..');
const result = (file: string) =>
  analyze(parseSvg(readFileSync(join(root, 'fixtures', 'svg', file), 'utf8')));
const style: DrawStyle = {
  strokeWidth: 0.75,
  markerSize: 8,
  color: 'auto',
  axisDash: [4, 3],
  lineExtent: 'bbox-margin',
};

describe('plan', () => {
  const r = result('05-rettangolo-arrotondato.svg');

  it('nome del layer e stile', () => {
    const p = plan(r, { level: 'structure', style });
    expect(p.layerName).toBe(LAYER_NAME);
    expect(p.style).toBe(style);
  });

  it('il livello Tutto contiene ogni cerchio, retta e asse', () => {
    const p = plan(r, { level: 'full', style });
    const ids = new Set(p.primitives.map((x) => x.id));
    for (const e of [...r.circles, ...r.lines, ...r.axes]) expect(ids.has(e.id)).toBe(true);
  });

  it('le rette sono ritagliate sul bbox + 25%', () => {
    const p = plan(r, { level: 'full', style });
    const b = r.specs.bbox;
    const m = 0.125 * Math.max(b.width, b.height);
    for (const x of p.primitives) {
      if (x.type !== 'line') continue;
      for (const q of [x.a, x.b]) {
        expect(q.x).toBeGreaterThanOrEqual(b.x - m - 1e-6);
        expect(q.x).toBeLessThanOrEqual(b.x + b.width + m + 1e-6);
        expect(q.y).toBeGreaterThanOrEqual(b.y - m - 1e-6);
        expect(q.y).toBeLessThanOrEqual(b.y + b.height + m + 1e-6);
      }
    }
  });

  it("lineExtent 'artboard' estende le rette fino al bordo della tavola", () => {
    const p = plan(r, { level: 'full', style: { ...style, lineExtent: 'artboard' } });
    const ab = r.artboard!;
    const l1 = p.primitives.find((x) => x.id === 'l1');
    if (l1?.type !== 'line') throw new Error('attesa retta');
    expect(Math.min(l1.a.x, l1.b.x)).toBeCloseTo(ab.x);
    expect(Math.max(l1.a.x, l1.b.x)).toBeCloseTo(ab.x + ab.width);
  });

  it("senza tavola 'artboard' ricade su bbox + 25%", () => {
    const { artboard: _a, ...noBoard } = r;
    void _a;
    const p = plan(noBoard, { level: 'full', style: { ...style, lineExtent: 'artboard' } });
    const q = plan(r, { level: 'full', style });
    expect(p.primitives).toEqual(q.primitives);
  });

  it('assi nel gruppo axes, marker di centro e di tangenza nel Dettaglio', () => {
    const p = plan(r, { level: 'detail', style });
    expect(p.primitives.filter((x) => x.type === 'line' && x.group === 'axes')).toHaveLength(2);
    expect(p.primitives.some((x) => x.type === 'marker' && x.shape === 'cross')).toBe(true);
    expect(p.primitives.some((x) => x.type === 'marker' && x.shape === 'square')).toBe(true);
  });

  it('exclude ha la precedenza sul livello; include aggiunge', () => {
    const p = plan(r, { level: 'full', style, exclude: ['c1'] });
    expect(p.primitives.some((x) => x.id === 'c1' || x.id === 'm:c1')).toBe(false);
    const q = plan(r, { level: 'essential', style, include: ['l8'] });
    expect(q.primitives.some((x) => x.id === 'l8')).toBe(true);
  });

  it('unità x e area di rispetto', () => {
    const o = result('06-lettera-o.svg');
    const p = plan(o, { level: 'structure', style, clearspace: { enabled: true, multiplier: 1 } });
    const unit = p.primitives.find((x) => x.id === 'unit-x');
    expect(unit).toMatchObject({ type: 'unit', label: 'x' });
    const rect = p.primitives.find((x) => x.type === 'rect');
    const x = o.specs.unitX!;
    expect(rect).toMatchObject({ dashed: true, w: expect.closeTo(o.specs.bbox.width + 2 * x, 6) });
    expect(p.primitives.filter((q) => q.id.startsWith('clearspace-x'))).toHaveLength(4);
  });

  it('senza unità x niente quadrato né area di rispetto', () => {
    const p = plan(r, { level: 'full', style, clearspace: { enabled: true, multiplier: 1 } });
    expect(p.primitives.some((x) => x.group === 'specs')).toBe(false);
  });
});
