# Punto Nave · 2026-11-18 (sera)

- **Obiettivo:** prossimo sviluppo di Compasso: la scheda **GENERA**, che ricompone il logo secondo regole
  matematiche precise, con anteprime da confrontare e applicazione su una copia. Si parte dalle modalità
  **Matematico** e **Minimal**.
- **Vincoli:**
  - Solo Windows, pannello CEP, ExtendScript ES3.
  - Il numero di tracciati non può cambiare: Illustrator scrive la copia tracciato per tracciato.
  - Ogni modalità deve lasciare il logo **riconoscibile**: scarto massimo e intensità sono obbligatori.
  - Prima di scrivere codice: specifica breve approvata da Marco.
  - Per `model.ts`, nuove dipendenze e `fixtures/expected` va chiesta conferma prima.
- **Variabili chiave:**
  - versione = 0.8.0, pubblicata
  - test = 344, tutti verdi
  - esito su un caso reale (logo «A con coda di volpe») = buono: ottenuto con l'estensione più piccoli
    ritocchi a penna in Illustrator. Primo logo vero completato con Compasso.
- **Decisioni prese:**
  - Ordine dei lavori (Marco, 18/11): simmetria sulle forme (fatta, 0.8.0) → GENERA con Matematico e
    Minimal → Sezione aurea e Strutturato → migliorie UX.
  - GENERA va in una scheda o tendina **a parte**, con anteprime e confronto con l'originale.
  - La modalità Simmetrico di GENERA riusa `mirror.ts` (già pronto).
- **Questioni aperte:**
  1. Regole esatte di **Matematico**. Proposta:
     - angoli delle rette portati ai multipli di 15° (30°, 45°) e rette quasi parallele rese parallele;
     - raggi e distanze portati a multipli del modulo (unità x del logo o passo scelto);
     - centri e anchor sulla griglia del modulo;
     - con scarto massimo dall'originale.
  2. Regole esatte di **Minimal**. Proposta:
     - meno anchor possibile entro lo scarto massimo;
     - curve quasi circolari → archi, quasi-rette → rette;
     - dettagli sotto una certa misura tolti o semplificati;
     - "Numero massimo di anchor" come parametro.
  3. Forma delle anteprime:
     - prima Matematico e Minimal affiancate all'originale;
     - poi 5 modalità quando ci saranno tutte;
     - ogni anteprima con il riepilogo di cosa ha cambiato.
  4. Sul logo «A con coda» la modalità Simmetrico non ha senso (logo asimmetrico): GENERA deve mostrare
     solo le modalità applicabili, o spiegare perché una non lo è.
  5. Il file vero del logo «A con coda» (AI/SVG o «Segnala un problema») servirebbe come caso di prova
     reale di GENERA.
  6. **ANALIZZA incompleta sul logo vero** (5 cerchi, 17 linee):
     - le curve libere della coda non hanno costruzione;
     - le rette sono troppe e troppo lunghe.

     Opzioni (dettagli in `docs/MEMORIA.md` §3b):
     - A. archi tangenti per le curve libere;
     - B. rendi costruibile (Strutturato);
     - C. rette più pulite;
     - D. costruzione per forma.

     Consiglio: A + C (+ D) prima di GENERA. In attesa della scelta di Marco.
- **Rischi principali:**
  - **Matematico stravolge le proporzioni.** Segnale: l'anteprima Matematico non sembra più lo stesso
    logo (es. le gambe della A cambiano inclinazione in modo visibile).
  - **Minimal toglie dettagli che contano**, come i tagli e le punte della coda. Segnale: spariscono gli
    spigoli caratteristici.
  - **Tarature solo su loghi sintetici.** Segnale: i test passano ma su un logo vero di Marco le anteprime
    non convincono.
- **Stato:**
  - RICALCA, penna, storico, CORREGGI (10 correzioni + simmetria sulle forme) e ANALIZZA sono rilasciati
    (0.8.0) e già usati con successo su un logo vero.
  - GENERA non è ancora iniziato: manca la specifica.
- **Prossima azione:** Marco sceglie tra le opzioni A–D per ANALIZZA. Poi Claude scrive la specifica di GENERA (Matematico + Minimal: regole, parametri,
  anteprime, limiti) in `docs/GENERA.md` e la sottopone a Marco. Marco, se può, invia il file del logo
  «A con coda» come caso di prova.
