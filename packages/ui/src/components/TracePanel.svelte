<script lang="ts">
  // Scheda RICALCA: schizzo → tracciati puliti col minimo di anchor.
  import {
    fromEdit,
    geometryBBox,
    perfectPlan,
    PERFECT_DEFAULTS,
    refine,
    refineDefaults,
    toEdit,
    trace,
    traceDefaults,
    type ConstructionPlan,
    type DocumentGeometry,
    type DrawStyle,
    type PerfectOptions,
    type PerfectReport,
    type TraceOptions,
    type TracePlacement,
  } from '@compasso/core';
  import { untrack } from 'svelte';
  import { num, t, type Lang } from '../strings';
  import { logoShapes } from '../preview';
  import type { LoadedImage } from '../raster';
  import Segmented from './Segmented.svelte';
  import Slider from './Slider.svelte';
  import Toggle from './Toggle.svelte';
  import TextButton from './TextButton.svelte';
  import ZoomPane from './ZoomPane.svelte';
  import EmptyState from './EmptyState.svelte';
  import PenLayer from './PenLayer.svelte';
  import { PenEditor, type PenTool } from '../pen.svelte';

  export interface TraceSource {
    loaded: LoadedImage;
    place: TracePlacement;
    name: string;
  }
  export interface TraceReady {
    geometry: DocumentGeometry;
    style: { filled: boolean; strokeWidth: number };
    /** Regolazioni usate (per la segnalazione di un problema). */
    options: TraceOptions;
    perfect: boolean;
    /** Perfeziona: cosa è stato fatto e, se richiesta, la costruzione da disegnare. */
    report?: PerfectReport | null;
    construction?: ConstructionPlan | null;
  }

  let {
    lang,
    source,
    pickLabel,
    onPick,
    message = '',
    output = $bindable(null),
    wide = false,
    drawStyle = {
      strokeWidth: 0.75,
      markerSize: 8,
      color: 'auto',
      axisDash: [4, 3],
      lineExtent: 'segment',
    },
  }: {
    lang: Lang;
    source: TraceSource | null;
    pickLabel: string;
    onPick: () => void;
    message?: string;
    output?: TraceReady | null;
    /** Pannello largo: anteprima e controlli su due colonne (figli diretti della griglia). */
    wide?: boolean;
    /** Stile della costruzione (come in ANALIZZA), per Perfeziona. */
    drawStyle?: DrawStyle;
  } = $props();

  let options = $state<TraceOptions | null>(null);
  let defaults = $state<TraceOptions | null>(null);
  let markSide = $state(10); // lato (px) dei segni da ignorare: minArea = lato²
  let perfect = $state(true);
  let drawCons = $state(false); // Perfeziona: disegna anche la costruzione
  let showImage = $state(true);
  let ms = $state<number | null>(null);
  let busy = $state(false);
  /** Risultato del ricalco (prima delle modifiche a mano). */
  let traced = $state.raw<TraceReady | null>(null);
  const editor = new PenEditor();
  let editNote = $state('');
  // regolazioni come testo: nello storico insieme ai tracciati
  const settingsKey = () =>
    JSON.stringify({ options: $state.snapshot(options), markSide, perfect });
  editor.settings = () => untrack(settingsKey);
  editor.applySettings = (s: string) => {
    const v = JSON.parse(s) as { options: TraceOptions; markSide: number; perfect: boolean };
    options = v.options;
    markSide = v.markSide;
    perfect = v.perfect;
  };
  let lastSettings = '';

  /** «×»: barre ai valori predefiniti e via le modifiche; lo schizzo resta (si può annullare). */
  function resetAll() {
    if (!defaults) return;
    editor.checkpoint();
    editor.paths = null;
    editor.clearSelection();
    options = { ...defaults };
    markSide = Math.round(Math.sqrt(defaults.minArea));
    perfect = true;
    lastSettings = untrack(settingsKey); // non è un movimento di cursore: niente secondo passo
    editNote = '';
  }

  // nuova immagine: valori predefiniti proporzionati alla sua dimensione
  $effect(() => {
    const s = source;
    untrack(() => {
      if (!s) return;
      editor.reset();
      editNote = '';
      lastSettings = '';
      const d = traceDefaults(s.loaded.image.width, s.loaded.image.height);
      const mode = options?.mode ?? d.mode;
      defaults = d;
      options = { ...d, mode };
      markSide = Math.round(Math.sqrt(d.minArea));
    });
  });

  // ricalco dal vivo (con un piccolo ritardo mentre si trascina una barra)
  $effect(() => {
    const s = source;
    const o = options ? { ...$state.snapshot(options), minArea: markSide * markSide } : null;
    const p = perfect;
    const key = settingsKey();
    if (!s || !o) {
      traced = null;
      return;
    }
    busy = true;
    const id = setTimeout(() => {
      try {
        const out = trace(s.loaded.image, o as TraceOptions, s.place);
        let g = out.geometry;
        // Perfeziona esce già esatto: le correzioni di CORREGGI non servono
        if (p && o.mode !== 'perfect' && g.paths.length)
          g = refine(g, refineDefaults(g).options).geometry;
        ms = out.stats.ms;
        // regolazioni cambiate: passo nello storico; le modifiche a mano non valgono più
        // (restano recuperabili con «Indietro»)
        untrack(() => {
          if (lastSettings && key !== lastSettings && editor.settled(lastSettings))
            editNote = t(lang, 'pen.reset');
          else if (editor.pending !== undefined) editor.settled(lastSettings);
          lastSettings = key;
        });
        traced = {
          geometry: g,
          style: { filled: o.mode !== 'lines', strokeWidth: Math.max(0.25, out.strokeWidth) },
          options: o as TraceOptions,
          perfect: p,
          report: out.perfect ?? null,
        };
      } catch (e) {
        console.error('[compasso] ricalco non riuscito', e);
        traced = null;
        ms = null;
      }
      busy = false;
    }, 120);
    return () => clearTimeout(id);
  });

  const fit = $derived(
    source
      ? {
          x: source.place.x,
          y: source.place.y,
          w: source.loaded.image.width * source.place.scale,
          h: source.loaded.image.height * source.place.scale,
        }
      : { x: 0, y: 0, w: 1, h: 1 },
  );
  // tracciati mostrati e creati: quelli del ricalco o quelli modificati a mano
  const basePaths = $derived(traced ? toEdit(traced.geometry) : []);
  const shown = $derived(editor.paths ?? basePaths);
  const geometry = $derived(
    traced ? (editor.paths ? fromEdit(editor.paths, traced.geometry) : traced.geometry) : null,
  );
  // Perfeziona: costruzione (cerchi degli archi e asse) da disegnare insieme ai tracciati
  const construction = $derived(
    traced?.report && drawCons && geometry && geometry.paths.length
      ? perfectPlan(traced.report, geometryBBox(geometry.paths), drawStyle)
      : null,
  );
  $effect(() => {
    output = traced && geometry ? { ...traced, geometry, construction } : null;
  });
  // regolazioni di Perfeziona, con i valori di base se mancano
  const pOpt = (): PerfectOptions => ({ ...PERFECT_DEFAULTS, ...(options?.perfect ?? {}) });
  const setP = (patch: Partial<PerfectOptions>) => {
    if (options) options.perfect = { ...pOpt(), ...patch };
  };
  const reportLine = $derived.by(() => {
    const r = traced?.report;
    if (!r) return '';
    const parts = [
      t(lang, 'trace.p.report', { s: r.shapes, a: r.arcs, d: num(lang, r.maxDeviation, 2) }),
    ];
    if (r.symmetry)
      parts.push(t(lang, 'trace.p.symDone', { dir: t(lang, `trace.p.dir.${r.symmetry}`) }));
    else if (r.note) parts.push(t(lang, `trace.p.note.${r.note}`));
    return parts.join(' · ');
  });
  const shapes = $derived(geometry ? logoShapes(geometry) : []);
  const stats = $derived(
    geometry && ms !== null
      ? {
          paths: geometry.paths.length,
          anchors: geometry.paths.reduce((n, q) => n + q.segments.length + (q.closed ? 0 : 1), 0),
          ms,
        }
      : null,
  );

  // tasti della penna (come in Illustrator); restituisce true se il tasto è gestito
  function penKey(e: KeyboardEvent): boolean {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod && (k === 'z' || k === 'Z')) {
      if (e.shiftKey) editor.redo();
      else editor.undo();
      return true;
    }
    if (mod && (k === 'y' || k === 'Y')) {
      editor.redo();
      return true;
    }
    if (mod && (k === 'a' || k === 'A')) {
      editor.selectAll(shown);
      return true;
    }
    if (mod) return false;
    if (k === 'Delete' || k === 'Backspace') {
      editor.deleteSelected(shown);
      return true;
    }
    if (k === 'Escape') {
      editor.clearSelection();
      editor.tool = 'select';
      return true;
    }
    if (k === 'C' && e.shiftKey) {
      if (editor.selection.length) editor.toggleSelected(shown);
      else editor.tool = 'convert';
      return true;
    }
    const tools: Record<string, PenTool> = {
      v: 'select',
      V: 'select',
      p: 'add',
      '+': 'add',
      '-': 'delete',
    };
    if (tools[k]) {
      editor.tool = tools[k]!;
      return true;
    }
    const step = e.shiftKey ? 10 : 1;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (arrows[k] && editor.selection.length) {
      editor.nudge(shown, arrows[k]![0], arrows[k]![1]);
      return true;
    }
    return false;
  }
  const pxPt = $derived(source ? source.place.scale : 1);
</script>

{#if !source}
  <div class="tcol" class:wide>
    <EmptyState title={t(lang, 'trace.empty')} hint={t(lang, 'trace.emptyHint')} />
    <div class="pick"><TextButton label={pickLabel} onclick={onPick} /></div>
    {#if message}<p class="msg">{message}</p>{/if}
  </div>
{:else}
  <div class="tcol" class:wide>
    <section class="card" aria-busy={busy}>
      <div class="head">
        <span class="title">{t(lang, 'trace.preview')}</span>
        <label class="chk">
          <input type="checkbox" bind:checked={showImage} />
          {t(lang, 'trace.showImage')}
        </label>
      </div>
      <ZoomPane
        {fit}
        resetKey={source}
        labels={{
          in: t(lang, 'fix.zoom.in'),
          out: t(lang, 'fix.zoom.out'),
          fit: t(lang, 'fix.zoom.fit'),
          area: t(lang, 'trace.preview'),
        }}
        onKey={penKey}
        onBackgroundClick={() => editor.clearSelection()}
      >
        {#snippet children(ctx)}
          {#if showImage}
            <image
              href={source.loaded.url}
              x={fit.x}
              y={fit.y}
              width={fit.w}
              height={fit.h}
              opacity="0.35"
              preserveAspectRatio="none"
            />
          {/if}
          <g class="traced" class:filled={output?.style.filled}>
            {#each shapes as s (s.key)}<path d={s.d} fill-rule="evenodd" />{/each}
          </g>
          {#if construction}
            <g class="cons" stroke-width={ctx.px}>
              {#each construction.primitives as c (c.id)}
                {#if c.type === 'circle'}
                  <circle cx={c.cx} cy={c.cy} r={c.r} />
                {:else if c.type === 'line'}
                  <line class="axis" x1={c.a.x} y1={c.a.y} x2={c.b.x} y2={c.b.y} />
                {/if}
              {/each}
            </g>
          {/if}
          <PenLayer {editor} paths={shown} px={ctx.px} toUser={ctx.toUser} />
        {/snippet}
      </ZoomPane>
      <div class="pen-tools">
        <Segmented
          ariaLabel={t(lang, 'pen.aria')}
          dense
          bind:value={editor.tool}
          options={[
            { value: 'select', label: t(lang, 'pen.select') },
            { value: 'add', label: t(lang, 'pen.add') },
            { value: 'delete', label: t(lang, 'pen.delete') },
            { value: 'convert', label: t(lang, 'pen.convert') },
          ]}
        />
        <div class="undo">
          <button
            type="button"
            title="Ctrl+Z"
            disabled={!editor.canUndo}
            onclick={() => editor.undo()}>← {t(lang, 'pen.undo')} {editor.undoCount || ''}</button
          >
          <button
            type="button"
            title="Ctrl+Shift+Z"
            disabled={!editor.canRedo}
            onclick={() => editor.redo()}
            >{t(lang, 'pen.redo')}{editor.redoCount ? ` ${editor.redoCount}` : ''} →</button
          >
          <button type="button" class="reset" onclick={resetAll}>× {t(lang, 'pen.resetAll')}</button
          >
          {#if editor.selection.length}
            <button type="button" onclick={() => editor.toggleSelected(shown)}
              >{t(lang, 'pen.toggle')}</button
            >
            <button type="button" onclick={() => editor.deleteSelected(shown)}
              >{t(lang, 'pen.remove', { n: editor.selection.length })}</button
            >
          {/if}
        </div>
        <p class="hint">{t(lang, `pen.hint.${editor.tool}`)}</p>
        {#if editNote}<p class="hint">{editNote}</p>{/if}
      </div>
      <p class="summary">
        {#if stats}
          {t(lang, 'trace.stats', { p: stats.paths, a: stats.anchors, ms: stats.ms })}
          {#if reportLine}<br />{reportLine}{/if}
        {:else}
          {t(lang, 'preview.analyzing')}
        {/if}
      </p>
      <div class="pick">
        <span class="name">{source.name}</span>
        <TextButton label={pickLabel} tone="muted" onclick={onPick} />
      </div>
      {#if message}<p class="msg">{message}</p>{/if}
    </section>
  </div>

  <div class="tcol" class:wide>
    {#if options && defaults}
      <Segmented
        ariaLabel={t(lang, 'trace.mode.aria')}
        bind:value={options.mode}
        options={[
          { value: 'lines', label: t(lang, 'trace.mode.lines') },
          { value: 'shapes', label: t(lang, 'trace.mode.shapes') },
          { value: 'perfect', label: t(lang, 'trace.mode.perfect') },
        ]}
      />
      <p class="hint">
        {options.mode === 'lines'
          ? t(lang, 'trace.mode.linesHint')
          : options.mode === 'shapes'
            ? t(lang, 'trace.mode.shapesHint')
            : t(lang, 'trace.mode.perfectHint')}
      </p>
      {#if options.mode === 'perfect'}
        <Slider
          label={t(lang, 'trace.p.precision')}
          bind:value={() => pOpt().tolerance * 100, (v) => setP({ tolerance: v / 100 })}
          min={0.05}
          max={1}
          step={0.05}
          defaultValue={PERFECT_DEFAULTS.tolerance * 100}
          unit="%"
          format={(v) => `${num(lang, v, 2)} %`}
        />
        <p class="hint">{t(lang, 'trace.p.precisionHint')}</p>
        <div class="lbl">{t(lang, 'trace.p.symmetry')}</div>
        <Segmented
          ariaLabel={t(lang, 'trace.p.symmetry')}
          dense
          bind:value={() => pOpt().symmetry, (v) => setP({ symmetry: v })}
          options={[
            { value: 'auto', label: t(lang, 'trace.p.sym.auto') },
            { value: 'vertical', label: t(lang, 'trace.p.sym.vertical') },
            { value: 'horizontal', label: t(lang, 'trace.p.sym.horizontal') },
            { value: 'none', label: t(lang, 'trace.p.sym.none') },
          ]}
        />
        <Slider
          label={t(lang, 'trace.p.softness')}
          bind:value={() => pOpt().softness, (v) => setP({ softness: v })}
          min={0}
          max={1}
          step={0.01}
          defaultValue={PERFECT_DEFAULTS.softness}
          unit="%"
          format={(v) => `${Math.round(v * 100)} %`}
        />
        <Toggle
          label={t(lang, 'trace.p.construction')}
          hint={t(lang, 'trace.p.constructionHint')}
          bind:checked={drawCons}
        />
      {/if}
      {#if options.mode === 'shapes'}
        <label class="chk">
          <input
            type="checkbox"
            bind:checked={() => options!.fill !== false, (v) => (options!.fill = v)}
          />
          {t(lang, 'trace.fill')}
        </label>
        <Slider
          label={t(lang, 'trace.edge')}
          bind:value={() => options!.edge ?? 1, (v) => (options!.edge = v)}
          min={0}
          max={1}
          step={0.01}
          defaultValue={defaults.edge ?? 1}
          unit="%"
          format={(v) => `${Math.round(v * 100)} %`}
        />
        <p class="hint">{t(lang, 'trace.edge.hint')}</p>
      {/if}
      {#if options.mode !== 'perfect'}
        <Slider
          label={t(lang, 'trace.sensitivity')}
          bind:value={options.sensitivity}
          min={2}
          max={60}
          step={1}
          defaultValue={defaults.sensitivity}
          unit=""
          digits={0}
        />
        <Slider
          label={t(lang, 'trace.merge')}
          bind:value={options.merge}
          min={0}
          max={30}
          step={1}
          defaultValue={defaults.merge}
          unit="px"
          digits={0}
        />
      {/if}
      <Slider
        label={t(lang, 'trace.minArea')}
        bind:value={markSide}
        min={1}
        max={80}
        step={1}
        defaultValue={Math.round(Math.sqrt(defaults.minArea))}
        unit="px"
        digits={0}
      />
      {#if options.mode !== 'perfect'}
        <Slider
          label={t(lang, 'trace.smooth')}
          bind:value={options.smooth}
          min={0}
          max={5}
          step={0.1}
          defaultValue={defaults.smooth}
          unit="×"
          digits={1}
        />
        <Slider
          label={t(lang, 'trace.tolerance')}
          bind:value={options.tolerance}
          min={0.1}
          max={3}
          step={0.05}
          defaultValue={defaults.tolerance}
          unit="×"
          digits={2}
        />
      {/if}
      <Slider
        label={t(lang, 'trace.corner')}
        bind:value={options.cornerAngle}
        min={15}
        max={150}
        step={1}
        defaultValue={defaults.cornerAngle}
        unit="°"
        digits={0}
      />
      {#if options.mode !== 'perfect'}
        <Toggle
          label={t(lang, 'trace.perfect')}
          hint={t(lang, 'trace.perfectHint')}
          bind:checked={perfect}
        />
      {/if}
      {#if options.mode !== 'perfect'}
        <p class="hint">{t(lang, 'trace.scaleHint', { k: num(lang, pxPt, 2) })}</p>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .cons {
    fill: none;
    stroke: var(--c-text-3);
    opacity: 0.7;
  }
  .cons .axis {
    stroke: var(--c-accent);
  }
  .lbl {
    margin: 0;
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
  }
  .tcol {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }
  .tcol.wide {
    max-height: 100%;
    overflow-y: auto;
  }
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
  }
  .title {
    font: 500 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-2);
  }
  .chk {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-2);
    cursor: pointer;
  }
  .chk input {
    accent-color: var(--c-accent);
  }
  .pen-tools {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .undo {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-1);
  }
  .undo button {
    padding: 2px var(--sp-2);
    border: var(--bw) solid var(--c-border);
    border-radius: var(--r-s);
    background: transparent;
    color: var(--c-text-2);
    font: 400 var(--fs-xs) var(--f-sans);
    cursor: pointer;
  }
  .undo button:hover:not(:disabled) {
    color: var(--c-text);
    border-color: var(--c-accent);
  }
  .undo .reset {
    margin-left: auto;
  }
  .undo button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .traced path {
    fill: none;
    stroke: var(--c-accent);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .traced.filled path {
    fill: var(--c-preview-logo);
    fill-opacity: 0.75;
  }
  .summary {
    text-align: center;
    font: 400 var(--fs-s) / var(--lh-text) var(--f-mono);
    color: var(--c-text-2);
  }
  .pick {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 400 var(--fs-xs) var(--f-mono);
    color: var(--c-text-3);
  }
  .hint,
  .msg {
    font: 400 var(--fs-xs) / var(--lh-text) var(--f-sans);
    color: var(--c-text-3);
  }
  .msg {
    color: var(--c-warn);
  }
</style>
