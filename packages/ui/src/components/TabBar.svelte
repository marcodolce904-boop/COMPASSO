<script lang="ts">
  export interface Tab {
    value: string;
    label: string;
  }
  let { tabs, value = $bindable() }: { tabs: Tab[]; value: string } = $props();
  const index = $derived(
    Math.max(
      0,
      tabs.findIndex((t) => t.value === value),
    ),
  );
</script>

<div class="tabs" role="tablist" style="--n:{tabs.length}; --i:{index}">
  {#each tabs as tab (tab.value)}
    <button
      role="tab"
      class="tab"
      class:on={tab.value === value}
      aria-selected={tab.value === value}
      onclick={() => (value = tab.value)}>{tab.label}</button
    >
  {/each}
  <span class="underline" aria-hidden="true"></span>
</div>

<style>
  .tabs {
    position: relative;
    height: var(--h-tab);
    flex: none;
    display: flex;
    border-bottom: var(--bw) solid var(--c-border);
  }
  .tab {
    flex: 1;
    font: 500 var(--fs-xs) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text-3);
    transition: color var(--t-fast);
  }
  .tab:hover {
    color: var(--c-text-2);
  }
  .tab.on {
    color: var(--c-text);
  }
  .underline {
    position: absolute;
    bottom: calc(-1 * var(--bw));
    height: var(--h-underline);
    width: calc(100% / var(--n) * 0.56);
    left: calc(100% / var(--n) * (var(--i) + 0.22));
    background: var(--c-accent);
    transition: left var(--t-fast);
  }
</style>
