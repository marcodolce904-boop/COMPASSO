// Analisi in un Web Worker (§4.6): il pannello resta reattivo anche su selezioni grandi.
import { analyze } from '@compasso/core';
import type { AnalysisRequest, AnalysisResponse } from './analyzer';

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  const { id, geometry, tolerance } = e.data;
  let msg: AnalysisResponse;
  try {
    msg = { id, ok: true, result: analyze(geometry, { tolerance }) };
  } catch (err) {
    msg = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(msg);
};
