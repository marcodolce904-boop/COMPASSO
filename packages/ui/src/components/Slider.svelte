<script lang="ts">
  let {
    label,
    value = $bindable(),
    min,
    max,
    step,
    defaultValue,
    unit,
    digits = 2,
    format,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    unit: string;
    digits?: number;
    /** Testo del valore (es. percentuale); se assente: valore con `digits` decimali + unità. */
    format?: (v: number) => string;
  } = $props();
  const uid = $props.id();
  const pct = $derived(((value - min) / (max - min)) * 100);
  const text = $derived(format ? format(value) : `${value.toFixed(digits)} ${unit}`);
</script>

<div class="sl">
  <label for={uid}>{label}</label>
  <input
    id={uid}
    type="range"
    {min}
    {max}
    {step}
    bind:value
    aria-valuetext={text}
    style="--pct:{pct}%"
    ondblclick={() => (value = defaultValue)}
  />
  <output for={uid}>{text}</output>
</div>

<style>
  .sl {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: var(--h-row);
  }
  label {
    width: var(--w-label);
    flex: none;
    font: 400 var(--fs-s) / var(--lh-text) var(--f-sans);
    color: var(--c-text-2);
  }
  output {
    width: var(--w-value);
    flex: none;
    text-align: right;
    font: 400 var(--fs-s) var(--f-mono);
    color: var(--c-text);
  }
  input {
    flex: 1;
    min-width: 0;
    height: var(--h-knob);
    appearance: none;
    background: transparent;
    cursor: pointer;
  }
  input::-webkit-slider-runnable-track {
    height: var(--h-track);
    border-radius: var(--h-track);
    background: linear-gradient(
      to right,
      var(--c-accent) 0 var(--pct),
      var(--c-bg-raised) var(--pct) 100%
    );
  }
  input::-moz-range-track {
    height: var(--h-track);
    border-radius: var(--h-track);
    background: var(--c-bg-raised);
  }
  input::-moz-range-progress {
    height: var(--h-track);
    border-radius: var(--h-track);
    background: var(--c-accent);
  }
  input::-webkit-slider-thumb {
    appearance: none;
    width: var(--w-knob);
    height: var(--h-knob);
    margin-top: calc((var(--h-track) - var(--h-knob)) / 2);
    border-radius: var(--r-xs);
    background: var(--c-text);
  }
  input::-moz-range-thumb {
    width: var(--w-knob);
    height: var(--h-knob);
    border: none;
    border-radius: var(--r-xs);
    background: var(--c-text);
  }
</style>
