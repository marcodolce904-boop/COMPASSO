
---

# Punto Nave · 2026-11-18

- **Obiettivo:** un plugin per Illustrator (Windows) che porta uno schizzo a mano o un logo imperfetto a un logo professionale. Il percorso è: ricalco pulito, poi correzione geometrica, poi costruzione visibile, e da ora anche ricomposizione secondo regole (sezione aurea e altre).
- **Vincoli:**
  - Solo Windows, pannello CEP, ExtendScript ES3.
  - Distribuzione con `Compasso-Setup.exe` a ogni push su main con versione nuova.
  - Repository privato.
  - Regole di CLAUDE.md: test prima del codice; chiedere conferma per nuove dipendenze, per `model.ts`, per `fixtures/expected`, per modifiche su più pacchetti.
  - Marco è un designer che sta imparando lo sviluppo.
- **Variabili chiave:**
  - versione = 0.7.0, pubblicata il 18/11/2026
  - test = 335, tutti verdi
  - simmetria, tolleranza di base = 1,5% della diagonale del logo (D); serve almeno il 75% di anchor con un gemello
  - simmetria sul ricalco vero di Marco = 0 anchor corretti, anche con tolleranza al 12% di D
  - curve fluide = 12°
  - ricalco, livello difficile: scarto medio 1,7 px, scarto massimo 6,5 px
- **Decisioni prese:**
  - Correzione su una copia (layer «Compasso — Corretto»).
  - Ovali completi, con l'opzione di trasformarli in cerchi.
  - Penna in RICALCA, con punti aggiungibili solo sui tracciati esistenti.
  - Storico unico con Indietro/Avanti e «Azzera tutto», che non toglie l'immagine.
  - Linee di costruzione superflue tolte dai livelli base; fixtures 06, 09 e 11 aggiornate con l'ok di Marco.
- **Questioni aperte:**
  1. **Simmetria da rifare sulle forme, non sugli anchor.** Proposta: Marco sceglie l'asse e la metà buona, quella metà viene riflessa e le due metà vengono cucite sull'asse. In alternativa, la media tra la metà e il suo riflesso.
  2. **Nuova tendina «GENERA»**, proposta da Marco. Cinque anteprime affiancate (Sezione aurea, Simmetrico, Matematico, Minimal, Strutturato); si sceglie e si applica su una copia. Da decidere:
     - le regole precise di ogni modalità;
     - un cursore di intensità;
     - un limite allo stravolgimento della forma, perché il logo resti riconoscibile.
  3. **Parametri per GENERA.** Proposta:
     - intensità;
     - rapporto di base (φ 1,618 · √2 · 3:2 · 1:1);
     - modulo (unità x o passo di griglia);
     - asse e metà da riflettere;
     - angoli ammessi (15°, 30° o 45°);
     - numero massimo di anchor;
     - scarto massimo dall'originale (% di D).
  4. **Migliorie UX da valutare:**
     - un percorso guidato RICALCA → CORREGGI → ANALIZZA, con un pulsante «Avanti»;
     - un confronto prima/dopo con un cursore a tendina;
     - preset salvabili;
     - mostrare perché una correzione non è stata applicata (oggi la simmetria resta a 0 senza spiegazione).
  5. Verifica di Marco in Illustrator vero: è ancora da fare la checklist §10.4.
- **Rischi principali:**
  - **Correzioni che funzionano solo sui test sintetici.** Segnale: Marco non vede effetti sui suoi loghi. È già successo con la simmetria.
  - **GENERA che stravolge il logo.** Le regole auree applicate alla cieca rendono il logo irriconoscibile. Segnale: tutte e 5 le anteprime sembrano loghi diversi dall'originale.
  - **Nessun logo vero di Marco come file.** Senza, ogni taratura è alla cieca. Segnale: nessun file «Segnala un problema» ricevuto.
- **Stato:**
  - RICALCA, penna, storico, CORREGGI (10 correzioni) e ANALIZZA a livelli sono funzionanti e rilasciati.
  - La simmetria è inefficace sui ricalchi veri.
  - GENERA è solo un'idea, ancora da specificare.
- **Prossima azione:** Marco invia 2 o 3 loghi veri come file (con «Segnala un problema» o in SVG/AI), così si rifà la simmetria sulle forme e si tarano le modalità di GENERA su casi reali. Claude, intanto, scrive la specifica di GENERA da approvare.
