<script lang="ts">
  let {
    message,
    tone = 'danger',
    dismissLabel,
    onDismiss,
  }: {
    message: string;
    tone?: 'danger' | 'warn';
    dismissLabel: string;
    onDismiss: () => void;
  } = $props();
</script>

<div class="toast {tone}" role="alert">
  <span>{message}</span>
  <button onclick={onDismiss} aria-label={dismissLabel}>×</button>
</div>

<style>
  .toast {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--r-s);
    background: var(--c-bg-raised);
    border-left: var(--sz-focus) solid var(--c-danger);
    font: 400 var(--fs-s) / var(--lh-text) var(--f-sans);
    color: var(--c-text);
  }
  .toast.warn {
    border-left-color: var(--c-warn);
  }
  span {
    flex: 1;
  }
  button {
    color: var(--c-text-2);
    font: 400 var(--fs-l) var(--f-sans);
    line-height: 1;
  }
</style>
