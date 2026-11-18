<script lang="ts" module>
  import type { DocumentGeometry, GenerateGuides } from '@compasso/core';

  export interface GenerateThumb {
    key: string;
    label: string;
    geometry: DocumentGeometry | null;
    guides?: GenerateGuides;
    /** Mostra gli anchor (Minimal). */
    anchors?: boolean;
    /** Riga sotto la miniatura (somiglianza, anchor…). */
    caption: string;
  }
</script>

<script lang="ts">
  // Miniature di GENERA: originale e versioni generate, con le loro guide. Clic = scelta.
  import { geometryBox, logoShapes } from '../preview';

  let {
    items,
    selected = $bindable(),
    ariaLabel,
  }: { items: GenerateThumb[]; selected: string; ariaLabel: string } = $props();

  const box = $derived(geometryBox(...items.map((i) => i.geometry)));
  const vb = $derived(
    box
      ? (() => {
          const m = 0.08 * Math.max(box.width, box.height);
          return `${box.x - m} ${box.y - m} ${box.width + 2 * m} ${box.height + 2 * m}`;
        })()
      : '0 0 1 1',
  );
  const unit = $derived(box ? Math.max(box.width, box.height) / 100 : 1);
  const gridLines = (g: NonNullable<GenerateGuides['grid']>) => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    // al massimo ~60 linee per lato: oltre la griglia è solo rumore
    const every = Math.max(1, Math.ceil(Math.max(g.width, g.height) / g.step / 60));
    const s = g.step * every;
    for (let x = g.x; x <= g.x + g.width + 1e-6; x += s)
      out.push({ x1: x, y1: g.y, x2: x, y2: g.y + g.height });
    for (let y = g.y; y <= g.y + g.height + 1e-6; y += s)
      out.push({ x1: g.x, y1: y, x2: g.x + g.width, y2: y });
    return out;
  };
</script>

<div class="thumbs" role="radiogroup" aria-label={ariaLabel}>
  {#each items as it (it.key)}
    <button
      type="button"
      role="radio"
      aria-checked={selected === it.key}
      class="card"
      class:sel={selected === it.key}
      onclick={() => (selected = it.key)}
    >
      <span class="lbl">{it.label}</span>
      <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {#if it.guides?.grid}
          <g class="grid" style="stroke-width:{unit * 0.15}">
            {#each gridLines(it.guides.grid) as l, i (i)}<line {...l} />{/each}
          </g>
        {/if}
        {#if it.geometry}
          <g class="logo">
            {#each logoShapes(it.geometry) as s (s.key)}
              <path
                d={s.d}
                fill-rule="evenodd"
                class:outline={!s.filled}
                style={s.filled ? '' : `stroke-width:${s.strokeWidth}`}
              />
            {/each}
          </g>
        {/if}
        {#if it.guides}
          <g class="cons" style="stroke-width:{unit * 0.3}">
            {#each it.guides.circles as c, i (i)}<circle cx={c.cx} cy={c.cy} r={c.r} />{/each}
          </g>
        {/if}
        {#if it.anchors && it.geometry}
          <g class="anchors">
            {#each it.geometry.paths as p (p.id)}
              {#each p.segments as s, i (i)}
                <circle cx={s.p0.x} cy={s.p0.y} r={unit * 0.9} />
              {/each}
            {/each}
          </g>
        {/if}
      </svg>
      <span class="cap">{it.caption}</span>
    </button>
  {/each}
</div>

<style>
  .thumbs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-2);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding: var(--sp-2);
    background: var(--c-bg-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-s);
    cursor: pointer;
    text-align: left;
    color: var(--c-text-2);
    min-width: 0;
  }
  .card.sel {
    border-color: var(--c-accent);
    box-shadow: 0 0 0 1px var(--c-accent);
  }
  .lbl {
    font: 700 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text);
  }
  svg {
    width: 100%;
    aspect-ratio: 1;
    background: var(--c-preview-bg);
    border-radius: var(--r-s);
  }
  .logo path {
    fill: var(--c-preview-logo);
  }
  .logo path.outline {
    fill: none;
    stroke: var(--c-preview-logo);
  }
  .grid line {
    stroke: var(--c-accent);
    opacity: 0.25;
  }
  .cons circle {
    fill: none;
    stroke: var(--c-preview-line);
  }
  .anchors circle {
    fill: var(--c-accent);
  }
  .cap {
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
    line-height: 1.3;
  }
</style>
