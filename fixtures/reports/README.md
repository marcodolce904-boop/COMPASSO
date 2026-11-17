# Segnalazioni → test fissi

Ogni file `.json` di questa cartella è una **segnalazione** creata dal pannello
(⚙ → _Segnala un problema_): contiene la selezione, la tolleranza e il riepilogo del risultato.

Per trasformarla in un test:

1. copia il file qui, con un nome che descriva il logo (es. `monogramma-md-ricalcato.json`);
2. aggiungi il campo `expect` con quello che Compasso **deve** trovare, per esempio
   `"expect": { "circles": 5, "ellipses": 1, "axes": [1, 2] }` (numero esatto o intervallo);
3. `pnpm test`: il test `reports.test.ts` controlla l'atteso, che l'analisi sia deterministica e che
   la correzione non perda tracciati e sia idempotente.

`esempio-sintetico-ricalco.json` è un esempio generato (non un logo reale) che mostra il formato.
