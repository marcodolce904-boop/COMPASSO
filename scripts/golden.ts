import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, parseSvg, type AnalysisResult } from '../packages/core/src';

export const ROOT = join(import.meta.dirname, '..');
export const SVG_DIR = join(ROOT, 'fixtures', 'svg');
export const EXPECTED_DIR = join(ROOT, 'fixtures', 'expected');

/** Risultato serializzabile per i golden test: senza durationMs, numeri a 4 decimali. */
export function toGolden(r: AnalysisResult): unknown {
  const { durationMs: _ignored, ...rest } = r;
  void _ignored;
  return JSON.parse(
    JSON.stringify(rest, (_k, v) =>
      typeof v === 'number' ? (Math.round(v * 1e4) / 1e4 === 0 ? 0 : Math.round(v * 1e4) / 1e4) : v,
    ),
  );
}

export const svgFixtures = () =>
  readdirSync(SVG_DIR)
    .filter((f) => f.endsWith('.svg'))
    .sort();

export const goldenOf = (file: string) =>
  toGolden(analyze(parseSvg(readFileSync(join(SVG_DIR, file), 'utf8'))));

export const expectedPath = (file: string) => join(EXPECTED_DIR, file.replace(/\.svg$/, '.json'));

/** Confronto con tolleranza numerica; restituisce i percorsi diversi. */
export function diff(a: unknown, b: unknown, path = '$', out: string[] = [], eps = 1e-3): string[] {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > eps * Math.max(1, Math.abs(a), Math.abs(b)))
      out.push(`${path}: ${b} → ${a}`);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: lunghezza ${b.length} → ${a.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++)
      diff(a[i], b[i], `${path}[${i}]`, out, eps);
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys)
      diff(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
        out,
        eps,
      );
  } else if (a !== b) {
    out.push(`${path}: ${JSON.stringify(b)} → ${JSON.stringify(a)}`);
  }
  return out;
}
