<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    label,
    hint = '',
    checked = $bindable(),
    badge = 0,
    children,
  }: {
    label: string;
    hint?: string;
    checked: boolean;
    badge?: number;
    children?: Snippet;
  } = $props();
  const uid = $props.id();
</script>

<div class="tg" class:on={checked}>
  <div class="row">
    <button
      id={uid}
      class="sw"
      role="switch"
      aria-checked={checked}
      aria-labelledby={uid + '-l'}
      aria-describedby={hint ? uid + '-h' : undefined}
      onclick={() => (checked = !checked)}
    >
      <span class="knob"></span>
    </button>
    <label id={uid + '-l'} for={uid}>{label}</label>
    {#if checked && badge > 0}<span class="badge">{badge}</span>{/if}
  </div>
  {#if hint}<p id={uid + '-h'} class="hint">{hint}</p>{/if}
  {#if checked && children}<div class="body">{@render children()}</div>{/if}
</div>

<style>
  .tg {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding: var(--sp-2) 0;
    border-bottom: var(--bw) solid var(--c-border);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  label {
    flex: 1;
    font: 500 var(--fs-m) var(--f-sans);
    color: var(--c-text-2);
    cursor: pointer;
  }
  .on label {
    color: var(--c-text);
  }
  .sw {
    flex: none;
    position: relative;
    width: calc(var(--sz-icon) * 2);
    height: var(--sz-icon);
    border-radius: var(--sz-icon);
    background: var(--c-bg-raised);
    box-shadow: inset 0 0 0 var(--bw) var(--c-border-strong);
    transition: background var(--t-fast);
  }
  .knob {
    position: absolute;
    top: var(--sp-half);
    left: var(--sp-half);
    width: calc(var(--sz-icon) - 2 * var(--sp-half));
    height: calc(var(--sz-icon) - 2 * var(--sp-half));
    border-radius: 50%;
    background: var(--c-text-2);
    transition:
      left var(--t-fast),
      background var(--t-fast);
  }
  .on .sw {
    background: var(--c-accent);
    box-shadow: none;
  }
  .on .knob {
    left: calc(var(--sz-icon) + var(--sp-half));
    background: var(--c-on-accent);
  }
  .badge {
    font: 700 var(--fs-xs) var(--f-mono);
    padding: 0 var(--sp-1);
    border-radius: var(--r-pill);
    background: var(--c-accent-dim);
    color: var(--c-accent);
  }
  .hint {
    padding-left: calc(var(--sz-icon) * 2 + var(--sp-2));
    font: 400 var(--fs-xs) / var(--lh-text) var(--f-sans);
    color: var(--c-text-3);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding-left: calc(var(--sz-icon) * 2 + var(--sp-2));
  }
  @media (prefers-reduced-motion: reduce) {
    .sw,
    .knob {
      transition: none;
    }
  }
</style>
