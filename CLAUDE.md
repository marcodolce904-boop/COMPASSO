# Compasso — istruzioni per Claude Code

Plugin per Adobe Illustrator (pannello CEP, Bolt CEP + Svelte 5 + TS) che deduce la
costruzione geometrica di un logo dai suoi tracciati e la disegna su un layer dedicato.
Specifica completa: docs/SPEC.md (leggi SOLO le sezioni indicate nel prompt).
Avanzamento: docs/STATO.md (aggiornalo a fine fase).
Memoria di lavoro (decisioni, priorità, piano GENERA): leggila sempre all'inizio e aggiornala
quando cambia una decisione → @docs/MEMORIA.md

## Struttura
- packages/core   motore geometrico, TS puro, nessun DOM/host. API: analyze(), plan(), parseSvg()
- packages/ui     componenti Svelte, tokens.css, strings.ts
- apps/harness    dev web: carica SVG e mostra pannello + overlay
- apps/illustrator Bolt CEP; ExtendScript in src/jsx (ES3!)
- fixtures/svg + fixtures/expected   golden test

## Comandi
pnpm install · pnpm test · pnpm test:watch · pnpm typecheck · pnpm lint · pnpm bench
pnpm -F harness dev · pnpm -F illustrator dev|build|zxp · pnpm fixtures:update

## Regole
- core non importa da ui/apps/DOM. Coordinate core: pt, Y verso il basso.
- Tolleranze sempre relative alla diagonale del bbox (D), tranne minimi assoluti dichiarati.
- Output deterministico (id stabili).
- ExtendScript: solo ES3, solo lettura/disegno, UNA evalScript per operazione.
- Niente testi/colori hard-coded: strings.ts e tokens.css.
- Core: scrivi prima i test (Vitest; fast-check per le proprietà geometriche).
- Prima di dire "fatto": pnpm test && pnpm typecheck && pnpm lint verdi.
- Commit piccoli con messaggi chiari.

## Chiedi conferma prima di
- aggiungere dipendenze · cambiare i contratti in core/src/model.ts
- aggiornare fixtures/expected · refactoring su più pacchetti · toccare il registro di Windows

## Non fare mai
- copiare codice, asset, nome o testi di Linyal o di altri plugin
- leggere node_modules o cartelle di build

## Stile
Rispondi in italiano, conciso. Spiega le scelte tecniche in 1–2 frasi:
l'utente è un designer che sta imparando lo sviluppo.
