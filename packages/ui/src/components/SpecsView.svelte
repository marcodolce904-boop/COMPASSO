<script lang="ts">
  import type { AnalysisResult } from '@compasso/core';
  import { ratioText, specsText } from '../preview';
  import { num, t, type Lang, type StringKey } from '../strings';
  import Slider from './Slider.svelte';
  import TextButton from './TextButton.svelte';
  import Icon from './Icon.svelte';

  let {
    result,
    lang,
    clearspace = $bindable(),
  }: {
    result: AnalysisResult;
    lang: Lang;
    clearspace: { enabled: boolean; multiplier: number };
  } = $props();
  const s = $derived(result.specs);
  let copied = $state(false);
  const uid = $props.id();

  async function copy() {
    try {
      await navigator.clipboard.writeText(specsText(lang, result, clearspace.multiplier));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch (e) {
      console.error('[compasso] copia negli appunti non riuscita', e);
    }
  }
</script>

<dl class="specs">
  <div class="kv">
    <dt>{t(lang, 'specs.unitX')}</dt>
    <dd>
      {#if s.unitX === null}
        <span class="muted">{t(lang, 'specs.unitXUnknown')}</span>
      {:else}
        <span class="mono">{s.unitX.toFixed(2)} pt</span>
        <span class="pill {s.unitXConfidence}"
          >{t(lang, `specs.confidence.${s.unitXConfidence}`)}</span
        >
      {/if}
    </dd>
  </div>
  {#if s.unitX !== null && s.unitXConfidence === 'low'}
    <p class="note">{t(lang, 'specs.unitXUnknown')}</p>
  {/if}
  <div class="kv">
    <dt>{t(lang, 'specs.bbox')}</dt>
    <dd class="mono">
      {s.bbox.width.toFixed(1)} × {s.bbox.height.toFixed(1)} pt · {ratioText(lang, s.bbox)}
    </dd>
  </div>
  <div class="kv">
    <dt>{t(lang, 'specs.radii')}</dt>
    <dd class="mono">
      {s.radii.length
        ? s.radii.map((r) => r.toFixed(1)).join(' · ') + ' pt'
        : t(lang, 'specs.noRadii')}
    </dd>
  </div>
  {#if s.notableRatios.length}
    <div class="kv col">
      <dt>{t(lang, 'specs.ratios')}</dt>
      {#each s.notableRatios as q (q.a + q.b)}
        <dd class="mono ratio">
          <span>{q.a} : {q.b}</span>
          <span>
            {q.ratio.toFixed(3)}
            {#if q.name}<b>{t(lang, `ratio.${q.name}` as StringKey)}</b>{/if}
          </span>
        </dd>
      {/each}
    </div>
  {/if}
</dl>

{#if s.unitX !== null}
  <div class="sect">
    <b>{t(lang, 'specs.clearspace')}</b><span>{t(lang, 'specs.clearspaceUnit')}</span>
  </div>
  <Slider
    label={t(lang, 'specs.multiplier')}
    bind:value={clearspace.multiplier}
    min={0.5}
    max={3}
    step={0.1}
    defaultValue={1}
    unit="x"
    digits={1}
  />
  <label class="chk" for={uid}>
    <input id={uid} type="checkbox" bind:checked={clearspace.enabled} />
    <span class="box" aria-hidden="true"
      >{#if clearspace.enabled}<Icon name="check" size={10} />{/if}</span
    >
    {t(lang, 'specs.drawClearspace')}
  </label>
  <p class="mono muted small">
    {num(lang, clearspace.multiplier, 1)} x = {(clearspace.multiplier * s.unitX).toFixed(2)} pt
  </p>
{/if}
<div>
  <TextButton label={copied ? t(lang, 'specs.copied') : t(lang, 'specs.copy')} onclick={copy} />
</div>

<style>
  .specs {
    display: flex;
    flex-direction: column;
  }
  .kv {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) 0;
    border-bottom: var(--bw) solid var(--c-border);
    font: 400 var(--fs-s) var(--f-sans);
  }
  .kv.col {
    flex-direction: column;
    align-items: stretch;
  }
  dt {
    color: var(--c-text-2);
  }
  dd {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    color: var(--c-text);
    text-align: right;
  }
  .ratio {
    justify-content: space-between;
  }
  .ratio b {
    margin-left: var(--sp-1);
    font-weight: 500;
    color: var(--c-accent);
  }
  .mono {
    font: 500 var(--fs-s) var(--f-mono);
  }
  .muted {
    color: var(--c-text-2);
  }
  .small {
    font-size: var(--fs-xs);
  }
  .note {
    padding-top: var(--sp-1);
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-warn);
  }
  .pill {
    font: 700 var(--fs-2xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    padding: var(--sp-half) var(--sp-1);
    border-radius: var(--r-pill);
    background: var(--c-ok-dim);
    color: var(--c-ok);
  }
  .pill.medium {
    background: var(--c-bg-raised);
    color: var(--c-warn);
  }
  .pill.low {
    background: var(--c-bg-raised);
    color: var(--c-text-3);
  }
  .sect {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
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
    color: var(--c-text);
    cursor: pointer;
  }
  .chk input {
    position: absolute;
    opacity: 0;
    width: var(--bw);
    height: var(--bw);
  }
  .box {
    width: var(--sz-icon);
    height: var(--sz-icon);
    border-radius: var(--r-check);
    border: var(--bw) solid var(--c-border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-on-accent);
  }
  .chk input:checked + .box {
    background: var(--c-accent);
    border-color: var(--c-accent);
  }
  .chk input:focus-visible + .box {
    outline: var(--sz-focus) solid var(--c-accent);
    outline-offset: var(--bw);
  }
</style>
