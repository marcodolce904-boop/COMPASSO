<script lang="ts">
  // Area SVG con zoom (rotella, + / −, tastiera) e spostamento (trascinamento).
  import type { Snippet } from 'svelte';

  type View = { x: number; y: number; w: number; h: number };
  export interface PaneContext {
    zoom: number;
    /** Unità del disegno per pixel dello schermo (per disegnare punti di dimensione fissa). */
    px: number;
    /** Punto dello schermo → coordinate del disegno. */
    toUser: (cx: number, cy: number) => { x: number; y: number } | null;
  }
  let {
    fit,
    resetKey,
    labels,
    children,
    onKey,
    onBackgroundClick,
  }: {
    /** Vista intera (coordinate del contenuto). */
    fit: View;
    /** Quando cambia si torna alla vista intera. */
    resetKey?: unknown;
    labels: { in: string; out: string; fit: string; area: string };
    children: Snippet<[PaneContext]>;
    /** Tasti: se restituisce true il tasto è gestito (niente zoom/spostamento). */
    onKey?: (e: KeyboardEvent) => boolean;
    /** Clic (senza trascinare) su un punto vuoto. */
    onBackgroundClick?: (p: { x: number; y: number }, e: PointerEvent) => void;
  } = $props();
  let cw = $state(1);
  let ch = $state(1);

  const MIN = 0.5;
  const MAX = 400;
  let view = $state<View | null>(null);
  const cur = $derived(view ?? fit);
  const zoom = $derived(fit.w / cur.w);
  $effect(() => {
    void resetKey;
    view = null;
  });
  let svgEl = $state<SVGSVGElement | null>(null);
  let wrapEl = $state<HTMLDivElement | null>(null);

  function toUser(cx: number, cy: number) {
    const m = svgEl?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function zoomAt(factor: number, p: { x: number; y: number } | null) {
    const c = cur;
    const f = Math.max(MIN, Math.min(MAX, zoom * factor)) / zoom;
    if (Math.abs(f - 1) < 1e-9) return;
    const at = p ?? { x: c.x + c.w / 2, y: c.y + c.h / 2 };
    view = { x: at.x - (at.x - c.x) / f, y: at.y - (at.y - c.y) / f, w: c.w / f, h: c.h / f };
  }
  const panBy = (dx: number, dy: number) => (view = { ...cur, x: cur.x + dx, y: cur.y + dy });
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
  let drag: { id: number; x: number; y: number; x0: number; y0: number } | null = null;
  let dragging = $state(false);
  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    // pulsanti dello zoom e oggetti modificabili (punti, maniglie, curve) gestiscono da soli
    if ((e.target as Element).closest('button, [data-edit]')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag || drag.id !== e.pointerId) return;
    const s = svgEl?.getScreenCTM()?.a ?? 1;
    panBy(-(e.clientX - drag.x) / s, -(e.clientY - drag.y) / s);
    drag = { ...drag, x: e.clientX, y: e.clientY };
  }
  function up(e: PointerEvent) {
    if (drag && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4 && onBackgroundClick) {
      const p = toUser(e.clientX, e.clientY);
      if (p) onBackgroundClick(p, e);
    }
    drag = null;
    dragging = false;
  }
  function key(e: KeyboardEvent) {
    if (onKey && onKey(e)) {
      e.preventDefault();
      return;
    }
    const step = cur.w * 0.1;
    const keys: Record<string, () => void> = {
      '+': () => zoomAt(1.25, null),
      '=': () => zoomAt(1.25, null),
      '-': () => zoomAt(0.8, null),
      '0': () => (view = null),
      ArrowLeft: () => panBy(-step, 0),
      ArrowRight: () => panBy(step, 0),
      ArrowUp: () => panBy(0, -step),
      ArrowDown: () => panBy(0, step),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="pane"
  class:dragging
  bind:this={wrapEl}
  bind:clientWidth={cw}
  bind:clientHeight={ch}
  role="application"
  aria-label={labels.area}
  tabindex="0"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  ondblclick={(e) => {
    if (!(e.target as Element).closest('[data-edit]')) view = null;
  }}
  onkeydown={key}
>
  <svg
    bind:this={svgEl}
    viewBox="{cur.x} {cur.y} {cur.w} {cur.h}"
    preserveAspectRatio="xMidYMid meet"
  >
    {@render children({
      zoom,
      px: Math.max(cur.w / Math.max(1, cw), cur.h / Math.max(1, ch)),
      toUser,
    })}
  </svg>
  <div class="zoom">
    <button type="button" aria-label={labels.out} onclick={() => zoomAt(0.8, null)}>−</button>
    <span class="pct">{Math.round(zoom * 100)}%</span>
    <button type="button" aria-label={labels.in} onclick={() => zoomAt(1.25, null)}>+</button>
    <button type="button" class="fitb" onclick={() => (view = null)}>{labels.fit}</button>
  </div>
</div>

<style>
  .pane {
    position: relative;
    height: var(--h-thumb);
    border-radius: var(--r-s);
    background: var(--c-preview-bg);
    overflow: hidden;
    cursor: grab;
    touch-action: none;
  }
  .pane.dragging {
    cursor: grabbing;
  }
  .pane:focus-visible {
    outline: 1px solid var(--c-accent);
    outline-offset: 1px;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
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
</style>
