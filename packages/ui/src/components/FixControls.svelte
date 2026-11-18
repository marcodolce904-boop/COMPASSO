<script lang="ts">
  import type { RefineOptions, RefineReport } from '@compasso/core';
  import { num, t, type Lang } from '../strings';
  import Slider from './Slider.svelte';
  import Toggle from './Toggle.svelte';
  import Segmented from './Segmented.svelte';
  import TextButton from './TextButton.svelte';

  let {
    options = $bindable(),
    defaults,
    D,
    report,
    lang,
    onReset,
  }: {
    options: RefineOptions;
    defaults: RefineOptions;
    /** Diagonale del logo (pt): fissa gli estremi delle barre di tolleranza. */
    D: number;
    report: RefineReport | null;
    lang: Lang;
    onReset: () => void;
  } = $props();

  // estremi delle barre in proporzione al logo (passo arrotondato e leggibile)
  const step = $derived(Math.max(0.01, Math.round(D * 0.0005 * 100) / 100));
  const maxPt = (f: number) => Math.max(step * 10, Math.round(D * f * 100) / 100);
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const pt = (v: number) => `${num(lang, v, 2)} pt`;
  const deg = (v: number) => `${num(lang, v, 1)}°`;
</script>

<div class="sect"><b>{t(lang, 'fix.global')}</b></div>
<Slider
  label={t(lang, 'fix.strength')}
  bind:value={options.strength}
  min={0}
  max={1}
  step={0.01}
  defaultValue={defaults.strength}
  unit="%"
  format={pct}
/>

<div class="sect"><b>{t(lang, 'fix.corrections')}</b><span>{t(lang, 'display.reset')}</span></div>

<Toggle
  label={t(lang, 'fix.arcs')}
  hint={t(lang, 'fix.arcs.hint')}
  bind:checked={options.arcs.enabled}
  badge={report?.arcs ?? 0}
>
  <Slider
    label={t(lang, 'fix.tolerance')}
    bind:value={options.arcs.tolerance}
    min={step}
    max={maxPt(0.03)}
    {step}
    defaultValue={defaults.arcs.tolerance}
    unit="pt"
    format={pt}
  />
</Toggle>

<Toggle
  label={t(lang, 'fix.ellipses')}
  hint={t(lang, 'fix.ellipses.hint')}
  bind:checked={options.ellipses.enabled}
  badge={report?.ellipses ?? 0}
>
  <Slider
    label={t(lang, 'fix.tolerance')}
    bind:value={options.ellipses.tolerance}
    min={step}
    max={maxPt(0.03)}
    {step}
    defaultValue={defaults.ellipses.tolerance}
    unit="pt"
    format={pt}
  />
  <label class="chk">
    <input type="checkbox" bind:checked={options.ellipses.toCircle} />
    {t(lang, 'fix.ellipses.toCircle')}
  </label>
</Toggle>

<Toggle
  label={t(lang, 'fix.radii')}
  hint={t(lang, 'fix.radii.hint')}
  bind:checked={options.radii.enabled}
  badge={report?.radii ?? 0}
>
  <Slider
    label={t(lang, 'fix.tolerance')}
    bind:value={options.radii.tolerance}
    min={step}
    max={maxPt(0.04)}
    {step}
    defaultValue={defaults.radii.tolerance}
    unit="pt"
    format={pt}
  />
</Toggle>

<Toggle
  label={t(lang, 'fix.centers')}
  hint={t(lang, 'fix.centers.hint')}
  bind:checked={options.centers.enabled}
  badge={report?.centers ?? 0}
>
  <Slider
    label={t(lang, 'fix.tolerance')}
    bind:value={options.centers.tolerance}
    min={step}
    max={maxPt(0.04)}
    {step}
    defaultValue={defaults.centers.tolerance}
    unit="pt"
    format={pt}
  />
</Toggle>

<Toggle
  label={t(lang, 'fix.lines')}
  hint={t(lang, 'fix.lines.hint')}
  bind:checked={options.lines.enabled}
  badge={report?.lines ?? 0}
>
  <Slider
    label={t(lang, 'fix.angle')}
    bind:value={options.lines.angle}
    min={0.1}
    max={10}
    step={0.1}
    defaultValue={defaults.lines.angle}
    unit="°"
    format={deg}
  />
</Toggle>

<Toggle
  label={t(lang, 'fix.align')}
  hint={t(lang, 'fix.align.hint')}
  bind:checked={options.align.enabled}
  badge={report?.aligned ?? 0}
>
  <Slider
    label={t(lang, 'fix.tolerance')}
    bind:value={options.align.tolerance}
    min={step}
    max={maxPt(0.02)}
    {step}
    defaultValue={defaults.align.tolerance}
    unit="pt"
    format={pt}
  />
</Toggle>

<Toggle
  label={t(lang, 'fix.symmetry')}
  hint={t(lang, 'fix.symmetry.hint')}
  bind:checked={options.symmetry.enabled}
  badge={report?.symmetric ?? 0}
>
  <Segmented
    ariaLabel={t(lang, 'fix.axis.aria')}
    bind:value={options.symmetry.axis}
    dense
    options={[
      { value: 'auto', label: t(lang, 'fix.axis.auto') },
      { value: 'vertical', label: t(lang, 'fix.axis.vertical') },
      { value: 'horizontal', label: t(lang, 'fix.axis.horizontal') },
    ]}
  />
  <div class="lbl">{t(lang, 'fix.keep')}</div>
  <Segmented
    ariaLabel={t(lang, 'fix.keep')}
    bind:value={options.symmetry.keep}
    dense
    options={[
      { value: 'auto', label: t(lang, 'fix.axis.auto') },
      { value: 'left', label: t(lang, 'fix.keep.left') },
      { value: 'right', label: t(lang, 'fix.keep.right') },
      { value: 'top', label: t(lang, 'fix.keep.top') },
      { value: 'bottom', label: t(lang, 'fix.keep.bottom') },
    ]}
  />
  <Slider
    label={t(lang, 'fix.tolerance')}
    bind:value={options.symmetry.tolerance}
    min={step}
    max={maxPt(0.05)}
    {step}
    defaultValue={defaults.symmetry.tolerance}
    unit="pt"
    format={pt}
  />
  {#if options.symmetry.enabled && report?.symmetryNote}
    <p class="note">{t(lang, `fix.symmetry.note.${report.symmetryNote}`)}</p>
  {:else if options.symmetry.enabled && report?.symmetryMethod === 'shape'}
    <p class="note ok">{t(lang, 'fix.symmetry.note.shape')}</p>
  {/if}
</Toggle>

<Toggle
  label={t(lang, 'fix.smooth')}
  hint={t(lang, 'fix.smooth.hint')}
  bind:checked={options.smooth.enabled}
  badge={report?.smoothed ?? 0}
>
  <Slider
    label={t(lang, 'fix.angle')}
    bind:value={options.smooth.angle}
    min={1}
    max={30}
    step={1}
    defaultValue={defaults.smooth.angle}
    unit="°"
    format={deg}
  />
</Toggle>

<Toggle
  label={t(lang, 'fix.grid')}
  hint={t(lang, 'fix.grid.hint')}
  bind:checked={options.grid.enabled}
  badge={report?.gridded ?? 0}
>
  <Slider
    label={t(lang, 'fix.step')}
    bind:value={options.grid.step}
    min={0.1}
    max={Math.max(10, Math.round(D / 20))}
    step={0.1}
    defaultValue={defaults.grid.step}
    unit="pt"
    format={pt}
  />
  <label class="chk">
    <input type="checkbox" bind:checked={options.grid.radii} />
    {t(lang, 'fix.gridRadii')}
  </label>
</Toggle>

<Toggle
  label={t(lang, 'fix.clean')}
  hint={t(lang, 'fix.clean.hint')}
  bind:checked={options.clean.enabled}
  badge={report?.removedAnchors ?? 0}
/>

<div class="reset">
  <TextButton label={t(lang, 'fix.defaults')} tone="muted" onclick={onReset} />
</div>

<style>
  .sect {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-top: var(--sp-1);
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
  .chk {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font: 400 var(--fs-s) var(--f-sans);
    color: var(--c-text-2);
    cursor: pointer;
  }
  .chk input {
    accent-color: var(--c-accent);
  }
  .reset {
    padding-top: var(--sp-1);
  }
  .lbl {
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
  }
  .note {
    margin: 0;
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-warn, var(--c-text-2));
  }
  .note.ok {
    color: var(--c-text-3);
  }
</style>
