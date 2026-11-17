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
