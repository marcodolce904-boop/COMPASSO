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

const WORKER_TIMEOUT_MS = 8000;

/**
 * Analizzatore con richieste numerate: vale solo l'ultima risposta. Se il worker non parte,
 * va in errore o non risponde, la richiesta in corso viene rifatta nel thread del pannello
 * (stesso risultato): il pannello non resta mai bloccato su "Analisi…".
 */
export function createAnalyzer(onResponse: (r: AnalysisResponse) => void) {
  let worker: Worker | null = null;
  let last = 0;
  let pending: AnalysisRequest | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const inPanel = (req: AnalysisRequest) => {
    setTimeout(() => {
      if (req.id !== last) return;
      try {
        onResponse({
          id: req.id,
          ok: true,
          result: analyze(req.geometry, { tolerance: req.tolerance }),
        });
      } catch (err) {
        onResponse({
          id: req.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, 0);
  };
  const giveUpOnWorker = (why: unknown) => {
    console.error('[compasso] worker non disponibile, analisi nel pannello', why);
    clearTimeout(timer);
    try {
      worker?.terminate();
    } catch {
      // gia' terminato
    }
    worker = null;
    const req = pending;
    pending = null;
    if (req) inPanel(req);
  };

  try {
    worker = new AnalysisWorker();
    worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
      if (e.data.id !== last) return;
      clearTimeout(timer);
      pending = null;
      onResponse(e.data);
    };
    worker.onerror = (e) => giveUpOnWorker(e.message);
  } catch (e) {
    console.error('[compasso] worker non disponibile, analisi nel pannello', e);
    worker = null;
  }

  return {
    run(geometry: DocumentGeometry, tolerance: TolerancePreset): void {
      const req: AnalysisRequest = { id: ++last, geometry, tolerance };
      clearTimeout(timer);
      if (!worker) return inPanel(req);
      pending = req;
      timer = setTimeout(() => giveUpOnWorker('nessuna risposta'), WORKER_TIMEOUT_MS);
      try {
        worker.postMessage(req);
      } catch (e) {
        giveUpOnWorker(e);
      }
    },
    cancel(): void {
      last++;
      pending = null;
      clearTimeout(timer);
    },
  };
}
