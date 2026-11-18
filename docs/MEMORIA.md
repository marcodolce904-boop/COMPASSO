# Memoria di lavoro — Compasso

Impostazioni di lavoro concordate con Marco, valide per tutte le prossime sessioni.
Questo file si carica in automatico da `CLAUDE.md`. Va aggiornato quando cambia una decisione.
Stato dettagliato in `docs/STATO.md`, fotografia Vanta in `.vanta/punto-nave.md`.

_Ultimo aggiornamento: 18/11/2026 sera. PRIORITÀ: vedi §0 (A + C in ANALIZZA, prima
la conferma di Marco sulle modifiche a `model.ts`); poi specifica di GENERA._

## 0. PRIORITÀ DELLA PROSSIMA SESSIONE (fissata da Marco il 18/11, ripresa alle 15:00)

**Riprendere da qui, prima di tutto il resto.** Sviluppare in ANALIZZA le opzioni **A + C** del §3b,
scelte da Marco:
- **A. Archi per le curve libere**: ogni curva libera (es. la coda della «A con coda») spiegata con la
  catena minima di archi tangenti, tratteggiati e con lo scarto indicato.
- **C. Rette più pulite**: rette accorciate al tratto, bordi paralleli raggruppati.

**Domanda ancora aperta, da fare a Marco per prima.** Serve la sua conferma su queste modifiche a
`core/src/model.ts`, tutte aggiunte facoltative:
1. `Circle.approx?: number`: lo scarto in pt di un cerchio che approssima una curva libera; assente =
   cerchio vero. Si disegna tratteggiato e se ne mostra lo scarto.
2. `dashed?: boolean` sui `Primitive` cerchio e linea: tratteggio in Illustrator (`draw.ts`, ES3).
3. `GuideLine.span?: [Vec2, Vec2]`: estremi del tratto descritto dalla retta, più una nuova estensione
   `lineExtent: 'segment'` («al tratto»).

Le opzioni da proporre a Marco:
- **(a)** tutto, con le rette «al tratto» come predefinite: cambiano tutte le rette disegnate e quindi
  `fixtures/expected`, da aggiornare mostrando il diff. **È la consigliata.**
- **(b)** i campi, ma con le rette lunghe come predefinite e «al tratto» solo come opzione.
- **(c)** fermarsi.

Piano tecnico di A, dopo l'ok:
- nuovo modulo `core/src/fit/arcspline.ts`, che approssima una curva libera con biarchi o archi
  tangenti, col minimo di archi entro la tolleranza (G1 nei punti di passaggio);
- gli archi entrano in `analyze` come cerchi con `approx`, più segni quadrati nei punti di passaggio;
- si rinuncia se servirebbero più di ~4 archi per curva: in quel caso il pannello lo dice;
- test prima, con la coda della «A con coda» ricostruita come figura di prova.

Piano tecnico di C:
- `span` dai segmenti del cluster;
- in `plan`, retta = span + 10% del tratto per lato;
- rette parallele vicine raggruppate nei livelli base.

Dopo A + C: specifica di GENERA (§3, §5).

## 1. Dove siamo

- Versione pubblicata: **0.8.0**. Installer:
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
