<script lang="ts">
  let {
    label,
    tone = 'accent',
    onclick,
  }: { label: string; tone?: 'accent' | 'muted'; onclick: () => void } = $props();
</script>

<button class="tbtn {tone}" {onclick}>{label}</button>

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
  .tbtn:hover {
    color: var(--c-text);
  }
</style>
