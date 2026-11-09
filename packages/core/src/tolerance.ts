import type { TolerancePreset } from './model';

/** Doppia soglia (§6.9): sotto `strict` la relazione è vera, fino a `wide` è un finding. */
export interface Band {
  strict: number;
  wide: number;
}

export interface Tolerances {
  arc: Band; // pt
  center: Band; // pt
  radius: Band; // pt
  row: Band; // pt
  angle: Band; // radianti
  tangent: Band; // pt
  symmetry: Band; // pt
}

const MULTIPLIER: Record<TolerancePreset, number> = { strict: 0.5, normal: 1, loose: 2 };
const DEG = Math.PI / 180;

/** Tolleranze del §6.9 [DA CALIBRARE], in frazione di D, scalate dal preset. */
export function tolerances(D: number, preset: TolerancePreset = 'normal'): Tolerances {
  const m = MULTIPLIER[preset];
  const b = (s: number, w: number): Band => ({ strict: s * D * m, wide: w * D * m });
  return {
    arc: b(0.0015, 0.008),
    center: b(0.002, 0.01),
    radius: b(0.002, 0.015),
    // soglia assoluta minima dichiarata: 0,02 pt
    row: { strict: Math.max(0.02, 0.00005 * D) * m, wide: 0.005 * D * m },
    angle: { strict: 0.3 * DEG * m, wide: 2 * DEG * m },
    tangent: b(0.002, 0.01),
    symmetry: b(0.003, 0.015),
  };
}

/** Posizione di `delta` nella fascia: 0 = sulla soglia stretta, 1 = sulla larga. */
export const bandPosition = (delta: number, band: Band): number =>
  Math.min(1, Math.max(0, (delta - band.strict) / (band.wide - band.strict)));

export const inBand = (delta: number, band: Band): boolean =>
  delta > band.strict && delta <= band.wide;
