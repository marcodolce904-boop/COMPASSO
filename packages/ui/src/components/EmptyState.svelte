<script lang="ts">
  let { title, hint = '' }: { title: string; hint?: string } = $props();
</script>

<div class="empty">
  <p class="title">{title}</p>
  {#if hint}<p class="hint">{hint}</p>{/if}
</div>

<style>
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    padding: var(--sp-4);
    text-align: center;
  }
  .title {
    font: 500 var(--fs-m) var(--f-sans);
    color: var(--c-text);
  }
  .hint {
    font: 400 var(--fs-s) / var(--lh-text) var(--f-sans);
    color: var(--c-text-2);
  }
</style>
