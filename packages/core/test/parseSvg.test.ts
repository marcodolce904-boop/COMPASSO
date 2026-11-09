import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src';

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

describe('parseSvg', () => {
  it('legge path, circle, rect, ellipse, polygon', () => {
    const g = parseSvg(
      svg(`<path d="M0 0L10 0L10 10Z"/><circle cx="5" cy="5" r="5"/>
           <rect width="10" height="20" rx="2"/><ellipse cx="0" cy="0" rx="4" ry="2"/>
           <polygon points="0,0 10,0 10,10"/>`),
    );
    expect(g.source).toBe('svg');
    expect(g.paths.map((p) => p.id)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    expect(g.paths[1]?.segments).toHaveLength(4);
    expect(g.paths[2]?.segments).toHaveLength(8); // 4 rette + 4 archi
    expect(g.paths[4]?.closed).toBe(true);
  });

  it('applica transform di elemento e di gruppo', () => {
    const g = parseSvg(
      svg(`<g transform="translate(10 20)"><path transform="scale(2)" d="M1 1L2 1"/></g>`),
    );
    expect(g.paths[0]?.segments[0]).toMatchObject({ p0: { x: 12, y: 22 }, p1: { x: 14, y: 22 } });
  });

  it('rotate attorno a un punto', () => {
    const g = parseSvg(svg(`<path transform="rotate(90 10 10)" d="M20 10L30 10"/>`));
    const s = g.paths[0]?.segments[0];
    expect(s?.p0.x).toBeCloseTo(10);
    expect(s?.p0.y).toBeCloseTo(20);
  });

  it('un path con più sotto-tracciati condivide il glyphId', () => {
    const g = parseSvg(svg(`<path d="M0 0L10 0L10 10Z M2 2L4 2L4 4Z"/>`));
    expect(g.paths.map((p) => p.id)).toEqual(['e0.0', 'e0.1']);
    expect(g.paths.every((p) => p.glyphId === 'e0')).toBe(true);
  });

  it('ignora defs/clipPath e legge fill/stroke', () => {
    const g = parseSvg(
      svg(`<defs><clipPath id="c"><rect width="5" height="5"/></clipPath></defs>
           <path d="M0 0L5 5" fill="none" stroke="#000" stroke-width="2"/>`),
    );
    expect(g.paths).toHaveLength(1);
    expect(g.paths[0]).toMatchObject({ filled: false, stroked: true, strokeWidth: 2 });
  });

  it('tavola dal viewBox, altrimenti da width/height', () => {
    expect(parseSvg('<svg viewBox="10 20 300 200"></svg>').artboard).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });
    expect(parseSvg('<svg width="120pt" height="80"></svg>').artboard).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 80,
    });
    expect(parseSvg('<svg></svg>').artboard).toBeUndefined();
  });

  it('è deterministico', () => {
    const s = svg(`<circle cx="1" cy="2" r="3"/>`);
    expect(parseSvg(s)).toEqual(parseSvg(s));
  });
});
