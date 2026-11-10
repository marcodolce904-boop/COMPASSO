// Caricamento verificato dello script ExtendScript (jsx/index.js) dentro Illustrator.
// Bolt lo carica con $.evalFile senza controllare l'esito: qui si verifica che l'host
// risponda davvero e, se serve, si riprova in altri due modi. In caso di fallimento si
// restituisce un messaggio preciso (motivo e riga) da mostrare nel pannello.
import { csi } from '../lib/utils/bolt';
import { ns } from '../../shared/shared';

const run = (script: string): Promise<string> =>
  new Promise((resolve) => csi.evalScript(script, (res: string) => resolve(String(res))));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** L'host è pronto se JSON esiste e le funzioni di Compasso sono registrate. */
async function ready(): Promise<boolean> {
  const res = await run(
    `(typeof JSON) + "|" + ((typeof $ !== "undefined" && $["${ns}"]) ? typeof $["${ns}"].extractSelection : "none")`,
  );
  return res === 'object|function';
}

function readText(url: string): string | null {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    return xhr.responseText && xhr.responseText.length > 100 ? xhr.responseText : null;
  } catch (e) {
    console.error('[compasso] lettura dello script non riuscita', e);
    return null;
  }
}

const CATCH = '}catch(e){"ERR: " + e.message + " (riga " + e.line + ")"}';

export async function loadHost(): Promise<{ ok: true } | { ok: false; detail: string }> {
  const notes: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    // 1) già caricato da Bolt?
    if (await ready()) return { ok: true };

    // 2) $.evalFile con percorso normalizzato, catturando l'errore
    const path = String(csi.getSystemPath('extension')).replace(/\\/g, '/') + '/jsx/index.js';
    const r1 = await run(`try{$.evalFile(${JSON.stringify(path)});"ok"${CATCH}`);
    if (await ready()) return { ok: true };

    // 3) il testo dello script passato direttamente (nessun percorso, nessuna codifica di file)
    const text = readText('../jsx/index.js');
    const r2 = text
      ? await run(`try{eval(${JSON.stringify(text)});"ok"${CATCH}`)
      : 'script non leggibile';
    if (await ready()) return { ok: true };

    notes.length = 0;
    notes.push(`evalFile: ${r1}`, `eval: ${r2}`, `percorso: ${path}`);
    console.error(`[compasso] host non pronto (tentativo ${attempt})`, notes);
    await wait(600);
  }
  return { ok: false, detail: notes.join(' · ') };
}
