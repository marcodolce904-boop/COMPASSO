<script lang="ts">
  // Livello della penna dentro l'anteprima: punti, maniglie e curve modificabili col mouse.
  import {
    insertNode,
    moveHandle,
    moveNodes,
    nearestOnPaths,
    removeNode,
    toggleCorner,
    type EditPath,
    type NodeRef,
    type Vec2,
  } from '@compasso/core';
  import type { PenEditor } from '../pen.svelte';

  let {
    editor,
    paths,
    px,
    toUser,
  }: {
    editor: PenEditor;
    /** Tracciati da mostrare (modificati o quelli del ricalco). */
    paths: EditPath[];
    /** Unità del disegno per pixel dello schermo. */
    px: number;
    toUser: (cx: number, cy: number) => Vec2 | null;
  } = $props();

  type Drag =
    | { kind: 'nodes'; start: Vec2; base: EditPath[]; moved: boolean; id: number }
    | {
        kind: 'handle';
        ref: NodeRef;
        which: 'in' | 'out';
        base: EditPath[];
        moved: boolean;
        id: number;
      };
  let drag: Drag | null = null;

  const segD = (p: EditPath, s: number) => {
    const a = p.nodes[s]!;
    const b = p.nodes[(s + 1) % p.nodes.length]!;
    return `M${a.p.x} ${a.p.y}C${a.hout.x} ${a.hout.y} ${b.hin.x} ${b.hin.y} ${b.p.x} ${b.p.y}`;
  };
  const segs = (p: EditPath) => (p.closed ? p.nodes.length : p.nodes.length - 1);
  const differs = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) > 1e-9 || Math.abs(a.y - b.y) > 1e-9;

  function capture(e: PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function anchorDown(e: PointerEvent, ref: NodeRef) {
    if (e.button !== 0) return;
    capture(e);
    const tool = editor.tool;
    if (tool === 'delete') {
      editor.commit(removeNode(paths, ref));
      editor.clearSelection();
      return;
    }
    if (tool === 'convert') {
      editor.commit(toggleCorner(paths, ref));
      editor.select(ref, false);
      return;
    }
    if (e.shiftKey) editor.select(ref, true);
    else if (!editor.isSelected(ref)) editor.select(ref, false);
    const start = toUser(e.clientX, e.clientY);
    if (start) drag = { kind: 'nodes', start, base: paths, moved: false, id: e.pointerId };
  }

  function handleDown(e: PointerEvent, ref: NodeRef, which: 'in' | 'out') {
    if (e.button !== 0) return;
    capture(e);
    drag = { kind: 'handle', ref, which, base: paths, moved: false, id: e.pointerId };
  }

  function segmentDown(e: PointerEvent) {
    if (e.button !== 0 || editor.tool !== 'add') return;
    capture(e);
    const q = toUser(e.clientX, e.clientY);
    if (!q) return;
    const hit = nearestOnPaths(paths, q, 12 * px);
    if (!hit) return;
    const { paths: next, ref } = insertNode(paths, hit.path, hit.seg, hit.t);
    editor.commit(next);
    editor.select(ref, false);
    // il punto appena aggiunto si può trascinare subito
    drag = { kind: 'nodes', start: q, base: next, moved: true, id: e.pointerId };
  }

  function move(e: PointerEvent) {
    if (!drag || drag.id !== e.pointerId) return;
    const q = toUser(e.clientX, e.clientY);
    if (!q) return;
    if (!drag.moved) {
      editor.checkpoint();
      drag.moved = true;
    }
    if (drag.kind === 'nodes') {
      editor.preview(
        moveNodes(drag.base, editor.selection, q.x - drag.start.x, q.y - drag.start.y),
      );
    } else {
      editor.preview(moveHandle(drag.base, drag.ref, drag.which, q, e.altKey));
    }
  }
  function up(e: PointerEvent) {
    if (drag?.id === e.pointerId) drag = null;
  }
  function anchorDouble(e: MouseEvent, ref: NodeRef) {
    if (editor.tool !== 'select') return;
    e.stopPropagation();
    editor.commit(toggleCorner(paths, ref));
  }
</script>

<g class="pen" class:adding={editor.tool === 'add'}>
  {#if editor.tool === 'add'}
    <!-- curve cliccabili per aggiungere un punto -->
    {#each paths as p, pi (pi)}
      {#each Array.from({ length: segs(p) }, (_, s) => s) as s (s)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <path
          class="hit"
          data-edit
          d={segD(p, s)}
          style="stroke-width:{12 * px}"
          onpointerdown={segmentDown}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
        />
      {/each}
    {/each}
  {/if}
  {#each paths as p, pi (pi)}
    {#each p.nodes as n, ni (ni)}
      {@const ref = { path: pi, node: ni }}
      {@const sel = editor.isSelected(ref)}
      {#if sel}
        {#each [['in', n.hin], ['out', n.hout]] as const as [which, h] (which)}
          {#if differs(h, n.p)}
            <line class="arm" x1={n.p.x} y1={n.p.y} x2={h.x} y2={h.y} />
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              class="knob"
              data-edit
              cx={h.x}
              cy={h.y}
              r={4 * px}
              onpointerdown={(e) => handleDown(e, ref, which)}
              onpointermove={move}
              onpointerup={up}
              onpointercancel={up}
            />
          {/if}
        {/each}
      {/if}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <rect
        class="anchor"
        class:sel
        class:round={differs(n.hin, n.p) || differs(n.hout, n.p)}
        data-edit
        x={n.p.x - 4 * px}
        y={n.p.y - 4 * px}
        width={8 * px}
        height={8 * px}
        rx={differs(n.hin, n.p) || differs(n.hout, n.p) ? 4 * px : 0}
        onpointerdown={(e) => anchorDown(e, ref)}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        ondblclick={(e) => anchorDouble(e, ref)}
      />
    {/each}
  {/each}
</g>

<style>
  .hit {
    fill: none;
    stroke: transparent;
    pointer-events: stroke;
    cursor: copy;
  }
  .arm {
    stroke: var(--c-accent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .knob {
    fill: var(--c-accent);
    stroke: var(--c-bg-card);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    cursor: grab;
  }
  .anchor {
    fill: var(--c-bg-card);
    stroke: var(--c-accent);
    stroke-width: 1.25;
    vector-effect: non-scaling-stroke;
    cursor: pointer;
  }
  .anchor.sel {
    fill: var(--c-accent);
  }
  .adding .anchor {
    pointer-events: none;
  }
</style>
