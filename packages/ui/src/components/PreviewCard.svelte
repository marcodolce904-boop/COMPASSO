<script lang="ts">
  import type { ConstructionPlan, DocumentGeometry } from '@compasso/core';
  import type { Box, Highlight } from '../preview';
  import ConstructionSvg from './ConstructionSvg.svelte';
  import Icon from './Icon.svelte';

  let {
    title,
    stats,
    geometry,
    plan,
    viewBox,
    highlight,
    busy = false,
    label,
  }: {
    title: string;
    stats: string;
    geometry: DocumentGeometry | null;
    plan: ConstructionPlan | null;
    viewBox: Box | null;
    highlight: Highlight;
    busy?: boolean;
    label: string;
  } = $props();
</script>

<section class="card" aria-busy={busy}>
  <div class="live">
    <span class="dot" class:idle={!geometry} class:busy></span>
    <span>{title}</span>
  </div>
  <div class="thumb">
    {#if geometry && viewBox}
      <ConstructionSvg {geometry} {plan} {highlight} {viewBox} mode="preview" {label} />
    {:else}
      <span class="placeholder"><Icon name="select" size={40} /></span>
    {/if}
  </div>
  <p class="stats">{stats}</p>
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
  .live {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font: 500 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-2);
  }
  .dot {
    width: var(--sz-dot);
    height: var(--sz-dot);
    border-radius: 50%;
    background: var(--c-accent);
    box-shadow: 0 0 0 var(--sz-halo) var(--c-accent-dim);
  }
  .dot.idle {
    background: var(--c-text-3);
    box-shadow: none;
  }
  .dot.busy {
    animation: pulse 0.9s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
      box-shadow: 0 0 0 var(--sz-halo-pulse) var(--c-accent-dim);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot.busy {
      animation: none;
    }
  }
  .thumb {
    height: var(--h-thumb);
    padding: var(--sp-2);
    border-radius: var(--r-s);
    background: var(--c-preview-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .placeholder {
    color: var(--c-text-3);
    display: flex;
  }
  .stats {
    text-align: center;
    font: 400 var(--fs-s) var(--f-mono);
    color: var(--c-text-2);
  }
</style>
