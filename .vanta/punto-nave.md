# Punto Nave · 2026-11-18 (dopo la 0.10.0)

- **Obiettivo:** prossimo sviluppo di Compasso dopo la scheda GENERA (Matematico + Minimal): completare
  le modalità di GENERA e rendere il percorso schizzo → logo professionale più guidato, verificando
  tutto su loghi veri di Marco.
- **Vincoli:**
  - Solo Windows, pannello CEP, ExtendScript ES3.
  - Il numero di tracciati non cambia mai: Illustrator scrive le copie tracciato per tracciato.
  - Ogni modalità di GENERA resta entro lo scarto massimo (3% della diagonale, regolabile).
  - Per ogni nuova modalità: prima una specifica approvata da Marco.
  - Prima di cambiare `model.ts`, aggiungere dipendenze o aggiornare `fixtures/expected` va chiesta
    conferma.
- **Variabili chiave:**
  - versione = 0.10.0, pubblicata il 18/11/2026
  - test = 358, tutti verdi
  - GENERA = 2 modalità su 5 (Matematico, Minimal)
  - tempo di calcolo GENERA ≈ 0,4 s per modalità sul logo di prova (17 anchor)
  - loghi veri di Marco ricevuti come file = 0 (solo screenshot)
- **Decisioni prese:**
  - Ordine dei lavori (Marco, 18/11):
    1. simmetria sulle forme — fatto, 0.8.0;
    2. GENERA con Matematico e Minimal — fatto, 0.10.0;
    3. Sezione aurea e Strutturato;
    4. migliorie UX: percorso guidato, confronto prima/dopo a tendina, preset salvabili, spiegazione
       quando una correzione resta a 0.
  - Strutturato = rendere davvero archi le curve libere, con gli archi tangenti della 0.9.0
    (opzione B scelta come modalità futura).
  - In ANALIZZA la costruzione per forma (opzione D) per ora non si fa.
- **Questioni aperte:**
  1. Proposta di Claude, da confermare: dentro il punto 3 fare prima **Simmetrico** in GENERA
     (`mirror.ts` è già pronto, costo basso) e **Strutturato** (`arcspline.ts` è già pronto), poi
     **Sezione aurea**, che ha bisogno di una specifica sua: quali proporzioni (raggi in progressione
     φ, riquadro aureo, posizioni dei centri), cosa fare se il logo non ha cerchi.
  2. Risultati di Marco con la 0.10.0 su loghi veri: quale modalità convince, dove esagera.
  3. Bordi paralleli in ANALIZZA (es. le gambe della A) raggruppati con un segno di parallela: rimasto
     da fare dalla 0.9.0.
  4. Spostare il calcolo di GENERA in un worker, se con loghi grandi il pannello esita.
  5. Verifica completa in Illustrator vero (checklist §10.4 della SPEC).
- **Rischi principali:**
  - **Tarature solo su loghi sintetici.** Segnale: test verdi, ma Marco non vede effetti utili sui suoi
    loghi (è già successo con la simmetria).
  - **Sezione aurea che stravolge il logo o sembra arbitraria.** Segnale: l'anteprima aurea non è
    riconoscibile, oppure il riepilogo non sa dire quali rapporti φ ha imposto.
  - **Pannello lento con loghi complessi** (5 modalità calcolate insieme). Segnale: più di 1 s di attesa
    a ogni movimento di una barra.
- **Stato:**
  - Rilasciati e funzionanti: RICALCA (penna, storico), CORREGGI (10 correzioni + simmetria sulle
    forme), ANALIZZA (curve libere ad archi tangenti, rette al tratto), GENERA (Matematico, Minimal).
  - Primo logo vero completato con Compasso: la «A con coda».
  - Le modalità Simmetrico, Sezione aurea e Strutturato non sono ancora iniziate.
- **Prossima azione:** Marco conferma l'ordine proposto (Simmetrico + Strutturato, poi Sezione aurea
  con la sua specifica) e, se può, manda il file del logo «A con coda» con «⚙ → Segnala un problema».
