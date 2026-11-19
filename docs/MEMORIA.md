# Memoria di lavoro — Compasso

Impostazioni di lavoro concordate con Marco, valide per tutte le prossime sessioni.
Questo file si carica in automatico da `CLAUDE.md`. Va aggiornato quando cambia una decisione.
Stato dettagliato in `docs/STATO.md`, fotografia Vanta in `.vanta/punto-nave.md`.

_Ultimo aggiornamento: 19/11/2026, dopo il rilascio della 0.13.0 (GENERA canonico, §0bis). Prossimo
passo: prove di Marco su loghi veri con la 0.13.0, poi le migliorie del §4._

## 0bis. DIREZIONE DI GENERA CAMBIATA (Marco, 19/11/2026) — PRIORITÀ

Marco: «La versione GENERA non deve assomigliare troppo all'originale… deve renderlo canonico ai
parametri… se il logo è una m**** rimane una m****, io voglio che diventi la Nutella. Impegnati e non
farmelo ripetere.»
- GENERA **ricostruisce** il logo e lo rende canonico: niente guardia di somiglianza di base. Lo scarto
  massimo diventa un'opzione spenta di base.
- Principio e regole canoniche in `docs/GENERA.md` §0. Il motore canonico è
  `core/src/generate/canon.ts` (costruzione rette + archi + raccordi, risolutore a vincoli).
- Lezione: **non preservare l'originale quando Marco chiede una trasformazione.** «Abbellire» vuol dire
  ricostruire secondo la regola, non limare.
- **Fatto nella 0.13.0:** `generate/canon.ts` (`toConstruction`, `solve`, `finalize`,
  `fromConstruction`).
  - Il risolutore ha un richiamo debole alla forma di partenza (si spegne a fine corsa), più giri
    alternati di rifinitura e risolutore. La rifinitura rende ogni arco esatto e sceglie il centro
    coerente con l'ampiezza originale (niente bozzi).
  - Sezione aurea: R = cerchio intero più grande (o arco più grande non quasi piatto); archi oltre il
    60% di D tengono il raggio; la griglia sposta solo i centri dei cerchi interi; la mezzeria è nella
    griglia.
  - Strutturato: unifica solo i raggi (entro l'8%), non i centri, che trasformavano la coda in un
    cerchio.
  - Simmetrico canonico: solo `mirrorHalf`, senza le altre correzioni di `refine`, che rovinavano la
    cornice.
  - Test: `test/canon.test.ts`.

## 0. Fatto nella 0.9.0 (18/11 pomeriggio): A + C in ANALIZZA

Marco ha confermato l'opzione (a) per `model.ts` alle 15:00.
- **Modello** (aggiunte facoltative):
  - `Circle.approx`;
  - `dashed` e `approx` sul `Primitive` cerchio;
  - `dashed` sul `Primitive` linea;
  - `GuideLine.span`;
  - `DrawStyle.lineExtent: 'segment'`, predefinito nel pannello.
- **A. Curve libere.** `core/src/fit/arcspline.ts` (biarchi: punto di passaggio scelto sulla curva,
  ricerca del biarco più lungo, ripiego su un arco singolo vicino ai flessi) e `fit/freecurves.ts`
  (tratti non spiegati da cerchi, ovali o rette veri).
  - In `analyze` gli archi diventano cerchi con `approx`, più relazioni `tangent-circle-circle` nei
    punti di passaggio (segni quadrati in «Dettaglio»).
  - Stanno in Struttura, non in Essenziale, e non entrano in punteggi, statistiche e specifiche.
  - Si rinuncia se servono più di 3 archi per tratto (massimo 8).
- **C. Rette al tratto.** `plan()` disegna ogni retta su `span` più un margine (10% del tratto,
  almeno il 4% di D). Gli assi restano interi.
  - `fixtures/expected`: aggiunto solo `span` alle rette (05, 06, 09, 10, 11, 12), con l'ok di Marco.
- **Anteprima:** la vista non si allarga per gli archi approssimati. Il riepilogo conta «archi di curve
  libere».
- Test: `test/arcspline.test.ts`.
- **Ancora da fare:** raggruppare i bordi paralleli (es. le due gambe della A) con un segno di
  parallela; per ora le rette corte bastano a togliere il disordine.

**GENERA:** la specifica è in `docs/GENERA.md`, **approvata da Marco il 18/11 («ok a tutte le proposte»)**.
- Scarto massimo di base: 3% di D.
- Matematico: angolo base 15°; modulo automatico (unità x del logo) con suddivisione m/2.
- Minimal: le forme piccole vengono solo segnalate, non nascoste.
- Posizione: una scheda a sé, «GENERA».

**Fatto nella 0.10.0:** scheda GENERA con Matematico + Minimal.
- Core: `core/src/generate/` (`generate.ts`, `math.ts`, `minimal.ts`, `geometry.ts`); test in
  `test/generate.test.ts`.
- UI: `GenerateThumbs.svelte` e `GenerateControls.svelte`.
- Illustrator: `applyGenerate` e `revertGenerate`, layer «Compasso — Generato» con marcatura propria;
  l'impronta della selezione ha un terzo indicatore.
- Guardia di riconoscibilità, in quest'ordine:
  1. griglia più fine (m/2 → m/4 → m/8);
  2. gruppi di rette lasciati al loro angolo se la rotazione sposta oltre l'80% dello scarto;
  3. intensità ridotta (ricerca binaria).
- Minimal parte dalla versione con meno anchor (originale o corretta).

**Fatto nella 0.11.0 (19/11):** modalità **Simmetrico** e **Strutturato**, chieste da Marco.
- Simmetrico: `refine` con la sola simmetria sulle forme, con tolleranza pari allo scarto massimo;
  note `no-axis` e `partial`; asse nelle guide.
- Strutturato: `generate/structured.ts` sostituisce le curve libere con le catene di `arcSpline`,
  convertite in cubiche esatte (al massimo 90° l'una).
  - Parte dall'**originale**: gli archi di CORREGGI non sono tangenti tra loro.
  - Tolleranza dallo 0,2% allo 0,8% di D secondo l'intensità; note `nothing-to-do` e `curves-skipped`.
- UI: 4 miniature calcolate una alla volta, partendo dalla scelta; tendina «Simmetrico: parametri».

**Prossimi passi su GENERA:**
- **Sezione aurea**: specifica in `docs/GENERA.md` §7c, **approvata da Marco il 19/11 («ok a tutte le proposte»)**.
  - Riferimento: il cerchio più grande.
  - Passo intero.
  - Riquadro aureo spento di base.
  - Spirale aurea nell'anteprima.
  - Rapporti √2, 3:2 e 1:1 disponibili da subito.

  **Fatto nella 0.12.0:** `generate/golden.ts` (`goldenCompose`, `goldenSpiral`); raggi solo sui
  cerchi interi (gli archi parziali si staccherebbero); spessori = coppie di rette parallele della
  stessa forma; nota `no-golden`; guide `lines` e `spiral`;
- calcolo in un worker se diventa lento (oggi ~0,4 s per modalità sul logo di prova).

## 1. Dove siamo

- Versione pubblicata: **0.13.0**. Installer:
  `https://github.com/marcodolce904-boop/COMPASSO/releases/download/vX.Y.Z/Compasso-Setup.exe`.
  Si pubblica da solo con un push su `main` quando la versione in `apps/illustrator/package.json` è nuova.
- Schede funzionanti:
  - **RICALCA**: schizzo → tracciati, con penna, storico Indietro/Avanti e Azzera tutto.
  - **CORREGGI**: 10 correzioni su una copia del logo.
  - **ANALIZZA**: costruzione a livelli Essenziale, Struttura, Dettaglio e Tutto.
- Test: 335, tutti verdi.
- Ancora da fare: la verifica di Marco in Illustrator vero (checklist §10.4 della SPEC).

## 2. Simmetria — RISOLTO nella 0.8.0 (simmetria sulle forme)

Fatto: `core/src/fix/mirror.ts`.
- `findMirrorAxis`: l'asse si cerca confrontando le curve.
- `mirrorHalf`: taglia sull'asse, ricompone e riflette i gemelli.
- In CORREGGI c'è l'opzione **Metà da tenere** (Auto, Sinistra, Destra, Sopra, Sotto) e il report dà
  `symmetryMethod` e `symmetryNote`.
- In Auto: se gli anchor sono speculari si bilanciano come prima; altrimenti si riflette la metà con meno
  anchor, solo se lo scarto medio è entro la tolleranza **e** ogni forma cambia meno dell'8% della sua
  misura.
- Il numero di tracciati non cambia mai: Illustrator scrive la copia tracciato per tracciato.
- Test: `test/mirror.test.ts`, con scudo, cuore e goccia disegnati a mano e ricalcati.

Limiti noti:
- Un tracciato che attraversa l'asse in più punti con più pezzi sul lato tenuto resta com'è (nota
  'partial').
- Sulla goccia «difficile» il ricalco disegna male un occhio: l'automatico rifiuta, bisogna scegliere la
  metà a mano.

Storia del problema (per non ripeterlo):

**Segnalazione di Marco (18/11):** "non vedo un reale funzionamento di simmetria".

**Causa verificata.** La simmetria di CORREGGI lavora sugli anchor: cerca un gemello speculare per ogni
punto e rinuncia se meno del 75% dei punti ne ha uno. Sui ricalchi a mano i punti dei due lati non
cadono mai in posizioni speculari. Sullo schizzo vero di Marco corregge **0 punti**, anche con una
tolleranza al 12% della diagonale del logo. Sui loghi di prova disegnati al computer invece funzionava.

**Soluzione proposta:** lavorare sulle **forme**, non sugli anchor.
1. Si sceglie l'asse (automatico, verticale oppure orizzontale).
2. Si sceglie la **metà buona** (sinistra/destra oppure sopra/sotto).
3. Quella metà viene riflessa e le due metà vengono cucite sull'asse.
4. In alternativa: media tra la forma e il suo riflesso.

Quando una correzione non agisce, il pannello deve dire **perché**
(es. "simmetria non applicata: lati troppo diversi").

## 3. Nuova funzione proposta: tendina GENERA

**Idea di Marco (18/11).** Generare versioni del logo ricomposte secondo regole visive e matematiche
precise, con anteprime. Va in una tendina o scheda **a parte**.

### Le 5 modalità

| Modalità | Cosa fa al logo | Fattibilità |
|---|---|---|
| **Simmetrico** | riflette la metà scelta (metodo del §2) | alta, ed è la più urgente |
| **Sezione aurea** | raggi dei cerchi in progressione φ (1 : 1,618 : 2,618…), proporzioni del riquadro e posizioni dei centri sulla griglia aurea | media |
| **Matematico** | tutto multiplo di un modulo: raggi, distanze, angoli a 15°, 30° o 45° | alta |
| **Minimal** | meno anchor possibile, dettagli piccoli tolti, curve ridotte ad archi e rette | alta |
| **Strutturato** | ogni curva diventa un arco di un cerchio di costruzione, con tangenti continue | media |

### Come appare nel pannello

- 5 anteprime affiancate, ognuna con il logo ricomposto e le sue linee guida.
- Clic su un'anteprima: si ingrandisce, con confronto rispetto all'originale.
- **Applica**: il risultato va su una copia, come in CORREGGI.
- Ogni modalità dice cosa ha cambiato (es. "3 raggi portati in rapporto φ").

### Parametri

- **Intensità**: da 0 = originale a 100% = regola piena.
- **Rapporto di base**: φ 1,618 · √2 · 3:2 · 1:1.
- **Modulo**: unità x del logo oppure passo di griglia.
- **Asse** e **metà da riflettere** (solo per Simmetrico).
- **Angoli ammessi**: 15°, 30° o 45°.
- **Numero massimo di anchor** (solo per Minimal).
- **Scarto massimo dall'originale**, in % della diagonale: il logo deve restare **riconoscibile**.

### Rischio principale

Le regole applicate alla cieca rendono il logo irriconoscibile. Lo scarto massimo e l'intensità sono
obbligatori, non facoltativi.

## 3b. ANALIZZA sul logo vero «A con coda» (segnalazione di Marco, 18/11 sera)

**Problemi visti:** «mancano dei passaggi». In ANALIZZA il logo risulta in 5 cerchi e 17 linee.
- Le curve libere della coda (onda a S) non hanno costruzione: il motore riconosce solo archi di cerchio o
  di ovale.
- Troppe rette, lunghe da bordo a bordo: ogni gamba della A dà due bordi quasi paralleli.

**Risposta data:** si può fare. Una curva libera si costruisce come **catena di archi tangenti**
(arc spline / biarchi), entro una tolleranza.

**Opzioni proposte:**

| | Cosa fa | Cambia il logo? |
|---|---|---|
| **A. Archi per le curve libere** | ogni curva libera spiegata col minimo di archi tangenti; centri e punti di passaggio da un arco al successivo; disegnati tratteggiati con lo scarto indicato («approssimato, 0,8 pt»); se servirebbero troppi archi, lo dice | no |
| **B. Rendi costruibile** | le curve diventano davvero quegli archi; è la modalità **Strutturato** di GENERA | sì, di poco |
| **C. Rette più pulite** | rette accorciate al tratto più un margine; bordi paralleli raggruppati (una retta + segno di parallela); rette sulla stessa linea tra due forme unite | no |
| **D. Costruzione per forma** | clic su una forma per vederne solo la costruzione; legenda dei colori | no |

**Decisione di Marco (18/11):** prossimo sviluppo **A + C**, prima di GENERA. D per ora no; B resta la
futura modalità Strutturato di GENERA.

## 4. Altre migliorie concordate da valutare

- **Percorso guidato** RICALCA → CORREGGI → ANALIZZA, con un pulsante «Avanti».
- **Confronto prima/dopo** con una tendina trascinabile sull'anteprima.
- **Preset salvabili** delle regolazioni.
- **Spiegazione** quando una correzione resta a 0.

## 5. Ordine di lavoro (approvato da Marco il 18/11/2026)

1. ~~**Simmetria sulle forme** in CORREGGI~~ — fatto nella 0.8.0; diventa anche la modalità Simmetrico
   di GENERA.
2. **Scheda GENERA** con **Matematico** e **Minimal**, le più sicure.
3. **Sezione aurea** e **Strutturato**.
4. Migliorie del §4.

Prima di scrivere codice per GENERA: una specifica breve da far approvare a Marco, con le regole
esatte di ogni modalità. Le modifiche a `core/src/model.ts` vanno chieste prima.

## 6. Lezioni imparate (da non ripetere)

- **Mai considerare finita una correzione provata solo su loghi sintetici.** Va provata anche su un
  ricalco vero (es. lo schizzo in `fixtures/reports` o i file di «Segnala un problema»).
- I loghi veri di Marco come file sono la risorsa che manca di più: chiederli.
  Strada più semplice: «⚙ → Segnala un problema».
- Due archi con gli stessi estremi possono stare su cerchi speculari: per decidere se due archi sono
  "lo stesso cerchio" serve controllare anche il punto a metà (bug corretto nella 0.7.0).

## 7. Modo di lavorare con Marco

- Rispondere in italiano, in modo conciso. Spiegare le scelte tecniche in 1–2 frasi: Marco è un
  designer che sta imparando lo sviluppo.
- Rilascio:
  - commit sul ramo di lavoro, poi push sul ramo e su `main` con versione nuova;
  - controllare che la release esca;
  - dare il link dell'installer.
- Chiedere conferma prima di aggiornare `fixtures/expected`, aggiungere dipendenze o cambiare
  `model.ts` (vedi `CLAUDE.md`).
