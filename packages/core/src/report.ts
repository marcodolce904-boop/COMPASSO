// Segnalazione di un problema: un file JSON con la selezione (geometria), le impostazioni e il
// riepilogo del risultato. L'utente lo salva e lo manda; diventa un test fisso (fixtures/reports).
// Nessun invio automatico: il file resta sul computer finché l'utente non decide di condividerlo.

import type { AnalysisResult, DocumentGeometry, TolerancePreset } from './model';
import type { RefineOptions, RefineReport } from './fix/refine';
import type { TraceOptions, TracePlacement } from './trace/trace';
import type { RasterImage } from './trace/raster';

/** Valore atteso: numero esatto o intervallo [min, max]. */
export type Expected = number | [number, number];

export interface ReportExpect {
  circles?: Expected;
  ellipses?: Expected;
  lines?: Expected;
  axes?: Expected;
  /** RICALCA: tracciati e anchor attesi dal ricalco dello schizzo. */
  tracePaths?: Expected;
  traceAnchors?: Expected;
}

/** Lo schizzo da ricalcare, in scala di grigi (1 byte per pixel, base64), con le regolazioni. */
export interface ReportTrace {
  width: number;
  height: number;
  gray: string;
  place: TracePlacement;
  options: TraceOptions;
  perfect: boolean;
  /** Risultato al momento della segnalazione. */
  result: { paths: number; anchors: number } | null;
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
  trace?: ReportTrace;
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
  trace?: ReportTrace | null;
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
    ...(input.trace ? { trace: input.trace } : {}),
  };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Byte → base64 (senza dipendere da btoa/Buffer: il core gira ovunque). */
export function bytesToBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += i + 1 < b.length ? B64[(n >> 6) & 63]! : '=';
    out += i + 2 < b.length ? B64[n & 63]! : '=';
  }
  return out;
}
export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, ''); // senza "=" finali: la lunghezza dice i byte
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const v = (k: number) => (i + k < clean.length ? B64.indexOf(clean[i + k]!) : 0);
    const n = (v(0) << 18) | (v(1) << 12) | (v(2) << 6) | v(3);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** Immagine → scala di grigi in base64 (per la segnalazione). */
export function grayOf(img: RasterImage): string {
  const n = img.width * img.height;
  const g = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d = img.data;
    g[i] = Math.round(0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!);
  }
  return bytesToBase64(g);
}

/** Scala di grigi (base64) → immagine RGBA, per rifare il ricalco. */
export function rasterOfGray(width: number, height: number, gray: string): RasterImage {
  const g = base64ToBytes(gray);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = g[i] ?? 255;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
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
  const tr = r.trace;
  if (tr && !(isNum(tr.width) && isNum(tr.height) && typeof tr.gray === 'string' && tr.options))
    return null;
  return r as CompassoReport;
}

/** Il valore rispetta l'atteso? */
export function meetsExpected(value: number, want: Expected | undefined): boolean {
  if (want === undefined) return true;
  if (typeof want === 'number') return value === want;
  return value >= want[0] && value <= want[1];
}
