import type { Finding, FindingKind } from '../model';
import { bandPosition, type Band } from '../tolerance';

export const MAX_FINDINGS = 30;

/** Candidato raccolto durante l'analisi, prima del punteggio. */
export interface FindingCandidate {
  kind: FindingKind;
  band: Band;
  delta: number; // stessa unità della fascia (pt o radianti)
  unit: Finding['unit'];
  refs: string[];
  /** Elementi il cui punteggio pesa l'importanza; se vuoto vale 0,5. */
  scoreRefs: string[];
  params: Record<string, string | number>;
}

const RAD = 180 / Math.PI;

/**
 * §6.9: gravità `warn` se il delta è sotto il 40% della fascia; importanza = punteggio
 * degli elementi × (1 − posizione nella fascia). Massimo 30, in ordine di importanza.
 */
export function rankFindings(
  cands: FindingCandidate[],
  scoreOf: (id: string) => number,
): Finding[] {
  const scored = cands.map((c) => {
    const pos = bandPosition(c.delta, c.band);
    const s = c.scoreRefs.length
      ? c.scoreRefs.reduce((a, id) => a + scoreOf(id), 0) / c.scoreRefs.length
      : 0.5;
    const delta = c.unit === 'deg' ? c.delta * RAD : c.delta;
    return {
      id: '',
      kind: c.kind,
      severity: pos < 0.4 ? 'warn' : 'info',
      refs: c.refs,
      delta: round(delta),
      unit: c.unit,
      messageKey: `finding.${c.kind}`,
      params: c.params,
      importance: round(s * (1 - pos)),
    } satisfies Finding;
  });
  scored.sort(
    (a, b) =>
      b.importance - a.importance ||
      (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
      (a.refs.join() < b.refs.join() ? -1 : a.refs.join() > b.refs.join() ? 1 : 0),
  );
  const top = scored.slice(0, MAX_FINDINGS);
  top.forEach((f, i) => (f.id = `f${i + 1}`));
  return top;
}

export const round = (v: number, digits = 4) => {
  const k = 10 ** digits;
  const r = Math.round(v * k) / k;
  return r === 0 ? 0 : r;
};
