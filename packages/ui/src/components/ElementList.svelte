<script lang="ts">
  import type { ElementGroups, ElementItem } from '../labels';
  import Icon from './Icon.svelte';

  let {
    title,
    groups,
    groupLabels,
    visible,
    open = $bindable(false),
    hoverId = $bindable(null),
    showLabel,
    hideLabel,
    onToggle,
  }: {
    title: string;
    groups: ElementGroups;
    groupLabels: Record<keyof ElementGroups, string>;
    visible: Set<string>;
    open?: boolean;
    hoverId?: string | null;
    showLabel: (name: string) => string;
    hideLabel: (name: string) => string;
    onToggle: (id: string) => void;
  } = $props();
  const order: (keyof ElementGroups)[] = ['circles', 'lines', 'axes', 'rows'];
  const uid = $props.id();
</script>

<div class="wrap">
  <button
    class="acc"
    class:open
    aria-expanded={open}
    aria-controls={uid}
    onclick={() => (open = !open)}
  >
    <Icon name="chevron" size={12} />
    <span>{title}</span>
  </button>
  {#if open}
    <div id={uid} class="list">
      {#each order as g (g)}
        {#if groups[g].length}
          <p class="grp">{groupLabels[g]}</p>
          <ul>
            {#each groups[g] as item (item.id)}
              {@render row(item)}
            {/each}
          </ul>
        {/if}
      {/each}
    </div>
  {/if}
</div>

{#snippet row(item: ElementItem)}
  {@const on = visible.has(item.id)}
  <li
    class="it"
    class:hl={hoverId === item.id}
    class:off={!on}
    onmouseenter={() => (hoverId = item.id)}
    onmouseleave={() => (hoverId = null)}
  >
    <button
      class="eye"
      aria-pressed={on}
      aria-label={on ? hideLabel(item.name) : showLabel(item.name)}
      onclick={() => onToggle(item.id)}
      onfocus={() => (hoverId = item.id)}
      onblur={() => (hoverId = null)}
    >
      <Icon name={on ? 'eye' : 'eye-off'} />
    </button>
    <span class="nm">{item.name}</span>
    <span class="bar" aria-hidden="true"><i style="width:{Math.round(item.score * 100)}%"></i></span
    >
  </li>
{/snippet}

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: none;
  }
  .acc {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    padding: var(--sp-1) 0;
    font: 500 var(--fs-s) var(--f-sans);
    color: var(--c-text-2);
  }
  .acc :global(svg) {
    transition: transform var(--t-fast);
  }
  .acc.open :global(svg) {
    transform: rotate(90deg);
  }
  .acc:hover {
    color: var(--c-text);
  }
  .grp {
    padding: var(--sp-2) 0 var(--sp-1);
    font: 700 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-3);
  }
  ul {
    list-style: none;
  }
  .it {
    height: var(--h-row);
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-1);
    border-radius: var(--r-s);
    font: 400 var(--fs-s) var(--f-sans);
    color: var(--c-text);
  }
  .it.hl {
    background: var(--c-accent-dim);
  }
  .it.off .nm {
    color: var(--c-text-3);
  }
  .eye {
    display: flex;
    color: var(--c-text-2);
  }
  .it.hl .eye {
    color: var(--c-accent);
  }
  .it.off .eye {
    color: var(--c-text-3);
  }
  .nm {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar {
    position: relative;
    width: var(--w-score);
    height: var(--h-score);
    border-radius: var(--h-score);
    background: var(--c-bg-raised);
    overflow: hidden;
  }
  .bar i {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--c-text-2);
  }
</style>
