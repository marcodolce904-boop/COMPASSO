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

---

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

     **Scelto da Marco: A + C**, prima di GENERA.
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
- **Prossima azione:** Claude sviluppa A + C in ANALIZZA (previa conferma della modifica a `model.ts`). Poi Claude scrive la specifica di GENERA (Matematico + Minimal: regole, parametri,
  anteprime, limiti) in `docs/GENERA.md` e la sottopone a Marco. Marco, se può, invia il file del logo
  «A con coda» come caso di prova.

---

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
