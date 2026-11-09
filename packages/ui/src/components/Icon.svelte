<script lang="ts">
  // Icone proprie, disegnate a tratto. Colore: currentColor (dal token del contenitore).
  type Name = 'gear' | 'eye' | 'eye-off' | 'warn' | 'info' | 'chevron' | 'check' | 'select';
  let { name, size = 14 }: { name: Name; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  stroke="currentColor"
  stroke-width="1.3"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'gear'}
    <circle cx="8" cy="8" r="2.3" />
    <path
      d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
    />
  {:else if name === 'eye'}
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="1.9" />
  {:else if name === 'eye-off'}
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <path d="M2.5 13.5l11-11" />
  {:else if name === 'warn'}
    <path d="M8 1.8l6.5 11.7h-13z" fill="currentColor" stroke="none" />
    <path d="M8 6v3.6M8 11.4v.2" stroke="var(--c-on-warn)" stroke-width="1.5" />
  {:else if name === 'info'}
    <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" />
    <path d="M8 7.2v4.3M8 4.6v.2" stroke="var(--c-bg-card)" stroke-width="1.5" />
  {:else if name === 'chevron'}
    <path d="M6 3.5L10.5 8 6 12.5" />
  {:else if name === 'check'}
    <path d="M3.5 8.3l3 3 6-6.6" stroke-width="2" />
  {:else if name === 'select'}
    <rect x="2" y="2" width="12" height="12" rx="1" stroke-dasharray="2.5 2" />
    <path
      d="M6.5 5.5l5 3.3-2.2.5 1.2 2.4-1 .5-1.2-2.4-1.8 1.5z"
      fill="currentColor"
      stroke="none"
    />
  {/if}
</svg>
