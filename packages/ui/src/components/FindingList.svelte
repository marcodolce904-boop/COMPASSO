<script lang="ts">
  import type { Finding } from '@compasso/core';
  import Icon from './Icon.svelte';

  let {
    findings,
    selected = $bindable(null),
    message,
    delta,
    severityLabel,
    emptyText,
    hint,
  }: {
    findings: Finding[];
    selected?: string | null;
    message: (f: Finding) => string;
    delta: (f: Finding) => string;
    severityLabel: (s: Finding['severity']) => string;
    emptyText: string;
    hint: string;
  } = $props();
</script>

{#if findings.length === 0}
  <p class="none">{emptyText}</p>
{:else}
  <ul class="list">
    {#each findings as f (f.id)}
      <li>
        <button
          class="fd"
          class:hl={selected === f.id}
          aria-pressed={selected === f.id}
          onclick={() => (selected = selected === f.id ? null : f.id)}
        >
          <span class="sev {f.severity}" role="img" aria-label={severityLabel(f.severity)}>
            <Icon name={f.severity === 'warn' ? 'warn' : 'info'} />
          </span>
          <span class="msg">{message(f)}</span>
          <span class="d">{delta(f)}</span>
        </button>
      </li>
    {/each}
  </ul>
  <p class="hint">{hint}</p>
{/if}

<style>
  .list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .fd {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-1);
    border-radius: var(--r-s);
    text-align: left;
    transition: background var(--t-fast);
  }
  .fd:hover {
    background: var(--c-bg-raised);
  }
  .fd.hl {
    background: var(--c-accent-dim);
  }
  .sev {
    display: flex;
    flex: none;
  }
  .sev.warn {
    color: var(--c-warn);
  }
  .sev.info {
    color: var(--c-text-2);
  }
  .msg {
    flex: 1;
    font: 400 var(--fs-s) / var(--lh-text) var(--f-sans);
    color: var(--c-text);
  }
  .d {
    flex: none;
    font: 500 var(--fs-s) var(--f-mono);
    color: var(--c-text-2);
    white-space: nowrap;
  }
  .none {
    padding: var(--sp-3) var(--sp-1);
    font: 500 var(--fs-s) var(--f-sans);
    color: var(--c-ok);
  }
  .hint {
    padding: var(--sp-1);
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
  }
</style>
