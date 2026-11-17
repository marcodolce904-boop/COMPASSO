<script lang="ts">
  import {
    plan as makePlan,
    refine,
    refineDefaults,
    type AnalysisResult,
    type RefineOptions,
    type RefineReport,
    type RefineResult,
    type CompassoReport,
    buildReport,
    type ConstructionPlan,
    type DocumentGeometry,
    type DrawStyle,
    type Level,
    type TolerancePreset,
    UNIT_ID,
  } from '@compasso/core';
  import { untrack } from 'svelte';
  import { elementGroups, findingDelta, findingMessage, fixSummary } from './labels';
  import { highlightFor, viewBoxFor } from './preview';
  import { num, statsText, t, type Lang } from './strings';
  import Header from './components/Header.svelte';
  import TabBar from './components/TabBar.svelte';
  import PreviewCard from './components/PreviewCard.svelte';
  import Segmented from './components/Segmented.svelte';
  import Slider from './components/Slider.svelte';
  import ElementList from './components/ElementList.svelte';
  import FindingList from './components/FindingList.svelte';
  import SpecsView from './components/SpecsView.svelte';
  import PrimaryButton from './components/PrimaryButton.svelte';
  import TextButton from './components/TextButton.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Toast from './components/Toast.svelte';
  import FixPreview, { type FixMode } from './components/FixPreview.svelte';
  import FixControls from './components/FixControls.svelte';
  import TracePanel, { type TraceReady, type TraceSource } from './components/TracePanel.svelte';

  export type PanelStatus = 'empty' | 'loading' | 'ready' | 'error';

  interface Props {
    geometry?: DocumentGeometry | null;
    result?: AnalysisResult | null;
    status?: PanelStatus;
    error?: string | null;
    drawn?: boolean;
    version?: string;
    lang?: Lang;
    tolerance?: TolerancePreset;
    onDraw: (plan: ConstructionPlan) => void;
    onRemove: () => void;
    onDismissError?: () => void;
    /** CORREGGI: è presente una copia corretta (l'originale è nascosto). */
    fixApplied?: boolean;
    /** CORREGGI: applica la geometria corretta (l'host la scrive su una copia). */
    onApplyFix?: (geometry: DocumentGeometry) => void;
    /** CORREGGI: elimina la copia corretta e rimette l'originale. */
    onRevertFix?: () => void;
    /** Segnala un problema: salva il file e restituisce dove (o lancia un errore). */
    onReport?: (report: CompassoReport) => Promise<string> | string;
    /** Host che produce la segnalazione. */
    host?: CompassoReport['host'];
    /** RICALCA: l'immagine da ricalcare (null = da scegliere). */
    traceSource?: TraceSource | null;
    /** RICALCA: scelta dell'immagine (selezione o file); assente = scheda nascosta. */
    onPickImage?: () => void;
    pickImageLabel?: string;
    traceMessage?: string;
    /** RICALCA: crea i tracciati ricalcati nel documento. */
    onCreateTrace?: (r: TraceReady) => void;
  }
  let {
    geometry = null,
    result = null,
    status = 'empty',
    error = null,
    drawn = false,
    version = '0.1.0',
    lang = $bindable('en'),
    tolerance = $bindable('normal'),
    onDraw,
    onRemove,
    onDismissError = () => {},
    fixApplied = false,
    onApplyFix = () => {},
    onRevertFix = () => {},
    onReport,
    host = 'harness',
    traceSource = null,
    onPickImage,
    pickImageLabel = '',
    traceMessage = '',
    onCreateTrace = () => {},
  }: Props = $props();
  let traceOut = $state<TraceReady | null>(null);

  // Segnala un problema
  let reportMsg = $state('');
  async function sendReport() {
    if (!geometry || !onReport) return;
    const rep = buildReport({
      version,
      createdAt: new Date().toISOString(),
      host,
      tolerance,
      geometry: $state.snapshot(geometry) as DocumentGeometry,
      result: result ? ($state.snapshot(result) as AnalysisResult) : null,
      fix:
        fixResult && fixOptions
          ? {
              options: $state.snapshot(fixOptions) as RefineOptions,
              report: $state.snapshot(fixResult.report) as RefineReport,
            }
          : null,
    });
    try {
      const where = await onReport(rep);
      reportMsg = t(lang, 'report.saved', { path: where });
    } catch (e) {
      reportMsg = t(lang, 'report.failed', { msg: String(e) });
    }
  }

  // stato del pannello (valori predefiniti del §4.2)
  const DEFAULTS = { stroke: 0.75, marker: 8 };
  let mainTab = $state<'trace' | 'inspect' | 'fix' | 'present'>('inspect');
  let sub = $state<'findings' | 'geometry' | 'specs'>('geometry');
  let level = $state<Level>('structure');
  let strokeWidth = $state(DEFAULTS.stroke);
  let markerSize = $state(DEFAULTS.marker);
  let excluded = $state<string[]>([]);
  let included = $state<string[]>([]);
  let hoverId = $state<string | null>(null);
  let selectedFinding = $state<string | null>(null);
  let listOpen = $state(false);
  let settingsOpen = $state(false);
  let clearspace = $state({ enabled: false, multiplier: 1 });
  // campione dell'unità x (quadrato grigio in alto a sinistra): spento finché non lo si chiede
  let showUnit = $state(false);
  const planExclude = $derived(showUnit ? excluded : [...excluded, UNIT_ID]);

  // --- impaginazione flessibile: il pannello misura se stesso ---------------------------------
  let panelW = $state(320);
  let panelH = $state(720);
  const WIDE = 620; // da questa larghezza: anteprima a sinistra, controlli a destra
  const wide = $derived(panelW >= WIDE);
  // altezza dell'anteprima: cresce con il pannello (stretto: ~38% dell'altezza; largo: quasi tutta)
  const thumbH = $derived(
    Math.round(wide ? Math.max(220, panelH - 250) : Math.min(560, Math.max(176, panelH * 0.38))),
  );

  // --- CORREGGI ---------------------------------------------------------------------------------
  let fixOptions = $state<RefineOptions | null>(null);
  let fixDefaults = $state<RefineOptions | null>(null);
  let fixD = $state(100);
  let fixMode = $state<FixMode>('compare');
  let fixResult = $state<RefineResult | null>(null);

  // nuova selezione: valori predefiniti proporzionati al logo; le scelte dell'utente restano,
  // le tolleranze in pt si riscalano sulla nuova dimensione
  $effect(() => {
    const g = geometry;
    untrack(() => {
      if (!g) return;
      const d = refineDefaults(g);
      fixDefaults = d.options;
      if (!fixOptions) {
        fixOptions = structuredClone(d.options);
      } else if (Math.abs(d.D / fixD - 1) > 0.01) {
        const k = d.D / fixD;
        fixOptions.arcs.tolerance *= k;
        fixOptions.ellipses.tolerance *= k;
        fixOptions.radii.tolerance *= k;
        fixOptions.centers.tolerance *= k;
        fixOptions.align.tolerance *= k;
        fixOptions.symmetry.tolerance *= k;
      }
      fixD = d.D;
      fixOptions.exclude = []; // gli id dei tracciati valgono solo per questa selezione
    });
  });

  // correzione calcolata dal vivo (con un piccolo ritardo mentre si trascina una barra)
  $effect(() => {
    const g = geometry;
    const o = fixOptions ? ($state.snapshot(fixOptions) as RefineOptions) : null;
    if (mainTab !== 'fix' || !g || !o) return;
    const id = setTimeout(() => {
      try {
        fixResult = refine(g, o);
      } catch (e) {
        console.error('[compasso] correzione non riuscita', e);
        fixResult = null;
      }
    }, 40);
    return () => clearTimeout(id);
  });
  const fixText = $derived(fixResult ? fixSummary(lang, fixResult.report) : '');
  const fixWarning = $derived(
    fixResult && fixResult.report.maxShift > 0.01 * fixD
      ? t(lang, 'fix.bigShift', { d: num(lang, fixResult.report.maxShift, 1) })
      : '',
  );
  function toggleExclude(key: string | null) {
    if (!fixOptions) return;
    const cur = fixOptions.exclude ?? [];
    if (key === null) fixOptions.exclude = [];
    else fixOptions.exclude = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
  }
  const canApply = $derived(
    status === 'ready' && fixResult !== null && fixResult.report.changedPaths > 0,
  );
  function applyFix() {
    if (fixResult) onApplyFix(fixResult.geometry);
  }
  function resetFix() {
    if (fixDefaults) fixOptions = structuredClone($state.snapshot(fixDefaults) as RefineOptions);
  }

  // un nuovo risultato azzera le scelte manuali
  $effect(() => {
    void result;
    untrack(() => {
      excluded = [];
      included = [];
      selectedFinding = null;
      hoverId = null;
    });
  });

  const style = $derived<DrawStyle>({
    strokeWidth,
    markerSize,
    color: 'auto',
    axisDash: [4, 3],
    lineExtent: 'bbox-margin',
  });
  const currentPlan = $derived(
    result
      ? makePlan(result, { level, style, include: included, exclude: planExclude, clearspace })
      : null,
  );
  const visible = $derived(new Set(currentPlan?.primitives.map((p) => p.id) ?? []));
  // viewBox stabile: calcolato sul piano più ampio, così l'anteprima non "salta" tra i livelli
  const viewBox = $derived(
    result
      ? viewBoxFor(
          result,
          makePlan(result, { level: 'full', style, clearspace: { enabled: true, multiplier: 3 } }),
        )
      : null,
  );
  const finding = $derived(result?.findings.find((f) => f.id === selectedFinding) ?? null);
  const highlight = $derived(highlightFor(geometry, hoverId, finding));
  const groups = $derived(result ? elementGroups(result, lang) : null);
  const elementCount = $derived(
    groups
      ? groups.circles.length + groups.lines.length + groups.axes.length + groups.rows.length
      : 0,
  );
  const stats = $derived(result ? statsText(lang, result.stats) : t(lang, 'preview.none'));
  const ready = $derived(status === 'ready' && result !== null);

  function toggle(id: string) {
    if (visible.has(id)) {
      included = included.filter((x) => x !== id);
      if (!excluded.includes(id)) excluded = [...excluded, id];
    } else {
      excluded = excluded.filter((x) => x !== id);
      if (!included.includes(id)) included = [...included, id];
    }
  }
  function draw() {
    if (currentPlan) onDraw(currentPlan);
  }
</script>

<div class="panel" bind:clientWidth={panelW} bind:clientHeight={panelH}>
  <Header
    name={t(lang, 'app.name')}
    {version}
    settingsLabel={t(lang, 'settings.title')}
    {settingsOpen}
    onSettings={() => (settingsOpen = !settingsOpen)}
  />
  {#if settingsOpen}
    <div class="settings">
      <p class="label">{t(lang, 'settings.language')}</p>
      <Segmented
        ariaLabel={t(lang, 'settings.language')}
        bind:value={lang}
        options={[
          { value: 'en', label: 'English' },
          { value: 'it', label: 'Italiano' },
        ]}
      />
      <p class="label">{t(lang, 'settings.tolerance')}</p>
      <Segmented
        ariaLabel={t(lang, 'settings.tolerance')}
        bind:value={tolerance}
        options={[
          { value: 'strict', label: t(lang, 'tolerance.strict') },
          { value: 'normal', label: t(lang, 'tolerance.normal') },
          { value: 'loose', label: t(lang, 'tolerance.loose') },
        ]}
      />
      {#if onReport}
        <div class="report">
          <TextButton label={t(lang, 'report.button')} onclick={sendReport} disabled={!geometry} />
          <p class="hint">{reportMsg || t(lang, 'report.hint')}</p>
        </div>
      {/if}
    </div>
  {/if}
  <TabBar
    bind:value={mainTab}
    tabs={[
      ...(onPickImage ? [{ value: 'trace', label: t(lang, 'tab.trace') }] : []),
      { value: 'inspect', label: t(lang, 'tab.inspect') },
      { value: 'fix', label: t(lang, 'tab.fix') },
      { value: 'present', label: t(lang, 'tab.present') },
    ]}
  />

  <div class="body" class:wide style="--h-thumb:{thumbH}px">
    {#if mainTab === 'present'}
      <EmptyState title={t(lang, 'tab.soon')} hint={t(lang, 'tab.soonHint')} />
    {:else if mainTab === 'trace' && onPickImage}
      <TracePanel
        {wide}
        {lang}
        source={traceSource}
        pickLabel={pickImageLabel}
        onPick={onPickImage}
        message={traceMessage}
        bind:output={traceOut}
      />
    {:else}
      <div class="col main">
        {#if mainTab === 'fix' && geometry}
          <FixPreview
            title={t(lang, 'fix.preview')}
            original={geometry}
            fixed={fixResult?.geometry ?? null}
            bind:mode={fixMode}
            modeLabels={{
              after: t(lang, 'fix.mode.after'),
              compare: t(lang, 'fix.mode.compare'),
              before: t(lang, 'fix.mode.before'),
            }}
            modeAria={t(lang, 'fix.mode.aria')}
            legend={t(lang, 'fix.legend')}
            summary={fixText || t(lang, 'preview.analyzing')}
            busy={status === 'loading'}
            zoomLabels={{
              in: t(lang, 'fix.zoom.in'),
              out: t(lang, 'fix.zoom.out'),
              fit: t(lang, 'fix.zoom.fit'),
              area: t(lang, 'fix.zoom.area'),
              hint: t(lang, 'fix.zoom.hint'),
            }}
            excluded={fixOptions?.exclude ?? []}
            onToggleExclude={toggleExclude}
            excludeLabels={{
              count: t(lang, 'fix.exclude.count', { n: fixOptions?.exclude?.length ?? 0 }),
              clear: t(lang, 'fix.exclude.clear'),
            }}
            warning={fixWarning}
          />
        {:else}
          <PreviewCard
            title={t(lang, 'preview.title')}
            {stats}
            {geometry}
            plan={currentPlan}
            {viewBox}
            {highlight}
            busy={status === 'loading'}
            label={stats}
          />
        {/if}
        {#each geometry?.warnings ?? [] as w (w)}
          <p class="warning">{t(lang, `warning.${w}`)}</p>
        {/each}
        {#if error}
          <Toast
            message={error}
            dismissLabel={t(lang, 'error.dismiss')}
            onDismiss={onDismissError}
          />
        {/if}
        {#if !result}
          <EmptyState
            title={status === 'loading' ? t(lang, 'preview.analyzing') : t(lang, 'empty.selection')}
            hint={status === 'loading' ? '' : t(lang, 'empty.hint')}
          />
        {/if}
      </div>

      {#if result}
        <div class="col side">
          {#if mainTab === 'fix'}
            {#if fixOptions && fixDefaults}
              <FixControls
                bind:options={fixOptions}
                defaults={fixDefaults}
                D={fixD}
                report={fixResult?.report ?? null}
                {lang}
                onReset={resetFix}
              />
            {/if}
          {:else}
            <Segmented
              ariaLabel={t(lang, 'sub.aria')}
              bind:value={sub}
              options={[
                {
                  value: 'findings',
                  label: t(lang, 'sub.findings'),
                  badge: result.findings.length,
                },
                { value: 'geometry', label: t(lang, 'sub.geometry') },
                { value: 'specs', label: t(lang, 'sub.specs') },
              ]}
            />
            {#if sub === 'geometry'}
              <Segmented
                ariaLabel={t(lang, 'level.aria')}
                bind:value={level}
                dense
                options={(['essential', 'structure', 'detail', 'full'] as const).map((l) => ({
                  value: l,
                  label: t(lang, `level.${l}`),
                }))}
              />
              <div class="sect">
                <b>{t(lang, 'display.title')}</b><span>{t(lang, 'display.reset')}</span>
              </div>
              <Slider
                label={t(lang, 'display.stroke')}
                bind:value={strokeWidth}
                min={0.25}
                max={3}
                step={0.05}
                defaultValue={DEFAULTS.stroke}
                unit="pt"
              />
              <Slider
                label={t(lang, 'display.marker')}
                bind:value={markerSize}
                min={2}
                max={20}
                step={0.1}
                defaultValue={DEFAULTS.marker}
                unit="pt"
                digits={1}
              />
              {#if groups}
                <ElementList
                  title={t(lang, 'elements.title', { n: elementCount })}
                  {groups}
                  groupLabels={{
                    circles: t(lang, 'group.circles'),
                    lines: t(lang, 'group.lines'),
                    axes: t(lang, 'group.axes'),
                    rows: t(lang, 'group.rows'),
                  }}
                  {visible}
                  bind:open={listOpen}
                  bind:hoverId
                  showLabel={(name) => t(lang, 'el.show', { name })}
                  hideLabel={(name) => t(lang, 'el.hide', { name })}
                  onToggle={toggle}
                />
              {/if}
            {:else if sub === 'findings'}
              <FindingList
                findings={result.findings}
                bind:selected={selectedFinding}
                message={(f) => findingMessage(lang, f)}
                delta={findingDelta}
                severityLabel={(s) => t(lang, `severity.${s}`)}
                emptyText={t(lang, 'findings.none')}
                hint={t(lang, 'findings.hint')}
              />
            {:else}
              <SpecsView {result} {lang} bind:clearspace bind:showUnit />
            {/if}
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <footer class="ftr">
    {#if mainTab === 'trace'}
      <div class="actions">
        <PrimaryButton
          label={t(lang, 'trace.create')}
          disabled={!traceOut || !traceSource}
          onclick={() => traceOut && onCreateTrace(traceOut)}
        />
      </div>
    {:else if mainTab === 'fix'}
      <p class="stats">{t(lang, 'fix.onCopy')}</p>
      <div class="actions">
        <PrimaryButton label={t(lang, 'fix.apply')} disabled={!canApply} onclick={applyFix} />
        {#if fixApplied}
          <TextButton label={t(lang, 'fix.revert')} tone="muted" onclick={onRevertFix} />
        {/if}
      </div>
    {:else}
      <p class="stats">{stats}</p>
      <div class="actions">
        {#if drawn}
          <PrimaryButton label={t(lang, 'btn.redraw')} disabled={!ready} onclick={draw} />
          <TextButton label={t(lang, 'btn.remove')} tone="muted" onclick={onRemove} />
        {:else}
          <PrimaryButton
            label={status === 'loading' ? t(lang, 'btn.loading') : t(lang, 'btn.draw')}
            disabled={!ready}
            loading={status === 'loading'}
            onclick={draw}
          />
        {/if}
      </div>
    {/if}
  </footer>
</div>

<style>
  .panel {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: var(--w-panel-min);
    display: flex;
    flex-direction: column;
    background: var(--c-bg-panel);
    color: var(--c-text);
    font: 400 var(--fs-m) var(--f-sans);
    -webkit-font-smoothing: antialiased;
  }
  :where(.panel) :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :where(.panel) :global(button) {
    background: none;
    border: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .panel :global(:focus-visible) {
    outline: var(--sz-focus) solid var(--c-accent);
    outline-offset: var(--bw);
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border-bottom: var(--bw) solid var(--c-border);
    background: var(--c-bg-card);
  }
  .report {
    padding-top: var(--sp-1);
    border-top: var(--bw) solid var(--c-border);
  }
  .report .hint {
    font: 400 var(--fs-xs) / var(--lh-text) var(--f-sans);
    color: var(--c-text-3);
    overflow-wrap: anywhere;
  }
  .label {
    font: 700 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-2);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-3);
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }
  /* pannello largo: anteprima a sinistra (ferma), controlli a destra (scorrono) */
  .body.wide {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(var(--w-panel-min), 1fr);
    align-items: start;
    overflow: hidden;
  }
  .body.wide .col {
    max-height: 100%;
    overflow-y: auto;
  }
  .sect {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .sect b {
    font: 700 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-2);
  }
  .sect span {
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
  }
  .warning {
    font: 400 var(--fs-xs) / var(--lh-text) var(--f-sans);
    color: var(--c-warn);
  }
  .ftr {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: calc(var(--sp-2) + var(--sp-half)) var(--sp-3) var(--sp-3);
    border-top: var(--bw) solid var(--c-border);
  }
  .stats {
    font: 400 var(--fs-s) var(--f-mono);
    color: var(--c-text-2);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
</style>
