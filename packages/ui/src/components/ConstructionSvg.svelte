<script lang="ts">
  import type { ConstructionPlan, DocumentGeometry } from '@compasso/core';
  import { logoShapes, type Box, type Highlight } from '../preview';

  // `preview`: miniatura nel pannello (spessori in px, non scalati).
  // `artboard`: harness, simula il layer disegnato in Illustrator (spessori in pt).
  let {
    geometry,
    plan,
    highlight,
    viewBox,
    mode = 'preview',
    artboard = null,
    label,
  }: {
    geometry: DocumentGeometry;
    plan: ConstructionPlan | null;
    highlight: Highlight;
    viewBox: Box;
    mode?: 'preview' | 'artboard';
    /** Tavola da disegnare sotto al logo (solo harness). */
    artboard?: Box | null;
    label: string;
  } = $props();

  const shapes = $derived(logoShapes(geometry));
  const sw = $derived(plan?.style.strokeWidth ?? 0.75);
  const dash = $derived((plan?.style.axisDash ?? [4, 3]).join(' '));
  const vb = $derived(`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  const anchorSize = $derived(Math.max(viewBox.width, viewBox.height) * 0.018);
  const axisLine = (theta: number, rho: number) => {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const L = Math.max(viewBox.width, viewBox.height) * 2;
    return { x1: c * rho + s * L, y1: s * rho - c * L, x2: c * rho - s * L, y2: s * rho + c * L };
  };
</script>

<svg
  class={mode}
  viewBox={vb}
  preserveAspectRatio="xMidYMid meet"
  role="img"
  aria-label={label}
  style="--sw:{sw}"
>
  {#if artboard}
    <rect
      class="board"
      x={artboard.x}
      y={artboard.y}
      width={artboard.width}
      height={artboard.height}
    />
  {/if}
  <g class="logo">
    {#each shapes as s (s.key)}
      <path
        d={s.d}
        fill-rule="evenodd"
        class:outline={!s.filled}
        style={s.filled ? '' : `stroke-width:${s.strokeWidth}`}
      />
    {/each}
  </g>
  {#if plan}
    <g class="cons">
      {#each plan.primitives as p (p.id)}
        {@const hl = highlight.ids.has(p.id)}
        {#if p.type === 'circle'}
          <circle
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            class:hl
            class:approx={p.dashed}
            stroke-dasharray={p.dashed ? dash : undefined}
          />
        {:else if p.type === 'ellipse'}
          <ellipse
            cx={p.cx}
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
            transform="rotate({(p.rotation * 180) / Math.PI} {p.cx} {p.cy})"
            class:hl
          />
        {:else if p.type === 'line'}
          <line
            x1={p.a.x}
            y1={p.a.y}
            x2={p.b.x}
            y2={p.b.y}
            class:hl
            stroke-dasharray={p.group === 'axes' ? dash : undefined}
          />
        {:else if p.type === 'marker'}
          {@const h = plan.style.markerSize / 2}
          {#if p.shape === 'cross'}
            <path d="M{p.at.x - h} {p.at.y}h{2 * h}M{p.at.x} {p.at.y - h}v{2 * h}" class:hl />
          {:else}
            <rect x={p.at.x - h / 2} y={p.at.y - h / 2} width={h} height={h} class:hl />
          {/if}
        {:else if p.type === 'unit'}
          <rect class="unit" x={p.x} y={p.y} width={p.size} height={p.size} />
          {#if p.label}
            <text
              class="unit-label"
              x={p.x + p.size / 2}
              y={p.y - p.size * 0.2}
              font-size={p.size * 0.45}>{p.label}</text
            >
          {/if}
        {:else if p.type === 'rect'}
          <rect
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            stroke-dasharray={p.dashed ? dash : undefined}
          />
        {/if}
      {/each}
    </g>
  {/if}
  <g class="hl-layer">
    {#each highlight.axes as a, i (i)}
      <line {...axisLine(a.theta, a.rho)} stroke-dasharray={dash} />
    {/each}
    {#each highlight.segments as d, i (i)}
      <path {d} />
    {/each}
    {#each highlight.anchors as a, i (i)}
      <rect
        x={a.x - anchorSize / 2}
        y={a.y - anchorSize / 2}
        width={anchorSize}
        height={anchorSize}
      />
    {/each}
  </g>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .logo path {
    fill: var(--c-preview-logo);
  }
  .logo path.outline {
    fill: none;
    stroke: var(--c-preview-logo);
  }
  .cons * {
    fill: none;
    stroke: var(--c-preview-line);
    stroke-width: var(--sw);
    transition: stroke var(--t-fast);
  }
  .preview .cons *,
  .preview .hl-layer * {
    vector-effect: non-scaling-stroke;
  }
  .cons .hl {
    stroke: var(--c-accent);
    stroke-width: calc(var(--sw) * 2 + 0.5);
  }
  .cons .unit {
    fill: var(--c-preview-unit);
    stroke-width: calc(var(--sw) * 0.5);
  }
  .cons .unit-label {
    fill: var(--c-preview-line);
    stroke: none;
    text-anchor: middle;
    font-family: var(--f-sans);
  }
  .hl-layer * {
    fill: none;
    stroke: var(--c-accent);
    stroke-width: calc(var(--sw) * 2 + 0.5);
  }
  .hl-layer rect {
    fill: var(--c-accent);
  }
  /* tavola dell'harness: logo scuro, costruzione nel grigio automatico RGB (§8.2) */
  .board {
    fill: var(--c-artboard);
  }
  svg.artboard {
    overflow: hidden;
  }
  .artboard .logo path {
    fill: var(--c-artboard-logo);
  }
  .artboard .logo path.outline {
    fill: none;
    stroke: var(--c-artboard-logo);
  }
  .artboard .cons * {
    stroke: var(--c-construction);
  }
  .artboard .cons .unit-label {
    fill: var(--c-construction);
  }
</style>
