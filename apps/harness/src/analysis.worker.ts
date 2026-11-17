// L'analisi gira in un Web Worker: l'interfaccia resta reattiva anche su loghi grandi (§4.6).
import { analyze, parseSvg } from '@compasso/core';
import type { AnalysisRequest, AnalysisResponse } from './analysis';

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  const { id, svg, geometry: given, tolerance } = e.data;
  let msg: AnalysisResponse;
  try {
    const geometry = given ?? parseSvg(svg ?? '');
    const result = analyze(geometry, { tolerance });
    msg = { id, ok: true, geometry, result };
  } catch (err) {
    console.error('[compasso] analisi non riuscita', err);
    msg = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(msg);
};
