<script lang="ts">
  let {
    label,
    tone = 'accent',
    onclick,
    disabled = false,
  }: {
    label: string;
    tone?: 'accent' | 'muted';
    onclick: () => void;
    disabled?: boolean;
  } = $props();
</script>

<button class="tbtn {tone}" {onclick} {disabled}>{label}</button>

<style>
  .tbtn {
    font: 500 var(--fs-s) var(--f-sans);
    padding: var(--sp-1) 0;
    transition: color var(--t-fast);
  }
  .accent {
    color: var(--c-accent);
  }
  .muted {
    color: var(--c-text-2);
  }
  .tbtn:disabled {
    color: var(--c-text-3);
    cursor: default;
  }
  .tbtn:hover:not(:disabled) {
    color: var(--c-text);
  }
</style>
