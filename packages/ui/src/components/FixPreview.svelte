<script lang="ts">
  import type { DocumentGeometry } from '@compasso/core';
  import { geometryBox, logoShapes, movedAnchors } from '../preview';
  import Segmented from './Segmented.svelte';

  export type FixMode = 'after' | 'compare' | 'wipe' | 'before';
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
    zoomLabels,
    excluded = [],
    onToggleExclude = () => {},
    excludeLabels,
    warning = '',
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
    zoomLabels: { in: string; out: string; fit: string; area: string; hint: string };
    /** Forme escluse dalla correzione (chiave = glifo o tracciato). */
    excluded?: string[];
    onToggleExclude?: (key: string | null) => void;
    excludeLabels: { count: string; clear: string };
    /** Avviso (es. spostamenti grandi). */
    warning?: string;
  } = $props();
  const excludedSet = $derived(new Set(excluded));
  const uid = $props.id();
  // tendina: posizione della linea nella vista (0 = bordo sinistro, 1 = bordo destro)
  let wipeT = $state(0.5);
  type View = { x: number; y: number; w: number; h: number };
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 400;

  const after = $derived(fixed ?? original);
  const box = $derived(geometryBox(original, after));
  // vista adattata al logo (con un piccolo margine) e vista corrente (zoom/spostamento)
  const fit = $derived<View>(
    box
      ? {
          x: box.x - box.width * 0.04,
          y: box.y - box.height * 0.04,
          w: box.width * 1.08,
          h: box.height * 1.08,
        }
      : { x: 0, y: 0, w: 1, h: 1 },
  );
  let view = $state<View | null>(null);
  const cur = $derived(view ?? fit);
  const zoom = $derived(fit.w / cur.w);
  const vb = $derived(`${cur.x} ${cur.y} ${cur.w} ${cur.h}`);
  // nuova selezione → si riparte dalla vista intera
  $effect(() => {
    void original;
    view = null;
  });

  let svgEl = $state<SVGSVGElement | null>(null);
  let wrapEl = $state<HTMLDivElement | null>(null);

  /** Punto dello schermo → coordinate del logo. */
  function toUser(cx: number, cy: number): { x: number; y: number } | null {
    const m = svgEl?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function zoomAt(factor: number, p: { x: number; y: number } | null) {
    const c = cur;
    const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    const f = target / zoom;
    if (Math.abs(f - 1) < 1e-9) return;
    const at = p ?? { x: c.x + c.w / 2, y: c.y + c.h / 2 };
    view = {
      x: at.x - (at.x - c.x) / f,
      y: at.y - (at.y - c.y) / f,
      w: c.w / f,
      h: c.h / f,
    };
  }
  function panBy(dx: number, dy: number) {
    const c = cur;
    view = { ...c, x: c.x + dx, y: c.y + dy };
  }

  // rotella: zoom attorno al cursore (listener non passivo per bloccare lo scorrimento del pannello)
  $effect(() => {
    const el = wrapEl;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0015), toUser(e.clientX, e.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // trascinamento: sposta la vista (o, in Tendina, la linea se si parte vicino a lei)
  let drag: { id: number; x: number; y: number } | null = null;
  let wiping: number | null = null;
  /** Punto dello schermo → frazione della vista (0–1) lungo x. */
  function fracAt(cx: number): number | null {
    const p = toUser(cx, 0);
    return p ? (p.x - cur.x) / cur.w : null;
  }
  let dragging = $state(false);
  // clic (senza trascinare) su una forma: la esclude dalla correzione, o la riammette
  let press: { x: number; y: number; key: string | null } | null = null;
  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as Element).closest('button')) return; // i pulsanti di zoom non trascinano
    if (mode === 'wipe') {
      const f = fracAt(e.clientX);
      const px = svgEl?.getScreenCTM()?.a ?? 1;
      if (f !== null && Math.abs(f - wipeT) * cur.w * px < 16) {
        wiping = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }
    const shape = (e.target as Element).closest('[data-key]');
    press = { x: e.clientX, y: e.clientY, key: shape ? shape.getAttribute('data-key') : null };
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (wiping === e.pointerId) {
      const f = fracAt(e.clientX);
      if (f !== null) wipeT = Math.max(0, Math.min(1, f));
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const s = svgEl?.getScreenCTM()?.a ?? 1; // pixel per unità del logo
    panBy(-(e.clientX - drag.x) / s, -(e.clientY - drag.y) / s);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function up(e: PointerEvent) {
    if (wiping === e.pointerId) {
      wiping = null;
      return;
    }
    if (drag?.id === e.pointerId) drag = null;
    dragging = false;
    if (press && press.key && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4)
      onToggleExclude(press.key);
    press = null;
  }
  function key(e: KeyboardEvent) {
    const step = cur.w * 0.1;
    const keys: Record<string, () => void> = {
      '+': () => zoomAt(1.25, null),
      '=': () => zoomAt(1.25, null),
      '-': () => zoomAt(0.8, null),
      '0': () => (view = null),
      ArrowLeft: () => (mode === 'wipe' ? (wipeT = Math.max(0, wipeT - 0.05)) : panBy(-step, 0)),
      ArrowRight: () => (mode === 'wipe' ? (wipeT = Math.min(1, wipeT + 0.05)) : panBy(step, 0)),
      ArrowUp: () => panBy(0, -step),
      ArrowDown: () => panBy(0, step),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }
  const filled = $derived(logoShapes(mode === 'before' ? original : after));
  const beforeShapes = $derived(mode === 'wipe' ? logoShapes(original) : []);
  const splitX = $derived(cur.x + cur.w * wipeT);
  const outline = $derived(mode === 'compare' ? logoShapes(original) : []);
  const moved = $derived(mode === 'compare' && fixed ? movedAnchors(original, fixed) : []);
  const dot = $derived((box ? Math.max(box.width, box.height) * 0.012 : 1) / Math.max(1, zoom));
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
          { value: 'wipe', label: modeLabels.wipe },
          { value: 'before', label: modeLabels.before },
        ]}
      />
    </div>
  </div>
  <!-- area di zoom/spostamento: gestisce mouse e tastiera (frecce, + − 0) -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="thumb"
    class:dragging
    bind:this={wrapEl}
    role="application"
    aria-label={zoomLabels.area}
    tabindex="0"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    ondblclick={() => (mode === 'wipe' ? (wipeT = 0.5) : (view = null))}
    onkeydown={key}
  >
    <svg
      bind:this={svgEl}
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={summary}
    >
      {#if mode === 'wipe'}
        <defs>
          <clipPath id="{uid}-l"
            ><rect
              x={cur.x - cur.w}
              y={cur.y - cur.h}
              width={splitX - cur.x + cur.w}
              height={cur.h * 3}
            /></clipPath
          >
          <clipPath id="{uid}-r"
            ><rect x={splitX} y={cur.y - cur.h} width={cur.w * 2} height={cur.h * 3} /></clipPath
          >
        </defs>
        <g class="fill before" clip-path="url(#{uid}-l)">
          {#each beforeShapes as s (s.key)}<path
              d={s.d}
              fill-rule="evenodd"
              class:line={!s.filled}
              style={s.filled ? '' : `stroke-width:${s.strokeWidth}`}
            />{/each}
        </g>
      {/if}
      <g class="fill" clip-path={mode === 'wipe' ? `url(#${uid}-r)` : undefined}>
        {#each filled as s (s.key)}<path
            d={s.d}
            data-key={s.key}
            fill-rule="evenodd"
            class:line={!s.filled}
            class:excluded={excludedSet.has(s.key)}
            style={s.filled ? '' : `stroke-width:${s.strokeWidth}`}
          />{/each}
      </g>
      <g class="outline">
        {#each outline as s (s.key)}<path d={s.d} fill-rule="evenodd" />{/each}
      </g>
      <g class="moved">
        {#each moved as p, i (i)}<circle cx={p.x} cy={p.y} r={dot} />{/each}
      </g>
      {#if mode === 'wipe'}
        <g class="split">
          <line x1={splitX} x2={splitX} y1={cur.y} y2={cur.y + cur.h} />
          <circle cx={splitX} cy={cur.y + cur.h / 2} r={dot * 3.2} />
        </g>
      {/if}
    </svg>
    {#if mode === 'wipe'}
      <span class="tag left">{modeLabels.before}</span>
      <span class="tag right">{modeLabels.after}</span>
    {/if}
    <div class="zoom">
      <button type="button" aria-label={zoomLabels.out} onclick={() => zoomAt(0.8, null)}>−</button>
      <span class="pct">{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label={zoomLabels.in} onclick={() => zoomAt(1.25, null)}>+</button>
      <button type="button" class="fitb" onclick={() => (view = null)}>{zoomLabels.fit}</button>
    </div>
  </div>
  <p class="legend">{zoomLabels.hint}</p>
  {#if mode === 'compare'}<p class="legend">{legend}</p>{/if}
  {#if excluded.length}
    <p class="legend excl">
      {excludeLabels.count}
      <button type="button" class="link" onclick={() => onToggleExclude(null)}
        >{excludeLabels.clear}</button
      >
    </p>
  {/if}
  <p class="summary">{summary}</p>
  {#if warning}<p class="warn" role="status">{warning}</p>{/if}
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
    position: relative;
    cursor: grab;
    touch-action: none;
  }
  .thumb.dragging {
    cursor: grabbing;
  }
  .thumb:focus-visible {
    outline: 1px solid var(--c-accent);
    outline-offset: 1px;
  }
  .zoom {
    position: absolute;
    right: var(--sp-1);
    bottom: var(--sp-1);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: var(--r-s);
    background: var(--c-bg-card);
    cursor: default;
  }
  .zoom button {
    min-width: 22px;
    height: 22px;
    padding: 0 var(--sp-1);
    border: 0;
    border-radius: var(--r-s);
    background: transparent;
    color: var(--c-text);
    font: 500 var(--fs-s) var(--f-mono);
    cursor: pointer;
  }
  .zoom button:hover {
    background: var(--c-bg-raised);
  }
  .zoom .fitb {
    font-size: var(--fs-xs);
    letter-spacing: var(--ls-caps);
  }
  .pct {
    min-width: 40px;
    text-align: center;
    font: 400 var(--fs-xs) var(--f-mono);
    color: var(--c-text-2);
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .fill path {
    fill: var(--c-preview-logo);
  }
  /* forme escluse dalla correzione: attenuate e tratteggiate */
  .fill path.excluded {
    opacity: 0.35;
    stroke: var(--c-text-2);
    stroke-width: 1;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
  }
  .fill path {
    cursor: pointer;
  }
  .outline,
  .moved {
    pointer-events: none;
  }
  .excl .link {
    margin-left: var(--sp-1);
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-accent);
    font: inherit;
    cursor: pointer;
  }
  .warn {
    font: 400 var(--fs-xs) / var(--lh-text) var(--f-sans);
    color: var(--c-warn);
    text-align: center;
  }
  /* tracciati solo a contorno (linee aperte): si disegnano come linee, non come forme piene */
  .fill path.line {
    fill: none;
    stroke: var(--c-preview-logo);
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
  /* tendina: il prima più chiaro, la linea e la maniglia nel colore d'accento */
  .fill.before path {
    fill: var(--c-text-3);
  }
  .fill.before path.line {
    fill: none;
    stroke: var(--c-text-3);
  }
  .split {
    pointer-events: none;
  }
  .split line {
    stroke: var(--c-accent);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .split circle {
    fill: var(--c-accent);
  }
  .tag {
    position: absolute;
    top: var(--sp-1);
    padding: 1px var(--sp-1);
    border-radius: var(--r-s);
    background: var(--c-bg-card);
    font: 500 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-2);
    pointer-events: none;
  }
  .tag.left {
    left: var(--sp-1);
  }
  .tag.right {
    right: var(--sp-1);
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
