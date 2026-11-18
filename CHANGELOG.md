# Changelog

## 0.10.0 — 18/11/2026

- **Nuova scheda GENERA** (specifica in `docs/GENERA.md`): versioni del logo ricomposte secondo una
  regola, affiancate all'originale, da applicare su una copia (layer «Compasso — Generato», distinto
  da quello di CORREGGI).
  - **Matematico**:
    - rette a multipli di 15° (o 30°, 45°, 90°); le quasi parallele diventano parallele;
    - raggi a multipli del modulo (l'unità x del logo);
    - spigoli e centri sulla griglia del modulo; gli spigoli tra due rette sono le loro intersezioni.

    La miniatura mostra la griglia e i cerchi di costruzione.

  - **Minimal**: lo stesso logo con meno anchor. Restano gli spigoli veri, gli smussi minuscoli tornano
    spigoli vivi, le curve si rifanno con il minimo di tratti e le quasi-circolari diventano archi
    esatti. Le forme molto piccole vengono segnalate. Si può fissare un numero massimo di anchor.
  - **Sempre riconoscibile.** Ogni versione resta entro lo scarto massimo (3% della diagonale, regolabile).
    Se una regola deformerebbe troppo:
    - la griglia si fa più fine da sola;
    - le rette troppo lunghe restano al loro angolo;
    - in ultimo, l'intensità scende.

    Il riepilogo dice sempre cosa è cambiato, la somiglianza (es. 99,3%) e perché qualcosa non è
    stato fatto.

  - Anteprima grande con zoom e confronto Generato / Confronto / Prima; parametri di ogni modalità in
    una tendina.

## 0.9.0 — 18/11/2026

- **ANALIZZA, costruzione delle curve libere**: le curve che non sono archi di cerchio (onde, code, foglie
  disegnate a mano) ora hanno la loro costruzione: una **catena di archi tangenti**, ognuno raccordato
  al successivo senza spigoli.
  - Gli archi sono **tratteggiati**, per distinguerli dai cerchi veri del logo.
  - In Illustrator si chiamano `arc#… r=… ~0.8pt`, con lo scarto dalla curva.
  - Se una curva richiederebbe troppi archi (più di 3 per tratto), resta senza costruzione invece di
    riempirsi di cerchi.
  - Il riepilogo li conta a parte (es. «1 cerchio, 5 archi di curve libere, 10 linee»).
- **ANALIZZA, rette più pulite**: ogni retta si disegna solo sul tratto del logo che descrive, più un
  piccolo margine, invece di attraversare tutto il disegno. Gli assi di simmetria restano interi.
  - Sul logo di prova «A con coda» le rette passano da 17, lunghe, a 10, corte.
- L'anteprima resta inquadrata sul logo anche quando un arco ha un raggio molto grande.

## 0.8.0 — 18/11/2026

- **Simmetria sulle forme (CORREGGI)**: ora funziona anche sui loghi disegnati a mano e ricalcati, dove
  i punti dei due lati non sono mai speculari. Prima lì non succedeva nulla.
  - L'asse si trova confrontando le curve, non i punti.
  - Una metà resta com'è e l'altra diventa il suo **riflesso esatto**. I tracciati che attraversano
    l'asse vengono tagliati e ricomposti; dove la curva passa l'asse quasi di traverso la giunzione è
    liscia, mentre le punte (fondo di uno scudo, incavo di un cuore) restano punte.
  - Le forme tutte da un lato, come gli occhi o le foglie, prendono la forma del gemello riflesso.
  - **Metà da tenere**: Auto, Sinistra, Destra, Sopra o Sotto.
    - In Auto i loghi disegnati al computer vengono bilanciati come prima.
    - I ricalchi a mano vengono riflessi dalla metà più pulita, ma solo se ogni forma resta
      riconoscibile.
  - Il pannello ora dice **perché** la simmetria non è stata applicata (lati troppo diversi, forme senza
    gemello) e quando una metà è stata riflessa.
- Provato su scudo, cuore e goccia con occhi disegnati a mano: in automatico 5 casi su 6 diventano
  simmetrici, prima 2 su 6. Il sesto ha un occhio ricalcato male e lì conviene scegliere la metà.

## 0.7.0 — 18/11/2026

- **CORREGGI, simmetria rifatta**: prima bastava un solo punto senza "gemello" per rinunciare, e si
  spostavano solo gli anchor (le curve restavano storte). Ora:
  - l'asse si trova anche se il logo è un po' sbilanciato;
  - anche le **maniglie** diventano speculari, quindi le due metà coincidono davvero;
  - se un lato ha un **anchor in più**, l'altro riceve il suo gemello nello stesso punto, senza cambiare
    la forma;
  - un ultimo passaggio rimette speculari le metà dopo archi e pulizia.
- **CORREGGI, Curve fluide** (nuova): dove la direzione piega solo di pochi gradi (12° di base), la
  tangente diventa continua. Vale anche tra una retta e una curva. Gli spigoli veri restano.
- **CORREGGI**: corretto un errore per cui un lato di una foglia o di una mandorla poteva essere rifatto
  con il cerchio del lato opposto, e un raccordo minuscolo vicino a una curva grande veniva "agganciato"
  a quella curva.
- **ANALIZZA, meno linee di costruzione**: nei livelli Essenziale e Struttura non ci sono più:
  - rette disegnate sopra un asse di simmetria;
  - rette parallele quasi coincidenti, come i due bordi di uno stelo sottile o un bordo fuori riga di
    pochi decimi;
  - cerchi minuscoli (raccordi).

  Restano visibili in Dettaglio e Tutto.

- **RICALCA**:
  - meno punti di troppo agli incroci, dove prima il tracciato veniva spostato;
  - i tratti vicini si ricuciono tenendo conto della direzione;
  - niente più chiusure sbagliate di un tracciato su se stesso.
- **RICALCA, storico**:
  - **← Indietro / Avanti →** con il numero di passi: comprendono sia le modifiche con la penna sia i
    movimenti delle barre;
  - **× Azzera tutto** rimette tutte le barre ai valori iniziali e toglie le modifiche, senza togliere
    l'immagine caricata (e si può annullare con Indietro).

## 0.6.0 — 18/11/2026

- **Strumento penna in RICALCA**, per ritoccare il ricalco prima di creare i tracciati:
  - **Sposta**: clic su un punto per selezionarlo (Maiusc: più punti), trascina per spostarlo; le maniglie
    dei punti selezionati si trascinano per piegare la curva (nei punti curvi l'altra maniglia segue,
    con Alt si muove da sola); doppio clic su un punto: spigolo ↔ curva.
  - **+ Punto**: clic su un tracciato per aggiungere un punto lì, senza cambiare la forma; si può subito
    trascinare.
  - **− Punto**: clic su un punto per toglierlo; il precedente si collega al successivo e la nuova curva
    ricalca il più possibile quella di prima.
  - **Angolo**: clic su un punto: lo spigolo diventa curva, la curva spigolo.
  - **Annulla / Ripeti** (Ctrl+Z, Ctrl+Maiusc+Z), frecce per spostare di 1 pt (Maiusc: 10), Canc per
    togliere i punti selezionati, Ctrl+A per selezionarli tutti; tasti V, P o +, −, Maiusc+C.
- **Immagini già nel documento**: RICALCA ora funziona anche con immagini **incorporate**, **ritagliate**
  (maschere, «Ritaglia immagine») e in formati come **PSD e TIFF**: Illustrator fa una "foto" dell'area
  visibile in un file temporaneo, il documento non cambia. Prima funzionava solo con immagini collegate in
  JPEG/PNG selezionate direttamente.
- Foto piccole (sotto i 450 px) ingrandite prima del ricalco: spigoli più precisi.

## 0.5.1 — 17/11/2026

- **Ricalco collaudato e migliorato** con un banco di prova (`pnpm bench:trace`: 10 figure dalla forma
  nota, 3 livelli di difficoltà). Nel caso difficile lo scarto massimo dalla forma vera scende da 16,9 a
  5,1 px e l'errore sugli spigoli da 6,6 a 2,8 px. Dettagli e numeri in `docs/RICALCO.md`.
  - Cerchi e ovali con 4 anchor (una curva non gira più di 120°), curve vicine unite quando la precisione
    regge, curve a S con il minimo di anchor.
  - Punte acute ritrovate anche quando la forma è un unico anello (fulmine, goccia, coda).
  - Niente più spuntoni sugli spigoli, niente tracciati minuscoli o doppioni, incroci a X che restano due
    linee intere, linee aperte che arrivano fino in fondo al segno.
  - Spigoli misurati su due finestre: quelli arrotondati dalla matita non si perdono più (anche nelle foto
    piccole), le curve strette non diventano spigoli.
  - Media tra punti che non appiattisce le curve.
- **Segnala un problema** funziona anche in RICALCA e salva lo schizzo con le regolazioni: ogni schizzo
  che non viene bene diventa un test fisso.
- CREA TRACCIATI e APPLICA CORREZIONI mostrano un errore leggibile se Illustrator rifiuta l'operazione
  (prima: «undefined tracciati creati»).

## 0.5.0 — 17/11/2026

- **Nuova scheda RICALCA**: da uno schizzo a matita (foto o scansione) a tracciati puliti col minimo
  di anchor, senza passare dal Ricalco immagine di Illustrator. Le tante passate di matita diventano
  una sola linea; i punti vengono ricampionati a distanza costante e mediati con i vicini; gli spigoli
  si riconoscono dal cambio di direzione e restano vivi (anche le punte acute); i lati dritti diventano
  rette che si incontrano nel punto esatto; le curve usano il minimo di Bézier. Le forme quasi chiuse
  si chiudono, sporco e ombre del foglio vengono ignorati, le forme sono orientate in senso orario
  (i buchi antiorario). Modalità **Linee** o **Forme piene**; anteprima con zoom; **CREA TRACCIATI**
  sul layer «Compasso Ricalco», già pronti per CORREGGI.
- **Molto più veloce sui ricalchi grandi**: con 5000 anchor la correzione passa da 11 s a 0,5 s e
  l'analisi da 7 s a 2 s.
- **Segnala un problema** (⚙): salva un file con selezione e risultato da mandare; ogni file diventa un
  test fisso del progetto.
- CORREGGI: **clic su una forma per escluderla** dalla correzione; avviso quando una correzione sposta
  il disegno di oltre l'1%.
- Pagina del progetto rinnovata (prima/dopo del ricalco, schermate nuove).

## 0.4.0 — 17/11/2026

- **Ovali**: Compasso riconosce gli ovali (anche ruotati), li elenca tra gli elementi
  («Ovale 1 · 220 × 100 pt»), li mostra nell'anteprima e li disegna nella costruzione con il loro
  centro. Prima un ovale veniva spezzato in quattro cerchi sbagliati.
- **Cerchi più precisi sui loghi ricalcati o disegnati a mano**: una curva liscia viene provata
  prima come un unico cerchio (o un unico ovale) su tutto il tratto, invece di spezzarla in tanti
  archetti con centri e raggi un po' diversi. Niente più cerchi doppi o mancanti sul rumore del ricalco.
- Un tratto disegnato «quasi» circolare su almeno 90° dà comunque il suo cerchio di costruzione
  (oltre a comparire tra le anomalie): è il cerchio che il disegno voleva avere.
- Il livello **Struttura** mostra tutti i cerchi e gli ovali che contano (almeno il 2% del contorno),
  non solo i principali.
- **CORREGGI → Ovali perfetti**: le curve quasi ovali diventano ovali esatti, con la loro tolleranza;
  l'opzione **«Trasforma gli ovali in cerchi perfetti»** li sostituisce con un cerchio dello stesso centro.
- **Nessun pezzo mancante**: i tracciati minuscoli o degeneri restano nella copia corretta; l'anteprima di
  CORREGGI disegna le linee aperte come linee (prima apparivano piene o sparivano).
- Riepilogo di CORREGGI più onesto: lo spostamento massimo si misura dalla curva originale e gli anchor
  interni ai cerchi non vengono più contati (né spostati) dall'allineamento.

## 0.3.1 — 17/11/2026

- **Niente più quadrato grigio in alto a sinistra**: era il campione dell'**unità x** (lo spessore
  dell'asta), disegnato di proposito ma senza spiegazione. Ora è spento di default; si attiva da
  _Misure → Disegna il campione dell'unità x_ e, quando c'è, in Illustrator ha l'etichetta «x = … pt».
- **Zoom e navigazione nell'anteprima di CORREGGI**: rotella per ingrandire attorno al cursore (fino a
  40000%), trascina per spostarti, doppio clic o _ADATTA_ per tornare alla vista intera; pulsanti − / +
  e da tastiera frecce, + − 0.

## 0.3.0 — 17/11/2026

- **Nuova scheda CORREGGI**: rende perfetto un logo impreciso (per esempio ricalcato da uno schizzo).
  Otto correzioni attivabili una per una, ognuna con la sua tolleranza regolabile:
  archi perfetti, raggi uguali, centri comuni, rette e angoli (0°/45°/90°), allineamento degli anchor,
  simmetria (automatica, verticale o orizzontale), griglia/arrotondamento e pulizia dei tracciati
  (meno anchor, rette consecutive unite). Un cursore **Intensità** dosa l'effetto complessivo.
- **Anteprima Prima / Dopo / Confronto**: nel confronto il contorno ciano mostra l'originale e i punti
  indicano gli anchor spostati; sotto, il riepilogo delle modifiche e lo spostamento massimo.
- **APPLICA CORREZIONI** lavora su una copia nel layer «Compasso — Corretto»: l'originale resta nel
  documento, nascosto. **Ripristina originale** elimina la copia e lo fa ricomparire.
- **Pannello ridimensionabile**: si può allargare liberamente; oltre una certa larghezza passa a due
  colonne con anteprime grandi.

## 0.2.4 — 17/11/2026

- Il messaggio di errore indica la **versione di Compasso** che sta girando (così si capisce subito se
  Illustrator usa ancora uno script vecchio).
- Nuovo controllo automatico sullo script per Illustrator: blocca la release se ricompare un'espressione
  che il motore di Illustrator non sa leggere (la causa dell'errore «Previsto: :»).
- La release viene pubblicata solo se tutti i test passano.

## 0.2.3 — 10/11/2026

- **Corretto l'errore che impediva al pannello di funzionare in Illustrator** («Previsto: : (riga 224)»):
  lo script conteneva un'espressione condizionale annidata che il motore di script di Illustrator non sa leggere.
  Una regola automatica ora le vieta in tutto il codice per Illustrator.

## 0.2.2 — 10/11/2026

- **Caricamento dello script di Illustrator verificato**: il pannello controlla che Illustrator risponda e,
  se il caricamento standard non riesce, riprova in altri due modi. Se fallisce comunque, mostra il motivo
  esatto (messaggio e riga) invece di «JSON non definito».
- Script per Illustrator reso più conservativo (niente `try/finally` senza `catch`, niente `__proto__`).
- Corretto: un errore comparso una sola volta all'avvio restava visibile anche quando tutto funzionava.

## 0.2.1 — 10/11/2026

- **Corretto l'errore «JSON non definito»** all'apertura del pannello: nella 0.2.0 lo script per Illustrator
  veniva compilato senza la libreria JSON, quindi nessuna funzione rispondeva.

## 0.2.0 — 10/11/2026

- **Nuovo installer per Windows: un solo file, `Compasso-Setup.exe`.** Doppio clic → Installa → Fine.
  Niente ZIP, niente ZXP, niente altri programmi. Si disinstalla da «App installate» di Windows.
  Ogni release viene installata e disinstallata in automatico su Windows prima di essere pubblicata.
- Per ora solo Windows (gli installer macOS sono stati rimossi).
- Corretto: il nome del layer «Compasso — Construction» poteva essere letto male da Illustrator su Windows
  (trattino lungo), impedendo a Rimuovi/Ridisegna di ritrovare il layer. Lo script per Illustrator ora è solo ASCII.
- Corretto: se l'analisi in background non rispondeva, il pannello poteva restare su «Analisi…»; ora riparte da sola.
- Corretto: nessun errore ripetuto mentre si modifica un testo in Illustrator.
- Il pannello parte in italiano se Illustrator è in italiano.
- Le release 0.1.0 e 0.1.1 (installer difettosi) sono state ritirate.

## 0.1.1 — anteprima (beta) · 10/11/2026

- **Installer Windows corretto**: la versione 0.1.0 poteva chiudersi prima di installare (errore nello script).
  Ora verifica che Compasso sia davvero installato e dice dove.
- Nuovo **«Diagnostica Compasso (Windows).bat»** (solo lettura): raccoglie in un file sul Desktop le
  informazioni utili se il pannello non compare.
- Istruzioni: il pannello può trovarsi in **Finestra → Estensioni (legacy)** nelle versioni recenti di Illustrator.

## 0.1.0 — anteprima (beta) · 10/11/2026

Prima versione installabile per Adobe Illustrator 2026 (v31) su Windows e macOS.

- **Analizza**: deduce dai tracciati selezionati cerchi, rette, allineamenti di anchor, assi di
  simmetria, unità x, raggi e rapporti notevoli; quattro livelli (Essenziale, Struttura, Dettaglio, Tutto).
- **Anteprima live** nel pannello, che segue la selezione in Illustrator.
- **Anomalie**: quasi-archi, raggi quasi uguali, centri quasi coincidenti, quasi-tangenze, anchor fuori
  riga/colonna, quasi-simmetrie, angoli quasi notevoli, con evidenziazione nell'anteprima.
- **Misure**: unità x con affidabilità, bounding box e proporzione, raggi e rapporti, area di rispetto, «Copia misure».
- **Disegna / Ridisegna / Rimuovi** su un layer bloccato «Compasso — Construction» (grigio K60 in CMYK, #7A7A7A in RGB).
- Elementi includibili/escludibili uno per uno; spessore linee e dimensione marker regolabili.
- Tolleranza Rigida/Normale/Morbida; interfaccia in inglese e italiano; tema chiaro/scuro come Illustrator.

Limiti noti: COSTRUISCI e PRESENTA arriveranno nelle versioni successive; tracciati aperti con contorno
analizzati sulla linea centrale; immagini e simboli ignorati.
