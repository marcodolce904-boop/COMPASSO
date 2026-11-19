# Punto Nave · 2026-11-19 (dopo la 0.12.0)

- **Obiettivo:** prossimo sviluppo di Compasso dopo GENERA completo. Rendere il flusso di lavoro
  (schizzo → ricalco → correzione → generazione → costruzione) più guidato, comodo e veloce, e
  verificarlo sui loghi veri di Marco.
- **Vincoli:**
  - Solo Windows, pannello CEP, ExtendScript ES3.
  - Il numero di tracciati non cambia mai.
  - Per `model.ts`, nuove dipendenze e `fixtures/expected` va chiesta conferma prima.
  - Per le novità di peso: una specifica breve approvata da Marco prima del codice.
- **Variabili chiave:**
  - versione = 0.12.0, pubblicata il 19/11/2026
  - test = 371, tutti verdi
  - modalità di GENERA = 5 su 5 (Simmetrico, Sezione aurea, Matematico, Strutturato, Minimal)
  - tempo di calcolo di GENERA ≈ 2–3 s per tutte le modalità (calcolate una alla volta)
  - loghi veri di Marco ricevuti come file = 0
- **Decisioni prese:**
  - Ordine dei lavori (Marco, 18/11): i punti 1–3 sono fatti (simmetria, GENERA, Sezione aurea e
    Strutturato). Resta il punto 4, le migliorie UX:
    - percorso guidato RICALCA → CORREGGI → ANALIZZA, con un pulsante «Avanti»;
    - confronto prima/dopo con una tendina trascinabile;
    - preset salvabili delle regolazioni;
    - spiegazione quando una correzione resta a 0.
  - Tutte le specifiche di GENERA sono state approvate e realizzate (`docs/GENERA.md`).
- **Questioni aperte:**
  1. Ordine dentro il punto 4. Proposta di Claude, da confermare:
     1. **confronto a tendina** in CORREGGI e GENERA: poco costo, molto utile per giudicare;
     2. **spiegazioni** per ogni correzione rimasta a 0 (oggi solo la simmetria lo dice);
     3. **percorso guidato** con «Avanti» tra le schede, inclusa GENERA;
     4. **preset salvabili**: dove salvarli (nel pannello o in un file) va deciso con Marco.
  2. **Velocità:** spostare il calcolo di GENERA in un worker, così il pannello non esita mai
     (oggi le 5 modalità sono calcolate una alla volta nel pannello).
  3. Bordi paralleli in ANALIZZA con il segno di parallela: rimasto dalla 0.9.0.
  4. Prove di Marco con la 0.12.0 su loghi veri, e verifica completa in Illustrator (checklist §10.4).
- **Rischi principali:**
  - **Nessuna prova su loghi veri.** Le tarature restano sulle forme di prova. Segnale: Marco non usa
    GENERA o dice che esagera.
  - **Pannello sovraccarico.** Con 5 schede, 5 modalità e molte tendine si perde chiarezza. Segnale:
    Marco non trova le funzioni, o chiede «dove si fa X».
  - **Lentezza su loghi grandi.** Segnale: più di 1 secondo di attesa a ogni movimento di una barra in
    GENERA.
- **Stato:**
  - Rilasciati e funzionanti:
    - RICALCA (penna, storico);
    - CORREGGI (10 correzioni + simmetria sulle forme);
    - ANALIZZA (archi tangenti per le curve libere, rette al tratto);
    - GENERA completo.
  - Le migliorie del punto 4 non sono iniziate.
- **Prossima azione:** Marco conferma l'ordine proposto per il punto 4 (o lo cambia) e prova la 0.12.0
  su un logo vero, mandandolo con «⚙ → Segnala un problema».
