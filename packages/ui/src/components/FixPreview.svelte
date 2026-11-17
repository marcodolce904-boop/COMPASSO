<script lang="ts">
  import type { DocumentGeometry } from '@compasso/core';
  import { geometryBox, logoShapes, movedAnchors } from '../preview';
  import Segmented from './Segmented.svelte';

  export type FixMode = 'after' | 'compare' | 'before';
  let {
    title,
    original,
    fixed,
    mode = $bindable('compare'),
    modeLabels,
    modeAria,
    legend,
    summary,
    busy = false,
  }: {
    title: string;
    original: DocumentGeometry;
    fixed: DocumentGeometry | null;
    mode?: FixMode;
    modeLabels: Record<FixMode, string>;
    modeAria: string;
    legend: string;
    summary: string;
    busy?: boolean;
  } = $props();

  const after = $derived(fixed ?? original);
  const box = $derived(geometryBox(original, after));
  const vb = $derived(box ? `${box.x} ${box.y} ${box.width} ${box.height}` : '0 0 1 1');
  const filled = $derived(logoShapes(mode === 'before' ? original : after));
  const outline = $derived(mode === 'compare' ? logoShapes(original) : []);
  const moved = $derived(mode === 'compare' && fixed ? movedAnchors(original, fixed) : []);
  const dot = $derived(box ? Math.max(box.width, box.height) * 0.012 : 1);
</script>

<section class="card" aria-busy={busy}>
  <div class="head">
    <span class="title">{title}</span>
    <div class="modes">
      <Segmented
        ariaLabel={modeAria}
        bind:value={mode}
        dense
        options={[
          { value: 'after', label: modeLabels.after },
          { value: 'compare', label: modeLabels.compare },
          { value: 'before', label: modeLabels.before },
        ]}
      />
    </div>
  </div>
  <div class="thumb">
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label={summary}>
      <g class="fill">
        {#each filled as s (s.key)}<path d={s.d} fill-rule="evenodd" />{/each}
      </g>
      <g class="outline">
        {#each outline as s (s.key)}<path d={s.d} fill-rule="evenodd" />{/each}
      </g>
      <g class="moved">
        {#each moved as p, i (i)}<circle cx={p.x} cy={p.y} r={dot} />{/each}
      </g>
    </svg>
  </div>
  {#if mode === 'compare'}<p class="legend">{legend}</p>{/if}
  <p class="summary">{summary}</p>
</section>

<style>
  .card {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-2) calc(var(--sp-2) + var(--sp-1) / 2);
    border-radius: var(--r-m);
    background: var(--c-bg-card);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .title {
    font: 500 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-2);
  }
  .modes {
    flex: 1;
    min-width: 0;
    max-width: calc(var(--w-panel) * 0.62);
    margin-left: auto;
  }
  .thumb {
    height: var(--h-thumb);
    padding: var(--sp-2);
    border-radius: var(--r-s);
    background: var(--c-preview-bg);
    overflow: hidden;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .fill path {
    fill: var(--c-preview-logo);
  }
  .outline path {
    fill: none;
    stroke: var(--c-accent);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
  }
  .moved circle {
    fill: var(--c-accent);
  }
  .legend {
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
    text-align: center;
  }
  .summary {
    text-align: center;
    font: 400 var(--fs-s) / var(--lh-text) var(--f-mono);
    color: var(--c-text-2);
  }
</style>
