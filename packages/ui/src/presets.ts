// Preset delle regolazioni (docs/MIGLIORIE.md §4): salvati nella memoria locale del pannello,
// esportabili e importabili in JSON. Le misure in pt si salvano con la diagonale del logo (D), così
// si riadattano quando il preset si applica a un logo di misura diversa.
import type { GenerateOptions, RefineOptions, TraceOptions } from '@compasso/core';

export type PresetKind = 'trace' | 'fix' | 'generate';

export interface Preset<T = unknown> {
  name: string;
  /** Regolazioni (anche parziali per i preset di esempio). */
  options: T;
  /** Diagonale del logo al salvataggio (pt); assente = misure non da riadattare. */
  D?: number;
  /** Preset di esempio: non si elimina. */
  builtin?: boolean;
}

export interface PresetFile {
  format: 'compasso-presets';
  v: 1;
  kind: PresetKind;
  presets: Preset[];
}

const KEY = 'compasso.presets.v1';

/** Preset di esempio di RICALCA (patch sulle regolazioni proporzionate all'immagine). */
export const TRACE_BUILTINS: Preset<Partial<TraceOptions>>[] = [
  { name: 'preset.trace.pencil', options: { mode: 'lines' }, builtin: true },
  { name: 'preset.trace.ink', options: { mode: 'shapes', fill: true, edge: 1 }, builtin: true },
  {
    name: 'preset.trace.small',
    options: { mode: 'perfect', perfect: { tolerance: 0.001, symmetry: 'auto', softness: 0.3 } },
    builtin: true,
  },
];

function readAll(): Partial<Record<PresetKind, Preset[]>> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<PresetKind, Preset[]>>) : {};
  } catch {
    return {};
  }
}
function writeAll(all: Partial<Record<PresetKind, Preset[]>>) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(all));
  } catch {
    // memoria piena o non disponibile: i preset restano solo per questa sessione
  }
}

export function loadPresets(kind: PresetKind): Preset[] {
  return readAll()[kind] ?? [];
}

/** Salva (o sostituisce, se c'è già un preset con lo stesso nome). */
export function savePreset(kind: PresetKind, p: Preset): Preset[] {
  const all = readAll();
  const list = (all[kind] ?? []).filter((q) => q.name !== p.name);
  list.push(p);
  list.sort((a, b) => a.name.localeCompare(b.name));
  all[kind] = list;
  writeAll(all);
  return list;
}

export function deletePreset(kind: PresetKind, name: string): Preset[] {
  const all = readAll();
  all[kind] = (all[kind] ?? []).filter((q) => q.name !== name);
  writeAll(all);
  return all[kind]!;
}

export function exportPresets(kind: PresetKind): string {
  const file: PresetFile = { format: 'compasso-presets', v: 1, kind, presets: loadPresets(kind) };
  return JSON.stringify(file, null, 2);
}

/** Importa un file di preset; restituisce quanti ne ha aggiunti, o null se il file non è valido. */
export function importPresets(kind: PresetKind, text: string): number | null {
  try {
    const f = JSON.parse(text) as Partial<PresetFile>;
    if (f.format !== 'compasso-presets' || f.kind !== kind || !Array.isArray(f.presets))
      return null;
    let n = 0;
    for (const p of f.presets)
      if (p && typeof p.name === 'string' && p.options && typeof p.options === 'object') {
        savePreset(kind, { name: p.name, options: p.options, ...(p.D ? { D: p.D } : {}) });
        n++;
      }
    return n;
  } catch {
    return null;
  }
}

/** CORREGGI: tolleranze in pt riadattate alla diagonale del logo corrente. */
export function scaleFix(o: RefineOptions, from: number | undefined, to: number): RefineOptions {
  const c = structuredClone(o);
  if (!from || !to || Math.abs(to / from - 1) < 1e-6) return c;
  const k = to / from;
  c.arcs.tolerance *= k;
  c.ellipses.tolerance *= k;
  c.radii.tolerance *= k;
  c.centers.tolerance *= k;
  c.align.tolerance *= k;
  c.symmetry.tolerance *= k;
  c.grid.step *= k;
  c.exclude = [];
  return c;
}

/** GENERA: scarto massimo e modulo in pt riadattati alla diagonale del logo corrente. */
export function scaleGenerate(
  o: GenerateOptions,
  from: number | undefined,
  to: number,
): GenerateOptions {
  const c = structuredClone(o);
  if (!from || !to || Math.abs(to / from - 1) < 1e-6) return c;
  const k = to / from;
  if (c.maxDeviation !== null) c.maxDeviation *= k;
  if (c.math.module !== null) c.math.module *= k;
  return c;
}
