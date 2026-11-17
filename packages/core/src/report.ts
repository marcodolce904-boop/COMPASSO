// Segnalazione di un problema: un file JSON con la selezione (geometria), le impostazioni e il
// riepilogo del risultato. L'utente lo salva e lo manda; diventa un test fisso (fixtures/reports).
// Nessun invio automatico: il file resta sul computer finché l'utente non decide di condividerlo.

import type { AnalysisResult, DocumentGeometry, TolerancePreset } from './model';
import type { RefineOptions, RefineReport } from './fix/refine';

/** Valore atteso: numero esatto o intervallo [min, max]. */
export type Expected = number | [number, number];

export interface ReportExpect {
  circles?: Expected;
  ellipses?: Expected;
  lines?: Expected;
  axes?: Expected;
}

export interface CompassoReport {
  format: 'compasso-report';
  v: 1;
  /** Versione di Compasso che ha prodotto il file. */
  version: string;
  /** Data ISO, solo informativa. */
  createdAt: string;
  host: 'illustrator' | 'harness';
  tolerance: TolerancePreset;
  geometry: DocumentGeometry;
  summary: {
    paths: number;
    anchors: number;
    circles: number;
    ellipses: number;
    lines: number;
    axes: number;
    findings: number;
  } | null;
  fix?: { options: RefineOptions; report: RefineReport };
  /** Cosa DOVREBBE trovare Compasso: lo compila chi trasforma il file in test. */
  expect?: ReportExpect;
  /** Nota libera (cosa non va). */
  note?: string;
}

export function buildReport(input: {
  version: string;
  createdAt: string;
  host: CompassoReport['host'];
  tolerance: TolerancePreset;
  geometry: DocumentGeometry;
  result: AnalysisResult | null;
  fix?: { options: RefineOptions; report: RefineReport } | null;
}): CompassoReport {
  const r = input.result;
  return {
    format: 'compasso-report',
    v: 1,
    version: input.version,
    createdAt: input.createdAt,
    host: input.host,
    tolerance: input.tolerance,
    geometry: input.geometry,
    summary: r
      ? {
          paths: r.stats.paths,
          anchors: r.stats.anchors,
          circles: r.stats.circles,
          ellipses: r.stats.ellipses,
          lines: r.stats.lines,
          axes: r.stats.axes,
          findings: r.findings.length,
        }
      : null,
    ...(input.fix ? { fix: input.fix } : {}),
  };
}

/** Nome del file: compasso-segnalazione-AAAAMMGG-HHMM.json */
export function reportFileName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `compasso-segnalazione-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (v: unknown) =>
  typeof v === 'object' &&
  v !== null &&
  isNum((v as { x: unknown }).x) &&
  isNum((v as { y: unknown }).y);

/** Legge e controlla un file di segnalazione; null se non è valido. */
export function parseReport(text: string): CompassoReport | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const r = data as Partial<CompassoReport>;
  if (!r || r.format !== 'compasso-report' || r.v !== 1) return null;
  const g = r.geometry;
  if (!g || !Array.isArray(g.paths)) return null;
  for (const p of g.paths) {
    if (typeof p.id !== 'string' || !Array.isArray(p.segments)) return null;
    for (const s of p.segments) {
      if (s.kind === 'line') {
        if (!isPt(s.p0) || !isPt(s.p1)) return null;
      } else if (s.kind === 'cubic') {
        if (!isPt(s.p0) || !isPt(s.c1) || !isPt(s.c2) || !isPt(s.p1)) return null;
      } else return null;
    }
  }
  if (!Array.isArray(g.warnings)) (g as DocumentGeometry).warnings = [];
  return r as CompassoReport;
}

/** Il valore rispetta l'atteso? */
export function meetsExpected(value: number, want: Expected | undefined): boolean {
  if (want === undefined) return true;
  if (typeof want === 'number') return value === want;
  return value >= want[0] && value <= want[1];
}
