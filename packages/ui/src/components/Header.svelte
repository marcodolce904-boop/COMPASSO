<script lang="ts">
  import Icon from './Icon.svelte';
  let {
    name,
    version,
    settingsLabel,
    settingsOpen = false,
    onSettings,
  }: {
    name: string;
    version: string;
    settingsLabel: string;
    settingsOpen?: boolean;
    onSettings: () => void;
  } = $props();
</script>

<header class="hdr">
  <div class="brand"><span class="name">{name}</span><span class="ver">{version}</span></div>
  <button
    class="icon-btn"
    class:on={settingsOpen}
    aria-label={settingsLabel}
    aria-expanded={settingsOpen}
    onclick={onSettings}
  >
    <Icon name="gear" size={16} />
  </button>
</header>

<style>
  .hdr {
    height: var(--h-header);
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--sp-3);
    border-bottom: var(--bw) solid var(--c-border);
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
  }
  .name {
    font: 700 var(--fs-s) var(--f-mono);
    letter-spacing: var(--ls-caps);
    color: var(--c-text);
  }
  .ver {
    font: 400 var(--fs-xs) var(--f-mono);
    color: var(--c-text-3);
  }
  .icon-btn {
    display: flex;
    padding: var(--sp-1);
    border-radius: var(--r-s);
    color: var(--c-text-2);
    transition:
      color var(--t-fast),
      background var(--t-fast);
  }
  .icon-btn:hover,
  .icon-btn.on {
    color: var(--c-text);
    background: var(--c-bg-raised);
  }
</style>
