import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, parseSvg, plan } from '@compasso/core';
import { elementGroups, findingDelta, findingMessage, refLabel } from '../src/labels';
import { highlightFor, logoShapes, pathD, ratioText, specsText, viewBoxFor } from '../src/preview';

const fx = (name: string) => {
  const geom = parseSvg(
    readFileSync(join(__dirname, '..', '..', '..', 'fixtures', 'svg', name), 'utf8'),
  );
  return { geom, result: analyze(geom) };
};

describe('labels', () => {
  it('nomi degli elementi raggruppati', () => {
    const { result } = fx('05-rettangolo-arrotondato.svg');
    const g = elementGroups(result, 'it');
    expect(g.circles[0]?.name).toBe('Cerchio 1 · r 30,0 pt');
    expect(g.lines.some((l) => l.name.endsWith('orizzontale'))).toBe(true);
    expect(g.axes.map((a) => a.name)).toEqual(['Asse 1 · verticale', 'Asse 2 · orizzontale']);
    expect(g.rows.length).toBeGreaterThan(0);
    expect(g.rows[0]?.name).toMatch(/^Allineamento 1 · [xy] /);
    const total = g.circles.length + g.lines.length + g.axes.length + g.rows.length;
    expect(total).toBe(result.circles.length + result.lines.length + result.axes.length);
  });

  it('riferimenti brevi', () => {
    expect(refLabel('en', 'c3')).toBe('Circle 3');
    expect(refLabel('it', 'ax1')).toBe('Asse 1');
    expect(refLabel('it', 'l12')).toBe('Retta 12');
  });

  it('messaggi dei findings in entrambe le lingue', () => {
    const { result } = fx('11-anchor-fuori-riga-0.3pt.svg');
    const f = result.findings[0]!;
    expect(findingMessage('it', f)).toBe('Anchor fuori riga: y 150,3 invece di 150,0');
    expect(findingMessage('en', f)).toBe('Anchor off the row: y 150.3 instead of 150.0');
    expect(findingDelta(f)).toBe('0.30 pt');
    const sym = fx('10-marchio-quasi-simmetrico.svg').result.findings.find(
      (x) => x.kind === 'near-symmetry',
    )!;
    expect(findingMessage('it', sym)).toContain('asse verticale x = 100,0');
    const ang = fx('10-marchio-quasi-simmetrico.svg').result.findings.find(
      (x) => x.kind === 'near-angle',
    )!;
    expect(findingDelta(ang)).toMatch(/°$/);
  });
});

describe('preview', () => {
  it('pathD e forme del logo unite per glifo', () => {
    const { geom } = fx('06-lettera-o.svg');
    expect(pathD(geom.paths[0]!)).toMatch(/^M.*C.*Z$/);
    expect(logoShapes(geom)).toHaveLength(1); // anello = un solo glifo con il buco
  });

  it('viewBox contiene bbox e piano', () => {
    const { result } = fx('05-rettangolo-arrotondato.svg');
    const style = {
      strokeWidth: 0.75,
      markerSize: 8,
      color: 'auto' as const,
      axisDash: [4, 3] as [number, number],
      lineExtent: 'bbox-margin' as const,
    };
    const p = plan(result, { level: 'full', style });
    const vb = viewBoxFor(result, p);
    const b = result.specs.bbox;
    expect(vb.x).toBeLessThan(b.x);
    expect(vb.x + vb.width).toBeGreaterThan(b.x + b.width);
  });

  it('evidenziazione: hover e finding con segmenti, anchor e asse', () => {
    const near = fx('04-quasi-cerchio-1.5pct.svg');
    const h1 = highlightFor(near.geom, 'c1', near.result.findings[0]!);
    expect(h1.ids.has('c1')).toBe(true);
    expect(h1.segments).toHaveLength(1);
    const sym = fx('10-marchio-quasi-simmetrico.svg');
    const f = sym.result.findings.find((x) => x.kind === 'near-symmetry')!;
    const h2 = highlightFor(sym.geom, null, f);
    expect(h2.anchors.length).toBeGreaterThan(0);
    expect(h2.axes).toEqual([{ theta: 0, rho: 100 }]);
  });

  it('testo di «Copia misure»', () => {
    const { result } = fx('06-lettera-o.svg');
    const txt = specsText('it', result, 1);
    expect(txt).toContain('Unità x: 24,00 pt (ALTA)');
    expect(txt).toContain('Raggi: 80,01 pt · 56,01 pt');
    expect(txt).toContain('AREA DI RISPETTO: 1,0 x = 24,00 pt');
    expect(specsText('en', fx('05-rettangolo-arrotondato.svg').result, 1)).toContain(
      'Unit x cannot be determined reliably',
    );
  });

  it('proporzione del bbox', () => {
    expect(ratioText('it', { width: 100, height: 112 })).toBe('1 : 1,12');
    expect(ratioText('en', { width: 200, height: 100 })).toBe('2.00 : 1');
  });
});
