<script lang="ts">
  // Regolazioni di GENERA: comuni (intensità, scarto massimo) e per modalità (tendine chiuse di base).
  import type { GenerateOptions } from '@compasso/core';
  import { num, t, type Lang } from '../strings';
  import Slider from './Slider.svelte';
  import Segmented from './Segmented.svelte';
  import TextButton from './TextButton.svelte';

  let {
    options = $bindable(),
    defaults,
    D,
    lang,
    onReset,
  }: {
    options: GenerateOptions;
    defaults: GenerateOptions;
    /** Diagonale del logo (pt). */
    D: number;
    lang: Lang;
    onReset: () => void;
  } = $props();

  const pct = (v: number) => `${Math.round(v * 100)} %`;
  // scarto massimo mostrato in % della diagonale (da 0,5% a 10%)
  let devPct = $derived(Math.round((options.maxDeviation / D) * 1000) / 10);
  const setDev = (v: number) => (options.maxDeviation = Math.round(((v * D) / 100) * 100) / 100);
  const angle = $derived(String(options.math.angle));
  let autoModule = $derived(options.math.module === null);
  let anchorsOn = $derived(options.minimal.maxAnchors !== null);
</script>

<div class="sect"><b>{t(lang, 'gen.common')}</b></div>
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
<Slider
  label={t(lang, 'gen.maxDeviation')}
  bind:value={() => devPct, setDev}
  min={0.5}
  max={10}
  step={0.1}
  defaultValue={Math.round((defaults.maxDeviation / D) * 1000) / 10}
  unit="%"
  format={(v) => `${num(lang, v, 1)} %`}
/>
<p class="hint">{t(lang, 'gen.maxDeviation.hint')}</p>

<details class="dd">
  <summary>{t(lang, 'gen.symmetric.params')}</summary>
  <div class="lbl">{t(lang, 'gen.symmetric.axis')}</div>
  <Segmented
    ariaLabel={t(lang, 'gen.symmetric.axis')}
    bind:value={options.symmetric.axis}
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
    bind:value={options.symmetric.keep}
    dense
    options={[
      { value: 'auto', label: t(lang, 'fix.axis.auto') },
      { value: 'left', label: t(lang, 'fix.keep.left') },
      { value: 'right', label: t(lang, 'fix.keep.right') },
      { value: 'top', label: t(lang, 'fix.keep.top') },
      { value: 'bottom', label: t(lang, 'fix.keep.bottom') },
    ]}
  />
</details>

<details class="dd">
  <summary>{t(lang, 'gen.math.params')}</summary>
  <div class="lbl">{t(lang, 'gen.math.angle')}</div>
  <Segmented
    ariaLabel={t(lang, 'gen.math.angle')}
    bind:value={() => angle, (v: string) => (options.math.angle = Number(v))}
    dense
    options={[
      { value: '15', label: '15°' },
      { value: '30', label: '30°' },
      { value: '45', label: '45°' },
      { value: '90', label: '90°' },
    ]}
  />
  <label class="chk">
    <input
      type="checkbox"
      checked={autoModule}
      onchange={(e) =>
        (options.math.module = e.currentTarget.checked ? null : Math.max(1, Math.round(D / 24)))}
    />
    {t(lang, 'gen.math.autoModule')}
  </label>
  {#if options.math.module !== null}
    <Slider
      label={t(lang, 'gen.math.module')}
      bind:value={() => options.math.module ?? 1, (v: number) => (options.math.module = v)}
      min={0.5}
      max={Math.max(10, Math.round(D / 6))}
      step={0.5}
      defaultValue={Math.max(1, Math.round(D / 24))}
      unit="pt"
      format={(v) => `${num(lang, v, 1)} pt`}
    />
  {/if}
  <label class="chk">
    <input type="checkbox" bind:checked={options.math.half} />
    {t(lang, 'gen.math.half')}
  </label>
  <label class="chk">
    <input type="checkbox" bind:checked={options.math.rules.angles} />
    {t(lang, 'gen.math.rule.angles')}
  </label>
  <label class="chk">
    <input type="checkbox" bind:checked={options.math.rules.radii} />
    {t(lang, 'gen.math.rule.radii')}
  </label>
  <label class="chk">
    <input type="checkbox" bind:checked={options.math.rules.positions} />
    {t(lang, 'gen.math.rule.positions')}
  </label>
</details>

<details class="dd">
  <summary>{t(lang, 'gen.minimal.params')}</summary>
  <div class="lbl">{t(lang, 'gen.minimal.level')}</div>
  <Segmented
    ariaLabel={t(lang, 'gen.minimal.level')}
    bind:value={options.minimal.level}
    dense
    options={[
      { value: 'light', label: t(lang, 'gen.minimal.light') },
      { value: 'medium', label: t(lang, 'gen.minimal.medium') },
      { value: 'strong', label: t(lang, 'gen.minimal.strong') },
    ]}
  />
  <label class="chk">
    <input
      type="checkbox"
      checked={anchorsOn}
      onchange={(e) => (options.minimal.maxAnchors = e.currentTarget.checked ? 12 : null)}
    />
    {t(lang, 'gen.minimal.maxAnchors')}
  </label>
  {#if options.minimal.maxAnchors !== null}
    <Slider
      label={t(lang, 'gen.minimal.anchors')}
      bind:value={
        () => options.minimal.maxAnchors ?? 12, (v: number) => (options.minimal.maxAnchors = v)
      }
      min={3}
      max={200}
      step={1}
      defaultValue={12}
      unit=""
      format={(v) => String(Math.round(v))}
    />
  {/if}
</details>

<div class="reset">
  <TextButton label={t(lang, 'fix.defaults')} tone="muted" onclick={onReset} />
</div>

<style>
  .sect b {
    font: 700 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-2);
  }
  .hint,
  .lbl {
    margin: 0;
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
  }
  .dd {
    border-top: 1px solid var(--c-border);
    padding-top: var(--sp-2);
  }
  .dd > :global(*:not(summary)) {
    margin-top: var(--sp-2);
  }
  summary {
    cursor: pointer;
    font: 500 var(--fs-s) var(--f-sans);
    color: var(--c-text);
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
</style>
