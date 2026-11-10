import {
  analyze,
  type AnalysisResult,
  type DocumentGeometry,
  type TolerancePreset,
} from '@compasso/core';
// Worker incluso nel bundle (blob URL): i worker caricati da file:// sono fragili in CEP.
import AnalysisWorker from './analysis.worker?worker&inline';

export interface AnalysisRequest {
  id: number;
  geometry: DocumentGeometry;
  tolerance: TolerancePreset;
}
export type AnalysisResponse =
  { id: number; ok: true; result: AnalysisResult } | { id: number; ok: false; error: string };

/**
 * Analizzatore con richieste numerate: vale solo l'ultima risposta. Se il worker non si
 * avvia, l'analisi gira nel thread del pannello (più lenta, stesso risultato).
 */
export function createAnalyzer(onResponse: (r: AnalysisResponse) => void) {
  let worker: Worker | null = null;
  let last = 0;
  try {
    worker = new AnalysisWorker();
    worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
      if (e.data.id === last) onResponse(e.data);
    };
    worker.onerror = (e) => {
      console.error('[compasso] worker non disponibile, analisi nel pannello', e);
      worker = null;
    };
  } catch (e) {
    console.error('[compasso] worker non disponibile, analisi nel pannello', e);
    worker = null;
  }
  return {
    run(geometry: DocumentGeometry, tolerance: TolerancePreset): void {
      const id = ++last;
      if (worker) {
        worker.postMessage({ id, geometry, tolerance } satisfies AnalysisRequest);
        return;
      }
      setTimeout(() => {
        try {
          const result = analyze(geometry, { tolerance });
          if (id === last) onResponse({ id, ok: true, result });
        } catch (err) {
          if (id === last)
            onResponse({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      }, 0);
    },
    cancel(): void {
      last++;
    },
  };
}
