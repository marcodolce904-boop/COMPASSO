<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type {
    AnalysisResult,
    ConstructionPlan,
    DocumentGeometry,
    TolerancePreset,
  } from '@compasso/core';
  import { Panel, t, type Lang, type PanelStatus } from '@compasso/ui';
  import { csi, evalTS, subscribeBackgroundColor } from '../lib/utils/bolt';
  import { version } from '../../shared/shared';
  import { createAnalyzer } from './analyzer';
  import { applyHostTheme } from './theme';
  import { loadHost } from './host';
  import { toFixPaths } from './fixpaths';

  const POLL_MS = 800; // §8.4: polling leggero dell'impronta della selezione
  const LOADING_DELAY_MS = 300; // §4.6: indicatore solo per analisi lente
  const MANY_ANCHORS = 3000;
  const HOST_RETRY_MS = 3000;

  let lang = $state<Lang>('en');
  let tolerance = $state<TolerancePreset>('normal');
  let geometry = $state<DocumentGeometry | null>(null);
  let result = $state<AnalysisResult | null>(null);
  let status = $state<PanelStatus>('empty');
  let error = $state<string | null>(null);
  let drawn = $state(false);
  let fixApplied = $state(false); // c'è una copia corretta (layer «Compasso — Corretto»)

  let fingerprint = '';
  let hostError = false; // l'avviso mostrato riguarda la comunicazione con Illustrator
  let reading = false;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const analyzer = createAnalyzer((r) => {
    clearTimeout(loadingTimer);
    if (r.ok) {
      result = r.result;
      status = 'ready';
    } else {
      result = null;
      status = 'error';
      error = t(lang, 'error.generic', { msg: r.error });
      console.error('[compasso] analisi non riuscita', r.error);
    }
  });

  function analyse(g: DocumentGeometry) {
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => (status = 'loading'), LOADING_DELAY_MS);
    analyzer.run($state.snapshot(g) as DocumentGeometry, tolerance);
  }

  function clear() {
    analyzer.cancel();
    clearTimeout(loadingTimer);
    geometry = null;
    result = null;
    status = 'empty';
  }

  /** Legge l'impronta; se è cambiata (o `force`), estrae la selezione e la analizza. */
  async function refresh(force = false) {
    if (reading || document.hidden) return;
    reading = true;
    try {
      const raw = await evalTS('getSelectionFingerprint');
      if (hostError) {
        // Illustrator ha risposto: un avviso precedente non è più attuale
        hostError = false;
        error = null;
      }
      const [fp = '', layer, fix] = String(raw ?? '').split('#');
      drawn = layer === '1';
      fixApplied = fix === '1';
      if (!force && fp === fingerprint) return;
      fingerprint = fp;
      const res = await evalTS('extractSelection');
      if (!res.ok) return clear();
      if (
        res.anchors > MANY_ANCHORS &&
        !confirm(t(lang, 'confirm.manyAnchors', { n: res.anchors }))
      ) {
        return clear();
      }
      geometry = res.geometry;
      error = null;
      analyse(res.geometry);
    } catch (e) {
      // errore dell'host: messaggio comprensibile nel pannello, dettagli in console (§4.6)
      console.error('[compasso] errore di Illustrator', e);
      hostError = true;
      error = t(lang, 'error.host', { msg: String(e) });
    } finally {
      reading = false;
    }
  }

  async function drawConstruction(plan: ConstructionPlan) {
    try {
      const r = await evalTS('drawPlan', plan);
      if (r.ok) drawn = true;
      console.info(`[compasso] disegnati ${r.count} oggetti in ${r.ms} ms`);
    } catch (e) {
      console.error('[compasso] disegno non riuscito', e);
      error = t(lang, 'error.host', { msg: String(e) });
    }
  }

  async function applyFix(g: DocumentGeometry) {
    try {
      const r = await evalTS('applyFix', toFixPaths(g));
      if (r.ok) fixApplied = true;
      console.info(`[compasso] correzioni applicate a ${r.paths} tracciati in ${r.ms} ms`);
      void refresh(true); // la copia corretta è selezionata: si rianalizza subito
    } catch (e) {
      console.error('[compasso] correzioni non applicate', e);
      hostError = true;
      error = t(lang, 'error.host', { msg: String(e) });
    }
  }

  async function revertFix() {
    try {
      await evalTS('revertFix');
      fixApplied = false;
      void refresh(true);
    } catch (e) {
      console.error('[compasso] ripristino non riuscito', e);
      hostError = true;
      error = t(lang, 'error.host', { msg: String(e) });
    }
  }

  async function removeConstruction() {
    try {
      await evalTS('removeConstruction');
      drawn = false;
    } catch (e) {
      console.error('[compasso] rimozione non riuscita', e);
      error = t(lang, 'error.host', { msg: String(e) });
    }
  }

  /** Avvio: lo script di Illustrator deve rispondere prima di leggere la selezione. */
  async function start() {
    const h = await loadHost();
    if (!h.ok) {
      // diagnosi precisa nel pannello; si riprova finché Illustrator non risponde
      hostError = true;
      error = t(lang, 'error.hostLoad', { msg: h.detail });
      retryTimer = setTimeout(() => void start(), HOST_RETRY_MS);
      return;
    }
    if (hostError) {
      hostError = false;
      error = null;
    }
    void refresh(true);
    pollTimer = setInterval(() => void refresh(), POLL_MS);
  }

  // cambiare tolleranza rianalizza la stessa geometria, senza rileggere il documento
  $effect(() => {
    const tol = tolerance;
    void tol;
    if (geometry) analyse(geometry);
  });

  onMount(() => {
    if (window.cep) {
      // lingua iniziale: italiano se Illustrator è in italiano, altrimenti inglese (D9)
      try {
        const env = JSON.parse(window.__adobe_cep__.getHostEnvironment() as string);
        if (
          String(env.appLocale ?? '')
            .toLowerCase()
            .startsWith('it')
        )
          lang = 'it';
      } catch (e) {
        console.error('[compasso] lingua dell’host non leggibile', e);
      }
      subscribeBackgroundColor(applyHostTheme);
      for (const ev of ['documentAfterActivate', 'documentAfterDeactivate']) {
        csi.addEventListener(ev, () => refresh(true));
      }
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void refresh(true);
    });
    void start();
  });
  onDestroy(() => {
    clearInterval(pollTimer);
    clearTimeout(retryTimer);
  });
</script>

<div class="host">
  <Panel
    {geometry}
    {result}
    {status}
    {error}
    {version}
    {drawn}
    bind:lang
    bind:tolerance
    onDraw={drawConstruction}
    onRemove={removeConstruction}
    {fixApplied}
    onApplyFix={applyFix}
    onRevertFix={revertFix}
    onDismissError={() => (error = null)}
  />
</div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    background: var(--c-bg-panel);
  }
  :global(#app) {
    height: 100%;
  }
  .host {
    height: 100%;
  }
</style>
