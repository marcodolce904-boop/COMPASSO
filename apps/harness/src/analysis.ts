import type { AnalysisResult, DocumentGeometry, TolerancePreset } from '@compasso/core';

export interface AnalysisRequest {
  id: number;
  svg: string;
  tolerance: TolerancePreset;
}
export type AnalysisResponse =
  | { id: number; ok: true; geometry: DocumentGeometry; result: AnalysisResult }
  | { id: number; ok: false; error: string };
