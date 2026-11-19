<script lang="ts">
  // Barra dei preset: scegli, salva con un nome, elimina, esporta e importa (docs/MIGLIORIE.md §4).
  import {
    deletePreset,
    exportPresets,
    importPresets,
    loadPresets,
    savePreset,
    type Preset,
    type PresetKind,
  } from '../presets';
  import { t, type Lang } from '../strings';
  import TextButton from './TextButton.svelte';

  let {
    kind,
    lang,
    builtins = [],
    current,
    D,
    onApply,
  }: {
    kind: PresetKind;
    lang: Lang;
    /** Preset di esempio (nomi = chiavi dei testi). */
    builtins?: Preset[];
    /** Regolazioni attuali da salvare. */
    current: () => unknown;
    /** Diagonale del logo corrente (pt), per riadattare le misure. */
    D?: number;
    onApply: (p: Preset) => void;
  } = $props();

  let list = $state<Preset[]>(loadPresets(kind));
  let chosen = $state('');
  let naming = $state(false);
  let name = $state('');
  let msg = $state('');
  let fileEl = $state<HTMLInputElement | null>(null);

  const label = (p: Preset) => (p.builtin ? t(lang, p.name as Parameters<typeof t>[1]) : p.name);
  const all = $derived([...builtins, ...list]);

  function pick(v: string) {
    chosen = v;
    const p = all.find((q) => (q.builtin ? 'b:' : 'u:') + q.name === v);
    if (p) {
      onApply(p);
      msg = t(lang, 'preset.applied', { n: label(p) });
    }
  }
  function save() {
    const n = name.trim();
    if (!n) return;
    list = savePreset(kind, {
      name: n,
      options: $state.snapshot(current()) as unknown,
      ...(D ? { D } : {}),
    });
    chosen = 'u:' + n;
    naming = false;
    name = '';
    msg = t(lang, 'preset.saved', { n });
  }
  function remove() {
    if (!chosen.startsWith('u:')) return;
    const n = chosen.slice(2);
    list = deletePreset(kind, n);
    chosen = '';
    msg = t(lang, 'preset.deleted', { n });
  }
  async function exp() {
    const text = exportPresets(kind);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // appunti non disponibili: resta il file
    }
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = `compasso-preset-${kind}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // download non disponibile
    }
    msg = t(lang, 'preset.exported', { n: list.length });
  }
  async function imp(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    const n = importPresets(kind, await f.text());
    list = loadPresets(kind);
    msg = n === null ? t(lang, 'preset.badFile') : t(lang, 'preset.imported', { n });
    (e.currentTarget as HTMLInputElement).value = '';
  }
</script>

<div class="pbar">
  <div class="row">
    <select
      aria-label={t(lang, 'preset.aria')}
      value={chosen}
      onchange={(e) => pick(e.currentTarget.value)}
    >
      <option value="">{t(lang, 'preset.choose')}</option>
      {#each all as p ((p.builtin ? 'b:' : 'u:') + p.name)}
        <option value={(p.builtin ? 'b:' : 'u:') + p.name}>{label(p)}</option>
      {/each}
    </select>
    <TextButton label={t(lang, 'preset.save')} onclick={() => (naming = !naming)} />
    {#if chosen.startsWith('u:')}
      <TextButton label={t(lang, 'preset.delete')} tone="muted" onclick={remove} />
    {/if}
  </div>
  {#if naming}
    <div class="row">
      <input
        type="text"
        placeholder={t(lang, 'preset.name')}
        bind:value={name}
        onkeydown={(e) => e.key === 'Enter' && save()}
      />
      <TextButton label={t(lang, 'preset.ok')} onclick={save} disabled={!name.trim()} />
    </div>
  {/if}
  <div class="row small">
    <TextButton
      label={t(lang, 'preset.export')}
      tone="muted"
      onclick={exp}
      disabled={!list.length}
    />
    <TextButton label={t(lang, 'preset.import')} tone="muted" onclick={() => fileEl?.click()} />
    <input bind:this={fileEl} type="file" accept=".json,application/json" hidden onchange={imp} />
  </div>
  {#if msg}<p class="msg">{msg}</p>{/if}
</div>

<style>
  .pbar {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    padding-bottom: var(--sp-2);
    border-bottom: 1px solid var(--c-border);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  select,
  input[type='text'] {
    flex: 1;
    min-width: 0;
    padding: var(--sp-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-s);
    background: var(--c-bg-card);
    color: var(--c-text);
    font: 400 var(--fs-s) var(--f-sans);
  }
  .msg {
    margin: 0;
    font: 400 var(--fs-xs) var(--f-sans);
    color: var(--c-text-3);
  }
</style>
