<script lang="ts">
  let {
    label,
    disabled = false,
    loading = false,
    onclick,
  }: { label: string; disabled?: boolean; loading?: boolean; onclick: () => void } = $props();
</script>

<button class="pbtn" class:loading disabled={disabled || loading} aria-busy={loading} {onclick}>
  {label}
</button>

<style>
  .pbtn {
    flex: 1;
    height: var(--h-btn);
    border-radius: var(--r-s);
    background: var(--c-accent);
    color: var(--c-on-accent);
    font: 700 var(--fs-s) var(--f-mono);
    letter-spacing: var(--ls-caps);
    transition:
      filter var(--t-fast),
      background var(--t-fast);
  }
  .pbtn:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .pbtn:active:not(:disabled) {
    filter: brightness(0.92);
  }
  .pbtn:disabled {
    background: var(--c-bg-raised);
    color: var(--c-text-3);
    cursor: default;
  }
  .pbtn.loading {
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pbtn.loading {
      animation: none;
    }
  }
</style>
