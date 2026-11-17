import type { AnalysisResult, DocumentGeometry, TolerancePreset } from '@compasso/core';

export interface AnalysisRequest {
  id: number;
  /** SVG da leggere, oppure (dopo una correzione) la geometria già pronta. */
  svg?: string;
  geometry?: DocumentGeometry;
  tolerance: TolerancePreset;
}
export type AnalysisResponse =
  | { id: number; ok: true; geometry: DocumentGeometry; result: AnalysisResult }
  | { id: number; ok: false; error: string };
