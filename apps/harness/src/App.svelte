<script lang="ts">
  import type {
    AnalysisResult,
    ConstructionPlan,
    DocumentGeometry,
    TolerancePreset,
  } from '@compasso/core';
  import {
    ConstructionSvg,
    Panel,
    emptyHighlight,
    t,
    viewBoxFor,
    type Box,
    type Lang,
    type PanelStatus,
  } from '@compasso/ui';
  import type { AnalysisRequest, AnalysisResponse } from './analysis';

  // fixture del repository, incluse come testo
  const fixtures = import.meta.glob('../../../fixtures/svg/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  const fixtureNames = Object.keys(fixtures)
    .map((p) => p.split('/').pop()!)
    .sort();
  const fixtureByName = (n: string) =>
    fixtures[Object.keys(fixtures).find((p) => p.endsWith('/' + n))!]!;

  const LOADING_DELAY_MS = 300; // indicatore solo per analisi lente (§4.6)

  let lang = $state<Lang>('it');
  let tolerance = $state<TolerancePreset>('normal');
  let svgText = $state<string | null>(null);
  let fixedGeometry = $state<DocumentGeometry | null>(null); // CORREGGI: logo corretto applicato
  let fixture = $state('');
  let geometry = $state<DocumentGeometry | null>(null);
  let result = $state<AnalysisResult | null>(null);
  let status = $state<PanelStatus>('empty');
  let error = $state<string | null>(null);
  let drawnPlan = $state<ConstructionPlan | null>(null);
  let dragging = $state(false);
  let fileInput: HTMLInputElement;

  const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  let requestId = 0;
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;

  worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
    const msg = e.data;
    if (msg.id !== requestId) return; // risposta superata da una richiesta più recente
    clearTimeout(loadingTimer);
    if (msg.ok) {
      geometry = msg.geometry;
      result = msg.result;
      status = 'ready';
      error = null;
    } else {
      geometry = null;
      result = null;
      status = 'error';
      error = t(lang, 'error.generic', { msg: msg.error });
    }
  };

  function analyse(source: { svg: string } | { geometry: DocumentGeometry }, tol: TolerancePreset) {
    const id = ++requestId;
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      if (id === requestId) status = 'loading';
    }, LOADING_DELAY_MS);
    worker.postMessage({ id, ...source, tolerance: tol } satisfies AnalysisRequest);
  }

  // nuova sorgente o nuova tolleranza → nuova analisi; il layer disegnato resta finché non si ridisegna
  $effect(() => {
    if (svgText === null) return;
    if (fixedGeometry)
      analyse({ geometry: $state.snapshot(fixedGeometry) as DocumentGeometry }, tolerance);
    else analyse({ svg: svgText }, tolerance);
  });

  function load(text: string) {
    drawnPlan = null;
    fixedGeometry = null;
    svgText = text;
  }
  function pickFixture() {
    if (fixture) load(fixtureByName(fixture));
  }
  async function openFile(file: File | undefined) {
    if (!file) return;
    fixture = '';
    load(await file.text());
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    void openFile(e.dataTransfer?.files[0]);
  }

  const board = $derived.by(() => {
    if (!geometry || !result) return null;
    if (geometry.artboard) return geometry.artboard;
    const b = result.specs.bbox;
    const m = 0.25 * Math.max(b.width, b.height);
    return { x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m };
  });
  // vista = tavola ∪ logo ∪ layer disegnato: come in Illustrator, gli oggetti possono uscire dalla tavola
  const view = $derived.by((): Box | null => {
    if (!board || !result) return null;
    const v = viewBoxFor(result, drawnPlan);
    const x0 = Math.min(board.x, v.x);
    const y0 = Math.min(board.y, v.y);
    const x1 = Math.max(board.x + board.width, v.x + v.width);
    const y1 = Math.max(board.y + board.height, v.y + v.height);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  });
  const noHighlight = emptyHighlight();

  // larghezza del pannello, regolabile trascinando la maniglia
  const PANEL_MIN = 280;
  const PANEL_MAX = 1100;
  let panelWidth = $state(320);
  function startResize(e: PointerEvent) {
    const startX = e.clientX;
    const startW = panelWidth;
    const move = (ev: PointerEvent) => {
      panelWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startW + (startX - ev.clientX)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
</script>

<svelte:window
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={(e) => {
    if (e.relatedTarget === null) dragging = false;
  }}
  ondrop={onDrop}
/>

<div class="app">
  <main class="stage">
    <div class="toolbar">
      <span class="title">{t(lang, 'harness.title')}</span>
      <button class="btn" onclick={() => fileInput.click()}>{t(lang, 'harness.open')}</button>
      <input
        bind:this={fileInput}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        onchange={(e) => openFile(e.currentTarget.files?.[0])}
      />
      <label class="fx">
        {t(lang, 'harness.fixture')}
        <select bind:value={fixture} onchange={pickFixture}>
          <option value="">{t(lang, 'harness.fixtureNone')}</option>
          {#each fixtureNames as n (n)}<option value={n}>{n}</option>{/each}
        </select>
      </label>
    </div>

    <div class="canvas">
      {#if geometry && board && view}
        <div class="artboard" style="aspect-ratio:{view.width} / {view.height}">
          <ConstructionSvg
            {geometry}
            plan={drawnPlan}
            highlight={noHighlight}
            viewBox={view}
            artboard={board}
            mode="artboard"
            label={t(lang, 'harness.artboard')}
          />
        </div>
        <p class="layer">
          {drawnPlan
            ? t(lang, 'harness.layer', {
                name: drawnPlan.layerName,
                n: drawnPlan.primitives.length,
              })
            : t(lang, 'harness.noLayer', { draw: t(lang, 'btn.draw') })}
        </p>
      {:else}
        <p class="hint">{t(lang, 'harness.drop')}</p>
      {/if}
    </div>
    {#if dragging}<div class="drop">{t(lang, 'harness.dropActive')}</div>{/if}
  </main>

  <!-- maniglia: trascina per allargare il pannello (come in Illustrator) -->
  <button
    class="splitter"
    aria-label={t(lang, 'harness.resize')}
    onpointerdown={startResize}
    onkeydown={(e) => {
      if (e.key === 'ArrowLeft') panelWidth = Math.min(PANEL_MAX, panelWidth + 20);
      if (e.key === 'ArrowRight') panelWidth = Math.max(PANEL_MIN, panelWidth - 20);
    }}
  ></button>
  <aside class="side" style="width:{panelWidth}px">
    <Panel
      {geometry}
      {result}
      {status}
      {error}
      drawn={drawnPlan !== null}
      bind:lang
      bind:tolerance
      onDraw={(p) => (drawnPlan = p)}
      onRemove={() => (drawnPlan = null)}
      onDismissError={() => (error = null)}
      fixApplied={fixedGeometry !== null}
      onApplyFix={(g) => {
        drawnPlan = null;
        fixedGeometry = g;
      }}
      onRevertFix={() => {
        drawnPlan = null;
        fixedGeometry = null;
      }}
    />
  </aside>
</div>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: var(--c-app-bg);
    color: var(--c-text);
    font-family: var(--f-sans);
  }
  :global(#app) {
    height: 100%;
  }
  .app {
    height: 100%;
    display: flex;
  }
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    background: var(--c-bg-card);
    font: 400 var(--fs-s) var(--f-sans);
  }
  .title {
    font: 700 var(--fs-s) var(--f-mono);
    letter-spacing: var(--ls-caps);
    margin-right: auto;
  }
  .btn,
  select {
    height: var(--h-seg);
    padding: 0 var(--sp-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-s);
    background: var(--c-bg-raised);
    color: var(--c-text);
    font: inherit;
    cursor: pointer;
  }
  .fx {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    color: var(--c-text-2);
  }
  .canvas {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-3);
    padding: var(--sp-5);
  }
  .artboard {
    max-width: 100%;
    max-height: calc(100% - var(--sp-5));
    height: 100%;
  }
  .layer,
  .hint {
    font: 400 var(--fs-s) var(--f-mono);
    color: var(--c-text-2);
  }
  .drop {
    position: absolute;
    inset: var(--sp-3);
    display: flex;
    align-items: center;
    justify-content: center;
    border: var(--sz-focus) dashed var(--c-accent);
    border-radius: var(--r-m);
    background: var(--c-accent-dim);
    font: 500 var(--fs-l) var(--f-sans);
    pointer-events: none;
  }
  .splitter {
    padding: 0;
    border: 0;
    width: var(--sp-1);
    flex: none;
    cursor: col-resize;
    background: var(--c-border);
  }
  .splitter:hover,
  .splitter:focus-visible {
    background: var(--c-accent);
    outline: none;
  }
  .side {
    flex: none;
    height: 100%;
    border-left: 1px solid var(--c-border);
  }
</style>
