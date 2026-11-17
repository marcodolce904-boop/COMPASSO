// Ogni file in fixtures/reports è una segnalazione (dal pannello: ⚙ → Segnala un problema).
// Il campo `expect` dice cosa Compasso DEVE trovare; il test controlla anche che analisi e
// correzione siano deterministiche e non perdano tracciati.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, meetsExpected, parseReport, refine, refineDefaults } from '../src';

const dir = join(__dirname, '..', '..', '..', 'fixtures', 'reports');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe.each(files)('segnalazione %s', (file) => {
  const rep = parseReport(readFileSync(join(dir, file), 'utf8'));
  it('è un file di segnalazione valido', () => {
    expect(rep).not.toBeNull();
  });
  if (!rep) return;
  const g = rep.geometry;
  it('analisi deterministica', () => {
    const a = analyze(g, { tolerance: rep.tolerance });
    const b = analyze(g, { tolerance: rep.tolerance });
    expect({ ...a, durationMs: 0 }).toEqual({ ...b, durationMs: 0 });
  });
  it('trova quello che deve trovare', () => {
    const a = analyze(g, { tolerance: rep.tolerance });
    const e = rep.expect ?? {};
    expect(meetsExpected(a.circles.length, e.circles), `cerchi: ${a.circles.length}`).toBe(true);
    expect(meetsExpected(a.ellipses.length, e.ellipses), `ovali: ${a.ellipses.length}`).toBe(true);
    expect(meetsExpected(a.lines.length, e.lines), `rette: ${a.lines.length}`).toBe(true);
    expect(meetsExpected(a.axes.length, e.axes), `assi: ${a.axes.length}`).toBe(true);
  });
  it('la correzione non perde pezzi ed è idempotente', () => {
    const { options } = refineDefaults(g);
    const r1 = refine(g, options);
    expect(r1.geometry.paths.map((p) => p.id)).toEqual(g.paths.map((p) => p.id));
    const r2 = refine(r1.geometry, options);
    expect(r2.report.changedPaths).toBe(0);
  });
});
