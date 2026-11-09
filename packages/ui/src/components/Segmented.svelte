<script lang="ts">
  import { tick } from 'svelte';
  export interface SegOption {
    value: string;
    label: string;
    badge?: number;
  }
  let {
    options,
    value = $bindable(),
    ariaLabel,
    dense = false,
  }: { options: SegOption[]; value: string; ariaLabel: string; dense?: boolean } = $props();
  const buttons: HTMLButtonElement[] = $state([]);

  async function onKey(e: KeyboardEvent) {
    const i = options.findIndex((o) => o.value === value);
    let j: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      j = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = options.length - 1;
    else return;
    e.preventDefault();
    value = options[j]!.value;
    await tick();
    buttons[j]?.focus();
  }
</script>

<div
  class="seg"
  class:dense
  role="radiogroup"
  aria-label={ariaLabel}
  tabindex="-1"
  onkeydown={onKey}
>
  {#each options as o, i (o.value)}
    <button
      bind:this={buttons[i]}
      role="radio"
      aria-checked={o.value === value}
      tabindex={o.value === value ? 0 : -1}
      class:on={o.value === value}
      onclick={() => (value = o.value)}
    >
      <span>{o.label}</span>
      {#if o.badge}<span class="badge">{o.badge}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: flex;
    flex: none;
    border: var(--bw) solid var(--c-border);
    border-radius: var(--r-s);
    overflow: hidden;
  }
  button {
    flex: 1;
    min-width: 0;
    height: var(--h-seg);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-1);
    font: 500 var(--fs-s) var(--f-sans);
    color: var(--c-text-2);
    border-right: var(--bw) solid var(--c-border);
    transition:
      color var(--t-fast),
      background var(--t-fast);
  }
  .dense button {
    font-size: var(--fs-xs);
  }
  button:last-child {
    border-right: none;
  }
  button:hover {
    color: var(--c-text);
  }
  button.on {
    background: var(--c-bg-raised);
    color: var(--c-text);
    box-shadow: inset 0 0 0 var(--bw) var(--c-border-strong);
  }
  .badge {
    font: 700 var(--fs-xs) var(--f-mono);
    padding: 0 var(--sp-1);
    border-radius: var(--r-pill);
    background: var(--c-warn);
    color: var(--c-on-warn);
  }
</style>
