import { describe, expect, it } from 'vitest';
import { analyze, buildReport, meetsExpected, parseReport, parseSvg, reportFileName } from '../src';

describe('segnalazione', () => {
  const g = parseSvg('<svg><circle cx="50" cy="50" r="40"/></svg>');
  const r = analyze(g);
  const rep = buildReport({
    version: '9.9.9',
    createdAt: '2026-11-17T10:00:00Z',
    host: 'harness',
    tolerance: 'normal',
    geometry: g,
    result: r,
  });
  it('andata e ritorno in JSON', () => {
    const back = parseReport(JSON.stringify(rep))!;
    expect(back.geometry).toEqual(g);
    expect(back.summary?.circles).toBe(1);
    expect(analyze(back.geometry).circles).toHaveLength(1);
  });
  it('rifiuta file non validi', () => {
    expect(parseReport('non json')).toBeNull();
    expect(parseReport('{"format":"altro"}')).toBeNull();
    expect(
      parseReport(
        JSON.stringify({ ...rep, geometry: { paths: [{ id: 'p', segments: [{ kind: 'x' }] }] } }),
      ),
    ).toBeNull();
  });
  it('nome del file e valori attesi', () => {
    expect(reportFileName(new Date(2026, 10, 7, 9, 5))).toBe(
      'compasso-segnalazione-20261107-0905.json',
    );
    expect(meetsExpected(3, 3)).toBe(true);
    expect(meetsExpected(3, [2, 4])).toBe(true);
    expect(meetsExpected(5, [2, 4])).toBe(false);
    expect(meetsExpected(5, undefined)).toBe(true);
  });
});

describe('segnalazione con schizzo', () => {
  it('base64 andata e ritorno per ogni lunghezza', async () => {
    const { bytesToBase64, base64ToBytes } = await import('../src');
    for (let n = 0; n < 12; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 255);
      const s = bytesToBase64(b);
      expect(s).toBe(Buffer.from(b).toString('base64'));
      expect(Array.from(base64ToBytes(s))).toEqual(Array.from(b));
    }
  });
  it('lo schizzo in grigio si ricalca uguale', async () => {
    const { grayOf, rasterOfGray, trace, traceDefaults } = await import('../src');
    const { paper, pencil, circlePts } = await import('./helpers/sketch');
    const img = paper(300, 300);
    pencil(img, circlePts(150, 150, 100), { seed: 2 });
    const back = rasterOfGray(300, 300, grayOf(img));
    const o = traceDefaults(300, 300);
    const place = { x: 0, y: 0, scale: 1 };
    expect(trace(back, o, place).geometry).toEqual(trace(img, o, place).geometry);
  });
});
