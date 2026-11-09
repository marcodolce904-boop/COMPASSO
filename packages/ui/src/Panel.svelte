<script lang="ts">
  import {
    plan as makePlan,
    type AnalysisResult,
    type ConstructionPlan,
    type DocumentGeometry,
    type DrawStyle,
    type Level,
    type TolerancePreset,
  } from '@compasso/core';
  import { untrack } from 'svelte';
  import { elementGroups, findingDelta, findingMessage } from './labels';
  import { highlightFor, viewBoxFor } from './preview';
  import { statsText, t, type Lang } from './strings';
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
  }: Props = $props();

  // stato del pannello (valori predefiniti del §4.2)
  const DEFAULTS = { stroke: 0.75, marker: 8 };
  let mainTab = $state('inspect');
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
      ? makePlan(result, { level, style, include: included, exclude: excluded, clearspace })
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

<div class="panel">
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
    </div>
  {/if}
  <TabBar
    bind:value={mainTab}
    tabs={[
      { value: 'build', label: t(lang, 'tab.build') },
      { value: 'inspect', label: t(lang, 'tab.inspect') },
      { value: 'present', label: t(lang, 'tab.present') },
    ]}
  />

  <div class="body">
    {#if mainTab !== 'inspect'}
      <EmptyState title={t(lang, 'tab.soon')} hint={t(lang, 'tab.soonHint')} />
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
      {#each geometry?.warnings ?? [] as w (w)}
        <p class="warning">{t(lang, `warning.${w}`)}</p>
      {/each}
      {#if error}
        <Toast message={error} dismissLabel={t(lang, 'error.dismiss')} onDismiss={onDismissError} />
      {/if}

      {#if !result}
        <EmptyState
          title={status === 'loading' ? t(lang, 'preview.analyzing') : t(lang, 'empty.selection')}
          hint={status === 'loading' ? '' : t(lang, 'empty.hint')}
        />
      {:else}
        <Segmented
          ariaLabel={t(lang, 'sub.aria')}
          bind:value={sub}
          options={[
            { value: 'findings', label: t(lang, 'sub.findings'), badge: result.findings.length },
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
          <SpecsView {result} {lang} bind:clearspace />
        {/if}
      {/if}
    {/if}
  </div>

  <footer class="ftr">
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
