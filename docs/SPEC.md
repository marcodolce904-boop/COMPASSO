# COMPASSO — Specifica di progetto e piano di sviluppo

> **Versione documento:** 0.2 · 07/11/2026 · Autore: Marco Dolce
> **Nome:** Compasso (confermato; il marchio va verificato prima del lancio, vedi D7).
> **Obiettivo:** prima uso personale e portfolio, poi pubblicazione (D8).
> **Riferimento:** il plugin *Linyal* per Illustrator (@kadlab). Ne ricreiamo **concetto, flusso e UX**, non il codice, il nome o il brand (vedi §14).

---

## 0. Come usare questo documento

- Questo file è la **fonte di verità** del progetto. Nel repository va salvato come `docs/SPEC.md`.
- Il file `CLAUDE.md` nella root del repository è l'**Appendice A**, da copiare così com'è.
- Claude Code lavora **una fase alla volta** (§11). Ogni fase ha una scaletta, un "Fatto quando" e il modello consigliato.
- Lo stato di avanzamento sta in `docs/STATO.md`, aggiornato da Claude Code alla fine di ogni fase. Questo file cambia solo quando cambia una decisione.
- Le sezioni marcate **[DA CALIBRARE]** contengono valori iniziali da verificare con i test.

---

## 1. Visione

**Cosa fa.** Compasso legge i tracciati vettoriali di un logo e **deduce la sua costruzione geometrica**: i cerchi che le curve seguono, le rette, gli assi di simmetria, le tangenze, gli allineamenti e lo spessore dell'asta (unità **x**). Poi la disegna su un layer dedicato, sopra il logo.

**Cosa non fa.** Non sovrappone una griglia preimpostata. È questo che lo distingue da GridMe, Akrivi Gridit, Anchr e tydi.

**Il valore aggiunto:**
1. **Inferenza.** La costruzione nasce dalle curve reali del logo.
2. **Findings.** Segnala le quasi-coincidenze, cioè gli errori invisibili: una curva circolare al 99%, raggi diversi dell'1%, anchor fuori riga di 0,3 pt.
3. **Specs.** Ricava l'unità x e l'area di rispetto.
4. **Present** (dopo la v1). Genera la tavola di presentazione del logo.

**Per chi.** Logo designer e graphic designer che vogliono mostrare la costruzione di un marchio (portfolio, presentazioni al cliente, social) o controllarne la precisione.

---

## 2. Decisioni

| # | Tema | Scelta | Stato |
|---|---|---|---|
| D1 | Motore geometrico | Pacchetto TypeScript puro e separato dall'host, testato con fixture SVG | ✅ Approvata (07/11/2026) |
| D2 | Piattaforma principale | Adobe Illustrator, pannello **CEP** creato con **Bolt CEP** | ✅ Confermata (Illustrator 2026 installato) |
| D3 | Altre piattaforme | Harness web per lo sviluppo → Figma (opzionale) → UXP quando esce la beta di Illustrator | 🟡 Predefinita |
| D4 | Framework UI | **Svelte 5 + TypeScript**: leggero e vicino all'HTML/CSS | 🟡 Predefinita |
| D5 | Struttura repo | Monorepo **pnpm** (core, ui, harness, illustrator) | 🟡 Predefinita |
| D6 | Aspetto | Stessa struttura e UX del video; colore d'accento, nome e testi propri | 🟡 Predefinita, necessaria per pubblicare |
| D7 | Nome | **Compasso**. Prima del lancio va verificato il marchio (EUIPO TMview) e che il nome non sia già usato su Adobe Exchange o Figma Community | ✅ Confermata (07/11/2026) |
| D8 | Scopo | Entrambi: prima uso personale e portfolio, poi **pubblicazione** dopo la v1.0 | ✅ Confermata (07/11/2026) |
| D9 | Lingua dell'interfaccia | Testi centralizzati fin dall'inizio; EN predefinita, IT disponibile | 🟡 Predefinita |
| D10 | Modello di distribuzione | Gratis/open source, freemium o a pagamento (Gumroad, Adobe Exchange) | 🔴 Da decidere entro la Fase 7 |
| D11 | Repository | Privato fino alla decisione D10; licenza MIT se diventa open source | 🟡 Predefinita |

**Perché CEP e non UXP.** A novembre 2026 UXP per Illustrator non è aperto agli sviluppatori terzi. Adobe ha annunciato la beta pubblica entro la primavera 2027. CEP resta utilizzabile fino a fine 2029, e da dicembre 2028 sarà disattivato per impostazione predefinita, ma riattivabile. Il motore separato (D1) rende la migrazione a UXP un lavoro limitato all'adapter.

**Cosa cambia perché il plugin verrà pubblicato (D8):**
- Interfaccia in inglese per impostazione predefinita, con l'italiano disponibile (D9).
- Identità visiva, testi e icone propri fin dalla prima versione (D6, §14).
- Nessuna raccolta di dati: il plugin lavora solo in locale. Se un giorno servirà una licenza online, andrà dichiarata in una privacy policy.
- Su Adobe Exchange le nuove sottomissioni CEP per Illustrator sono accettate fino a dicembre 2028. Se il canale scelto è Exchange, la v1.0 CEP va pubblicata prima di quella data; altrimenti si pubblica direttamente la versione UXP.
- Il codice resta privato finché non si decide il modello di distribuzione (D10, D11).

---

## 3. Glossario

| Termine | Significato |
|---|---|
| Anchor | Punto di ancoraggio di un tracciato |
| Maniglie | Punti di controllo che definiscono la curva tra due anchor |
| Cubica | Segmento di Bézier cubica: P0 (anchor), C1, C2 (maniglie), P1 (anchor) |
| Kappa | ≈ 0,5523. Rapporto maniglia/raggio con cui una cubica approssima un quarto di cerchio |
| Cerchio di costruzione | Cerchio completo che un arco del logo "segue" |
| Retta guida | Prolungamento infinito di un segmento dritto, oppure riga di anchor allineati |
| Tangenza | Retta o cerchio che tocca un altro cerchio in un solo punto |
| Asse di simmetria | Retta rispetto alla quale il logo è speculare |
| Unità x | Spessore ricorrente dell'asta, usato come modulo e per l'area di rispetto |
| Area di rispetto | Margine minimo attorno al logo, espresso in multipli di x |
| Finding | Quasi-coincidenza sospetta: "è *quasi* un cerchio", "è *quasi* allineato" |
| Livello | Densità della costruzione disegnata: Essenziale, Struttura, Dettaglio, Tutto |
| D | Diagonale del bounding box del logo. Tutte le tolleranze sono frazioni di D |

---

## 4. Specifica funzionale

### 4.1 Struttura del pannello

- **Header:** nome e versione, icona impostazioni ⚙.
- **Tab principali:** `COSTRUISCI` · `ANALIZZA` · `PRESENTA`. La v1 contiene solo ANALIZZA; le altre due tab mostrano "In arrivo".
- **Footer fisso**, sempre visibile: riepilogo numerico e pulsante principale.

### 4.2 Tab ANALIZZA (v1, il cuore del prodotto)

**A. Anteprima live**
- Riquadro scuro con indicatore "● ANTEPRIMA LIVE". Il pallino è del colore d'accento e pulsa durante l'analisi.
- Miniatura SVG generata nel pannello: il logo con riempimento grigio chiaro e la costruzione del livello corrente sovrapposta in linee scure. **Non tocca il documento.**
- Riepilogo sotto la miniatura: `23 tracciati · 5 cerchi, 12 linee`.
- Si aggiorna quando cambia la selezione in Illustrator (§8.4) e quando cambiano livello o impostazioni.

**B. Sotto-tab:** `Anomalie (n)` · `Geometria` · `Misure`. Il contatore delle anomalie è colorato quando n > 0.

**B1. Geometria** (sotto-tab predefinita)
- Selettore livello (controllo segmentato): `Essenziale` · `Struttura` · `Dettaglio` · `Tutto`. Predefinito: Struttura.
- Sezione **VISUALIZZAZIONE**, con il suggerimento "doppio clic = reset" a destra:
  - Spessore linea: 0,25–3 pt, predefinito 0,75 pt, passo 0,05.
  - Dimensione marker: 2–20 pt, predefinita 8 pt, passo 0,1.
  - Il valore numerico è a destra in monospace, ad esempio `0.75 pt`. Il doppio clic sullo slider lo riporta al predefinito.
- Elenco **Elementi (n)**, comprimibile e chiuso per impostazione predefinita:
  - Gruppi: Cerchi, Rette, Assi, Allineamenti.
  - Ogni riga ha un'icona occhio (includi/escludi), il nome (es. `Cerchio 3 · r 120.0 pt`) e il punteggio come barretta.
  - Al passaggio del mouse l'elemento si evidenzia nell'anteprima.
  - Le esclusioni manuali hanno la precedenza sul livello.

**B2. Anomalie (Findings)**
- Elenco ordinato per importanza. Ogni voce ha:
  - un'icona di gravità (info o avviso);
  - una frase chiara, ad esempio "Curva quasi circolare: scarto max 0,8 pt da un cerchio di r 64,2 pt";
  - il delta numerico.
- Un clic evidenzia gli elementi coinvolti nell'anteprima.
- Stato vuoto: "Nessuna anomalia: la costruzione è pulita ✓".
- In v1.1 ogni voce avrà anche il pulsante `Correggi` (§12, Fase 8).

**B3. Misure (Specs)**
- **Unità x:** valore in pt e affidabilità (alta/media/bassa). Se l'affidabilità è bassa: "Unità x non determinabile con certezza".
- **Bounding box:** larghezza × altezza e proporzione (es. 1 : 1,12).
- **Raggi:** elenco dei raggi distinti con i rapporti tra loro. Se un rapporto è vicino a valori noti viene segnalato (1,618 aureo, 1,414 √2, 2, 1,5).
- **Area di rispetto:** moltiplicatore 0,5–3 x (predefinito 1 x) e casella "Disegna area di rispetto".
- Pulsante "Copia misure", che copia negli appunti il testo formattato.

**C. Footer**
- Riepilogo: `23 tracciati · 5 cerchi, 12 linee`.
- Prima del disegno: pulsante pieno a tutta larghezza **DISEGNA COSTRUZIONE**.
- Dopo il disegno: **RIDISEGNA** (pieno) e il pulsante testuale `Rimuovi` a destra.
- Il pulsante è disattivato quando non c'è una selezione valida.

### 4.3 Tab COSTRUISCI (v1.1)

Il contenuto della tab Build di Linyal non è noto: questa è una progettazione nostra.
- **Progressione di cerchi:** si sceglie un rapporto (aureo, √2, 1,5, Fibonacci, personalizzato), il numero di cerchi e il raggio base. I cerchi vengono generati su un layer di lavoro.
- **Griglia modulare:** si basa sull'unità x oppure su un valore personalizzato.
- **Ricostruisci perfetto:** su una **copia** del logo sostituisce le curve "quasi circolari" con archi perfetti, usando i findings.

### 4.4 Tab PRESENTA (v1.2)

- Crea una nuova tavola di presentazione con il logo e la costruzione, una versione chiara e una scura, l'area di rispetto in x, le quote e una legenda.
- Formati: 1:1, 4:5, 16:9 e A4.
- Esportazione in PNG, SVG e PDF.

### 4.5 Impostazioni (⚙)

- Tolleranza: `Rigida` · `Normale` · `Morbida`, moltiplicatori ×0,5 · ×1 · ×2 delle soglie del §6.
- Colore della costruzione: automatico (grigio 60% K in CMYK, #7A7A7A in RGB) oppure personalizzato.
- Estensione delle rette: `bbox + 25%` (predefinita) oppure `bordo tavola`.
- Lingua: EN / IT.
- Nome del layer: predefinito `Compasso — Construction`.

### 4.6 Stati e casi limite

| Situazione | Comportamento |
|---|---|
| Nessun documento o nessuna selezione | Anteprima vuota con testo "Seleziona un logo per iniziare". Pulsante disattivato. |
| Selezione con testo vivo | Analisi su una copia convertita in tracciati, poi eliminata. Avviso informativo. |
| Gruppi e tracciati composti | Vengono appiattiti. Ogni tracciato composto è un "glifo" e tiene il riferimento al padre. |
| Maschere di ritaglio | v1: il tracciato di ritaglio viene ignorato e si analizza solo il contenuto. |
| Tracciati aperti con solo contorno | v1: si analizza la linea centrale e compare un avviso. v1.1: contorno espanso su copia. |
| Più di 3.000 anchor | Avviso con conferma prima di analizzare. |
| Analisi oltre 300 ms | Indicatore di caricamento; l'interfaccia resta reattiva perché l'analisi gira in un Web Worker. |
| Errore dell'host | Toast con un messaggio comprensibile; i dettagli vanno nella console. |
| Layer di costruzione già presente | Il pulsante diventa RIDISEGNA. Il layer viene riconosciuto dal nome e da un tag interno. |

---

## 5. Architettura tecnica

### 5.1 Flusso dei dati

```
Illustrator (selezione)
   │  ExtendScript: extractSelection()  ── 1 sola chiamata evalScript
   ▼
DocumentGeometry (JSON)
   │  core.analyze()   ← gira in un Web Worker nel pannello
   ▼
AnalysisResult ──► UI: anteprima SVG, elenchi, misure
   │  core.plan(livello, stile, inclusioni/esclusioni)
   ▼
ConstructionPlan (JSON)
   │  ExtendScript: drawPlan()  ── 1 sola chiamata evalScript
   ▼
Layer "Compasso — Construction" (bloccato)
```

**Regola d'oro.** ExtendScript (JavaScript ES3, lento) **legge** e **disegna**, nient'altro. Tutto il calcolo avviene nel core, in TypeScript moderno.

### 5.2 Struttura del repository

```
compasso/
├─ CLAUDE.md                     ← Appendice A
├─ docs/
│  ├─ SPEC.md                    ← questo file
│  └─ STATO.md                   ← avanzamento, aggiornato da Claude Code
├─ packages/
│  ├─ core/                      TS puro, zero dipendenze da DOM o host
│  │  ├─ src/model.ts            contratti dati (§5.4)
│  │  ├─ src/math/               Vec2, bbox, distanze, intersezioni
│  │  ├─ src/extract/            parser SVG path → segmenti normalizzati
│  │  ├─ src/fit/                test kappa, fit di Taubin, catene di archi
│  │  ├─ src/primitives/         cerchi canonici, rette (clustering)
│  │  ├─ src/relations/          tangenze, concentrici, allineamenti
│  │  ├─ src/symmetry/           assi di simmetria
│  │  ├─ src/specs/              unità x, rapporti, area di rispetto
│  │  ├─ src/findings/           doppia soglia, messaggi
│  │  ├─ src/rank/               punteggio e livelli
│  │  ├─ src/plan/               ConstructionPlan
│  │  └─ src/index.ts            API pubblica: analyze(), plan()
│  └─ ui/                        componenti Svelte condivisi
│     ├─ src/tokens.css          design token (§7.3)
│     ├─ src/strings.ts          testi EN/IT (§7.5)
│     ├─ src/components/         Header, Tabs, Preview, Slider…
│     └─ src/Panel.svelte        pannello completo
├─ apps/
│  ├─ harness/                   Vite: carichi un SVG e provi il pannello nel browser
│  ├─ illustrator/               Bolt CEP: manifest, jsx (ExtendScript), entry pannello
│  └─ figma/                     (Fase 10, opzionale)
├─ fixtures/
│  ├─ svg/                       loghi di test
│  └─ expected/                  risultati attesi (JSON) per i golden test
└─ scripts/                      generatore di fixture sintetiche, benchmark
```

Se Bolt CEP non si integra bene nel monorepo, `apps/illustrator` resta un progetto Bolt standard che importa `@compasso/core` e `@compasso/ui` tramite workspace o alias. Claude Code sceglie la via più semplice e la documenta in STATO.md.

### 5.3 Stack

| Livello | Scelta | Note |
|---|---|---|
| Linguaggio | TypeScript in modalità `strict` | ExtendScript tipizzato tramite Bolt (Types-for-Adobe) |
| Pacchetti | pnpm workspace | `corepack enable` |
| Build | Vite | Fornito da Bolt CEP per il pannello |
| UI | Svelte 5 | Componenti condivisi tra harness e pannello |
| Test | Vitest + fast-check | Unit, golden e property test |
| Lint/format | ESLint + Prettier | Regola: `core` non può importare `ui` o le app |
| Host Illustrator | Bolt CEP (Hyper Brew) | HMR, `evalTS()` tipizzato, build ZXP |
| Font UI | JetBrains Mono + Inter (licenza OFL) | Inclusi in locale: il pannello deve funzionare offline |
| Librerie geometriche | Nessuna nel core v1 | bezier.js e flatten-js solo come riferimento; aggiungere dipendenze **solo dopo approvazione** |

### 5.4 Contratti dati (`packages/core/src/model.ts`)

```ts
// Unità: punti (pt). Coordinate del core: origine in alto a sinistra, Y verso il BASSO (come in SVG).
// Gli adapter convertono dal/verso il sistema dell'host (Illustrator ha la Y verso l'alto).
export type Vec2 = { x: number; y: number };

export type Segment =
  | { kind: 'line'; p0: Vec2; p1: Vec2 }
  | { kind: 'cubic'; p0: Vec2; c1: Vec2; c2: Vec2; p1: Vec2 };

export interface PathData {
  id: string;              // id stabile assegnato dall'adapter
  glyphId?: string;        // tracciato composto o lettera di appartenenza
  closed: boolean;
  filled: boolean;
  stroked: boolean;
  strokeWidth?: number;
  segments: Segment[];
}

export interface DocumentGeometry {
  source: 'illustrator' | 'figma' | 'svg';
  artboard?: { x: number; y: number; width: number; height: number };
  paths: PathData[];
  warnings: WarningCode[];   // es. 'live-text-outlined', 'clip-ignored', 'stroke-centerline'
}

export type SegmentRef = { pathId: string; index: number };

export interface Circle { id: string; cx: number; cy: number; r: number;
  support: number; refs: SegmentRef[]; score: number; }
export interface GuideLine { id: string; theta: number; rho: number;        // forma normale
  orientation: 'h' | 'v' | 'd45' | 'free'; origin: 'segment' | 'anchor-row' | 'tangent';
  support: number; score: number; }
export interface Axis { id: string; theta: number; rho: number; error: number; score: number; }

export type RelationKind = 'tangent-line-circle' | 'tangent-circle-circle' | 'concentric'
  | 'center-on-anchor' | 'center-on-line' | 'anchor-row' | 'anchor-column' | 'equal-radius';
export interface Relation { id: string; kind: RelationKind; refs: string[]; error: number; at?: Vec2; }

export type FindingKind = 'near-arc' | 'near-concentric' | 'near-equal-radius' | 'near-row'
  | 'near-column' | 'near-tangent' | 'near-symmetry' | 'near-angle';
export interface Finding { id: string; kind: FindingKind; severity: 'info' | 'warn';
  refs: string[]; delta: number; unit: 'pt' | '%' | 'deg';
  messageKey: string; params: Record<string, string | number>; importance: number; }

export interface Specs {
  unitX: number | null; unitXConfidence: 'high' | 'medium' | 'low';
  bbox: { x: number; y: number; width: number; height: number };
  radii: number[]; notableRatios: { a: string; b: string; ratio: number; name?: string }[];
}

export type Level = 'essential' | 'structure' | 'detail' | 'full';
export type TolerancePreset = 'strict' | 'normal' | 'loose';

export interface AnalysisResult {
  stats: { paths: number; anchors: number; circles: number; lines: number; axes: number };
  circles: Circle[]; lines: GuideLine[]; axes: Axis[];
  relations: Relation[]; findings: Finding[]; specs: Specs;
  levels: Record<Level, string[]>;           // id degli elementi visibili per livello
  tolerance: TolerancePreset; durationMs: number;
}

export interface DrawStyle {
  strokeWidth: number;                        // pt
  markerSize: number;                         // pt
  color: 'auto' | { r: number; g: number; b: number };
  axisDash: [number, number];                 // es. [4, 3]
  lineExtent: 'bbox-margin' | 'artboard';
}

export type Primitive =
  | { type: 'circle'; id: string; cx: number; cy: number; r: number; group: 'circles' }
  | { type: 'line'; id: string; a: Vec2; b: Vec2; group: 'lines' | 'axes' }
  | { type: 'marker'; id: string; at: Vec2; shape: 'cross' | 'square'; group: 'markers' }
  | { type: 'unit'; id: string; x: number; y: number; size: number; label: string; group: 'specs' }
  | { type: 'rect'; id: string; x: number; y: number; w: number; h: number; dashed: boolean; group: 'specs' };

export interface ConstructionPlan { layerName: string; style: DrawStyle; primitives: Primitive[]; }

// API pubblica del core
export declare function analyze(geom: DocumentGeometry,
  opts?: { tolerance?: TolerancePreset }): AnalysisResult;
export declare function plan(result: AnalysisResult, opts: {
  level: Level; style: DrawStyle; include?: string[]; exclude?: string[];
  clearspace?: { enabled: boolean; multiplier: number };
}): ConstructionPlan;
export declare function parseSvg(svgText: string): DocumentGeometry; // per harness e test
```

### 5.5 Regole architetturali

1. `core` non importa niente da `ui`, dalle app o dal DOM. Deve girare in Node, nel browser e in un Worker.
2. Tutte le tolleranze sono **relative a D**. Le uniche eccezioni sono soglie assolute minime, dichiarate esplicitamente.
3. Gli id sono stabili e deterministici: lo stesso input produce lo stesso output, così i golden test sono affidabili.
4. ExtendScript va scritto in **ES3**: niente `let`, arrow function, template string o `JSON` nativo, a meno che Bolt fornisca un polyfill. È consentita **una sola chiamata `evalScript` per operazione**.
5. Nessun testo dell'interfaccia scritto nei componenti: tutto passa da `strings.ts`.
6. Nessun colore o misura scritto nei componenti: tutto passa da `tokens.css`.

---

## 6. Motore geometrico (D1 ✅)

### 6.1 Estrazione (adapter, lato host)

- Si visitano la selezione, i `GroupItem` (ricorsivamente), i `CompoundPathItem` e i `PathItem`.
- Il testo va convertito in tracciati su un duplicato (`createOutline()`), letto e poi eliminato.
- Il segmento i → i+1 è la cubica *(anchor_i, rightDirection_i, leftDirection_{i+1}, anchor_{i+1})*. Se il tracciato è chiuso, si aggiunge anche il segmento dall'ultimo anchor al primo.
- Si usa il sistema di coordinate della tavola attiva e si **inverte la Y** (`y_core = −y_ai`).

### 6.2 Normalizzazione (core)

- Un segmento è una **retta** se le maniglie coincidono con gli anchor (entro 1e-6) oppure se sono collineari con la corda (distanza dalla corda < 0,02% di D).
- Si eliminano i segmenti degeneri, cioè di lunghezza < 0,01% di D.
- Si calcolano il bbox, D e la lunghezza totale del contorno L_tot.

### 6.3 Rilevamento degli archi

1. **Test rapido (forma chiusa).**
   - Si interseca la normale in P0 con la normale in P1 e si ottiene il centro C.
   - r₀ = |P0−C| e r₁ = |P1−C| devono differire meno dello 0,5%.
   - θ è l'ampiezza dell'arco. Lunghezza attesa delle maniglie: **h = (4/3)·tan(θ/4)·r**. Per un quarto di cerchio h/r ≈ 0,5523.
   - Se |C1−P0| e |P1−C2| sono entro il 2% di h, il segmento è un **arco**, con centro e raggio esatti.
2. **Test generale.**
   - Si campionano 16 punti sulla cubica e si esegue il **fit di Taubin**: va implementato con il metodo di Newton descritto da Chernov, senza SVD e senza dipendenze. Il fit di Kåsa serve solo come stima iniziale.
   - Si calcola lo scarto radiale massimo:
     - se è ≤ ε_arc stretta, il segmento è un arco;
     - se è ≤ ε_arc larga, è un candidato **finding `near-arc`**.
3. **Catene.** I segmenti consecutivi con tangente continua (angolo < 2°) si fondono finché il fit sull'unione resta entro la soglia (procedura greedy). Così si riconoscono gli archi spezzati in più segmenti e le curve disegnate a mano.
4. **Scarti.**
   - Se r > 5·D l'arco è "quasi dritto" e viene trattato come retta.
   - Gli archi con ampiezza < 8° ricevono peso basso.

### 6.4 Cerchi canonici

- Clustering dei cerchi con union-find: due cerchi si fondono se |Δcentro| ≤ ε_c e |Δr| ≤ ε_r.
- Il cerchio canonico è la media pesata sul supporto, cioè sulla lunghezza d'arco spiegata.
- Ogni cerchio conserva i `refs` ai segmenti che lo seguono.
- I cerchi tracciati come 4 cubiche diventano un unico cerchio completo.

### 6.5 Rette

- Ogni segmento dritto viene esteso a retta infinita, in forma normale (θ ∈ [0, π), ρ).
- Le rette si raggruppano per (θ, ρ). Il supporto è la somma delle lunghezze.
- Se l'angolo devia meno di ε_ang si fa lo **snap a 0°, 90° e 45°**. Se la deviazione è tra la soglia stretta e quella larga, nasce un finding `near-angle`.
- **Rette da allineamento:** 3 o più anchor sulla stessa y (o x) generano una guida orizzontale (o verticale). Lo stesso vale per i punti estremi dei cerchi (cy ± r, cx ± r) quando coincidono con altri anchor. Da qui nascono le linee orizzontali che si vedono nel video.

### 6.6 Relazioni

| Relazione | Condizione (ε stretta) |
|---|---|
| Tangenza retta-cerchio | \|dist(C, retta) − r\| < ε_t |
| Tangenza cerchio-cerchio | \|d − (r₁ + r₂)\| < ε_t oppure \|d − \|r₁ − r₂\|\| < ε_t |
| Concentrici | \|C₁ − C₂\| < ε_c |
| Raggi uguali | \|r₁ − r₂\| < ε_r |
| Centro su anchor o su retta | distanza < ε_c |
| Anchor sulla stessa riga o colonna | \|Δy\| oppure \|Δx\| < ε_row, con almeno 2 anchor appartenenti a tracciati diversi o non adiacenti |

### 6.7 Assi di simmetria

- Candidati:
  - l'asse verticale e quello orizzontale per il centro del bbox;
  - gli stessi per il baricentro dell'area;
  - i due assi principali (PCA) degli anchor.
- Per ogni candidato si riflettono gli anchor e si calcola la **distanza di Hausdorff** con l'insieme originale.
  - Se è ≤ ε_sym stretta, l'asse è valido.
  - Se è ≤ ε_sym larga, si genera un finding `near-symmetry` con l'elenco degli anchor asimmetrici.

### 6.8 Unità x (spessore dell'asta)

- Candidati:
  - la distanza tra coppie di rette parallele con verso di percorrenza opposto, appartenenti allo stesso glifo e a meno di D/3 l'una dall'altra;
  - |r₁ − r₂| per le coppie di cerchi concentrici che delimitano la stessa forma.
- Si costruisce un istogramma con classi larghe l'1% di D, pesato sul supporto. La **moda** è l'unità x.
- Affidabilità: alta se la moda raccoglie ≥ 50% del peso, media se ≥ 30%, altrimenti bassa.

### 6.9 Findings (doppia soglia)

- Sotto ε stretta la relazione è **vera** e viene disegnata.
- Tra ε stretta ed ε larga si ha un **finding**: "quasi", probabilmente un errore.
- Sopra ε larga la relazione non esiste.
- Gravità: `warn` se il delta è sotto il 40% della fascia (vicinissimo, quindi quasi certamente un errore), altrimenti `info`.
- Importanza = punteggio degli elementi coinvolti × (1 − posizione nella fascia).
- Si mostrano al massimo 30 findings, ordinati per importanza.

**Tolleranze iniziali, preset Normale [DA CALIBRARE]**

| Parametro | ε stretta (vera) | ε larga (finding) |
|---|---|---|
| Scarto radiale dell'arco (ε_arc) | 0,15% D | 0,8% D |
| Centri coincidenti (ε_c) | 0,2% D | 1% D |
| Raggi uguali (ε_r) | 0,2% D | 1,5% D |
| Anchor sulla stessa riga/colonna (ε_row) | max(0,02 pt; 0,005% D) | 0,5% D |
| Angolo di snap (ε_ang) | 0,3° | 2° |
| Tangenza (ε_t) | 0,2% D | 1% D |
| Simmetria, Hausdorff (ε_sym) | 0,3% D | 1,5% D |

### 6.10 Punteggio e livelli

```
score = 0.45·supporto + 0.20·relazioni + 0.15·dimensione + 0.20·bonus
  supporto   = lunghezza spiegata / L_tot, normalizzata sul massimo tra gli elementi
  relazioni  = min(numero relazioni, 5) / 5
  dimensione = cerchi: r / (D/2); rette: lunghezza dentro il bbox / D  (limitata a 0..1)
  bonus      = asse 1.0 · raggio ripetuto 0.5 · concentrico 0.5 · retta a 0°/90° 0.3   (limitato a 1)
```

| Livello | Contenuto |
|---|---|
| **Essenziale** | Cerchi e rette in ordine di punteggio fino a coprire il 60% di L_tot, più gli assi di simmetria validi |
| **Struttura** | Essenziale + rette con score ≥ 0,35 + allineamenti con 3 o più anchor + quadrato dell'unità x |
| **Dettaglio** | Struttura + cerchi con supporto ≥ 2% + marker di centro e di tangenza |
| **Tutto** | Tutti gli elementi rilevati |

### 6.11 Piano di disegno (`plan()`)

- **Cerchi:** cerchi completi.
- **Rette:** ritagliate sul rettangolo di estensione, cioè il bbox espanso del 25% oppure la tavola.
- **Assi:** linee tratteggiate (`axisDash`).
- **Marker:** croce sul centro dei cerchi, quadratino vuoto sui punti di tangenza. Il lato è pari a `markerSize`.
- **Unità x:** quadrato pieno grigio chiaro di lato x, con etichetta "x" sopra, in alto a sinistra fuori dal bbox (come nel video).
- **Area di rispetto:** rettangolo tratteggiato a k·x dal bbox, con quadratini x agli angoli.
- `include` ed `exclude` hanno la precedenza sul livello.

---

## 7. UI/UX

### 7.1 Principio

**Stessa struttura, densità e flusso del video:**
- pannello scuro integrato in Illustrator;
- tab maiuscole spaziate con sottolineatura sulla tab attiva;
- riquadro di anteprima;
- controlli segmentati;
- slider con valore in monospace;
- grande pulsante d'accento in fondo.

**Elementi distintivi propri**, per evitare la copia pedissequa (§14): colore d'accento, nome, logo, testi e icone.

### 7.2 Wireframe (larghezza predefinita 320 px, minima 280 px)

```
┌──────────────────────────────────────────┐
│ COMPASSO  0.1.0                       ⚙  │  header 32px, label mono maiuscolo spaziato
├──────────────────────────────────────────┤
│   COSTRUISCI      ANALIZZA      PRESENTA │  tab 36px
│                   ‾‾‾‾‾‾‾‾               │  sottolineatura accento 2px
│ ┌──────────────────────────────────────┐ │
│ │ ● ANTEPRIMA LIVE                     │ │  card scura, raggio 6px
│ │            ┌──────────┐              │ │
│ │            │ miniatura│              │ │  logo grigio chiaro + costruzione scura
│ │            └──────────┘              │ │
│ │     23 tracciati · 5 cerchi, 12 linee│ │  mono 11px, colore secondario
│ └──────────────────────────────────────┘ │
│ ┌────────────┬─────────────┬───────────┐ │
│ │ Anomalie 4 │ [Geometria] │  Misure   │ │  sotto-tab, attiva con bordo
│ └────────────┴─────────────┴───────────┘ │
│ ┌─────────┬─────────┬─────────┬────────┐ │
│ │Essenz.  │Struttura│Dettaglio│[Tutto] │ │  segmentato livelli
│ └─────────┴─────────┴─────────┴────────┘ │
│ VISUALIZZAZIONE        doppio clic = reset│
│ Spessore linea   ━━━━━▌──────    0.75 pt │
│ Dimensione marker ━━━▌───────    8.0 pt  │
│ ▸ Elementi (17)                          │  elenco comprimibile
├──────────────────────────────────────────┤
│ 23 tracciati · 5 cerchi, 12 linee        │  footer fisso
│ ┌──────────────────────────────────────┐ │
│ │        DISEGNA COSTRUZIONE           │ │  pulsante accento, 40px
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
Dopo il disegno:  [ RIDISEGNA ████████████ ]  Rimuovi
```

### 7.3 Design token (`packages/ui/src/tokens.css`)

Proposta "blueprint": un accento ciano tecnico, coerente con il disegno di costruzione e diverso dal lime del riferimento. Si cambia modificando un solo token.

```css
:root {
  /* superfici (sincronizzate con il tema di Illustrator, §8.5) */
  --c-bg-panel: #2f2f2f;  --c-bg-card: #232323;  --c-bg-raised: #3a3a3a;
  --c-border: #464646;    --c-border-strong: #5a5a5a;
  /* testo */
  --c-text: #ededed;      --c-text-2: #a9a9a9;   --c-text-3: #7a7a7a;
  /* accento e stati */
  --c-accent: #3ec6ff;    --c-on-accent: #0b1b24; --c-accent-dim: #3ec6ff33;
  --c-warn: #f5a623;      --c-danger: #ff5a5f;    --c-ok: #4cd07d;
  /* anteprima */
  --c-preview-bg: #d9d9d9; --c-preview-logo: #b5b5b5; --c-preview-line: #3a3a3a;
  /* tipografia */
  --f-mono: 'JetBrains Mono', ui-monospace, monospace;
  --f-sans: 'Inter', system-ui, sans-serif;
  --fs-xs: 10px; --fs-s: 11px; --fs-m: 12px; --fs-l: 13px;
  --ls-caps: 0.12em;
  /* spazi e forme */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px;
  --r-s: 4px; --r-m: 6px;
  --t-fast: 120ms ease-out;
}
```

### 7.4 Componenti

| Componente | Note |
|---|---|
| `Header` | Nome in mono maiuscolo spaziato, versione, avviso di aggiornamento opzionale in `--c-warn`, pulsante ⚙ |
| `TabBar` | Maiuscolo, `--ls-caps`; la tab attiva è in `--c-text` con sottolineatura d'accento animata |
| `PreviewCard` | SVG con viewBox sul bbox del logo; evidenziazione al passaggio del mouse sugli elementi; pallino d'accento che pulsa durante l'analisi |
| `SubTabs` | Segmentato con bordo sulla voce attiva; badge contatore |
| `Segmented` | Livelli, tolleranza; navigabile con le frecce da tastiera |
| `Slider` | Traccia piena d'accento, cursore a barretta verticale, valore mono a destra, doppio clic = reset, frecce ±passo |
| `ElementList` / `FindingList` | Righe 28px, occhio per includere/escludere, gravità, delta |
| `PrimaryButton` | Tutta larghezza, `--c-accent` con testo `--c-on-accent`, maiuscolo; stati hover, premuto, disattivato, caricamento |
| `TextButton` | "Rimuovi", "Copia misure" |
| `EmptyState`, `Toast`, `Tooltip` | Messaggi brevi |

**Accessibilità:** contrasto AA, focus visibile (anello d'accento), tutto utilizzabile da tastiera, `aria-label` sui controlli fatti solo di icone.

### 7.5 Testi (`strings.ts`)

| Chiave | EN (predefinita) | IT |
|---|---|---|
| tab.build / inspect / present | BUILD / ANALYZE / PRESENT | COSTRUISCI / ANALIZZA / PRESENTA |
| preview.title | LIVE VIEW | ANTEPRIMA LIVE |
| preview.stats | {p} paths · {c} circles, {l} lines | {p} tracciati · {c} cerchi, {l} linee |
| sub.findings / geometry / specs | Issues / Geometry / Specs | Anomalie / Geometria / Misure |
| level.* | Core / Structure / Detail / All | Essenziale / Struttura / Dettaglio / Tutto |
| display.title / reset | DISPLAY / double-click to reset | VISUALIZZAZIONE / doppio clic = reset |
| display.stroke / marker | Stroke / Marker | Spessore linea / Dimensione marker |
| btn.draw / redraw / remove | DRAW GUIDES / REDRAW / Clear | DISEGNA COSTRUZIONE / RIDISEGNA / Rimuovi |
| empty.selection | Select a logo to begin | Seleziona un logo per iniziare |
| findings.none | No issues — clean construction ✓ | Nessuna anomalia: la costruzione è pulita ✓ |

### 7.6 Interazioni

- Cambiare livello o slider aggiorna **subito l'anteprima**. Il documento cambia solo con DISEGNA o RIDISEGNA.
- Il passaggio del mouse su un elemento o un finding lo evidenzia nell'anteprima con `--c-accent`.
- Animazioni brevi (≤ 150 ms), rispettando `prefers-reduced-motion`.

---

## 8. Integrazione con Illustrator

### 8.1 Layer di output

- Nome: `Compasso — Construction`, creato in cima alla pila dei layer.
- Sotto-layer: `Circles`, `Lines`, `Axes`, `Markers`, `Specs`.
- Ogni oggetto ha `name` = id del primitivo (es. `circle#3 r=120.00`).
- Il layer viene **bloccato** dopo il disegno. RIDISEGNA lo sblocca, lo svuota e ridisegna. Rimuovi lo sblocca ed elimina il layer.

### 8.2 Stile

- Contorno senza riempimento; spessore = `strokeWidth`.
- Colore automatico: grigio K60 se il documento è CMYK, `#7A7A7A` se è RGB.
- Assi tratteggiati; marker con lo stesso colore.
- Quadrato x: riempimento K20, etichetta "x" in carattere di sistema.

### 8.3 API ExtendScript (`apps/illustrator/src/jsx/`)

- `extractSelection(): string` restituisce il JSON `DocumentGeometry`, più eventuali errori gestiti.
- `drawPlan(planJson: string): string` restituisce un JSON con l'esito, il numero di oggetti e il tempo impiegato.
- `removeConstruction(): string`.
- `hasConstruction(): boolean`.
- `getDocInfo(): string` restituisce modalità colore, tavola attiva e unità.
- Primitive di disegno: `pathItems.ellipse(top, left, w, h)`, `pathItems.add()` + `setEntirePath()`, `pathItems.rectangle()`, `textFrames.add()`.

### 8.4 Rilevamento della selezione

- **Da verificare all'inizio della Fase 4:** se Illustrator invia al pannello CEP un evento di cambio selezione.
- In mancanza:
  - polling leggero ogni 800 ms di un'impronta della selezione (numero di oggetti + bounds arrotondati);
  - estrazione e analisi complete **solo se l'impronta cambia**;
  - polling sospeso quando il pannello è nascosto o il documento non è attivo.

### 8.5 Tema

Il colore di sfondo del pannello si legge da `CSInterface.hostEnvironment.appSkinInfo` e si aggiorna all'evento di cambio tema. Così il pannello segue la luminosità dell'interfaccia di Illustrator.

### 8.6 Sviluppo e debug su Windows

- Abilitare il debug delle estensioni non firmate:
  `reg add HKCU\Software\Adobe\CSXS.11 /v PlayerDebugMode /t REG_SZ /d 1 /f`
  e lo stesso con `CSXS.12`. Con Illustrator 2026 Claude Code verifica quale versione CEP è supportata prima di scrivere nel registro.
- Attivare la **Modalità sviluppatore** di Windows, necessaria per i symlink che Bolt crea nella cartella delle estensioni CEP.
- Il debug si fa con Chrome DevTools sulla porta definita nel file `.debug` di Bolt.
- Undo: ogni operazione di disegno crea passi di annullamento. Il modo "pulito" per annullare è **Rimuovi**, e va scritto nella guida.

### 8.7 Packaging

- ZXP firmato con `ZXPSignCmd` (Bolt ha il comando di build). Per l'uso personale basta un certificato self-signed.
- Installazione con ZXP Installer (aescripts) o Anastasiy's Extension Manager.
- Pubblicazione su Adobe Exchange solo se è il canale scelto in D10.

---

## 9. Prestazioni (obiettivi)

| Operazione | Obiettivo |
|---|---|
| `analyze()` su un logo di 200 anchor | < 150 ms |
| `analyze()` su 2.000 anchor | < 1,5 s (nel Worker, interfaccia reattiva) |
| `extractSelection()` su 500 anchor | < 500 ms |
| `drawPlan()` su 100 primitivi | < 1 s |

Accorgimenti: griglia spaziale per i clustering, nessun oggetto creato nei cicli caldi, benchmark in `scripts/bench.ts`.

---

## 10. Test

### 10.1 Fixture (`fixtures/svg/`)

| # | File | Cosa verifica |
|---|---|---|
| 01 | `cerchio-4-cubiche.svg` | 1 cerchio, nessun finding |
| 02 | `arco-90.svg` | Test kappa in forma chiusa |
| 03 | `arco-3-cubiche-irregolari.svg` | Catena di archi + fit di Taubin |
| 04 | `quasi-cerchio-1.5pct.svg` | Finding `near-arc` |
| 05 | `rettangolo-arrotondato.svg` | 4 archi uguali, rette, raggi uguali |
| 06 | `lettera-o.svg` | Concentrici, unità x |
| 07 | `lettera-e.svg` | Rette orizzontali e archi |
| 08 | `lettera-a.svg` | Glifo complesso |
| 09 | `marchio-simmetrico.svg` | Asse verticale |
| 10 | `marchio-quasi-simmetrico.svg` | Finding `near-symmetry` |
| 11 | `anchor-fuori-riga-0.3pt.svg` | Finding `near-row` |
| 12 | `diagonali-parallele.svg` | Rette a 45°/60°, clustering |
| 13 | `compound-con-buchi.svg` | Tracciati composti |
| 14 | `wordmark-vettorializzato.svg` | Analisi per glifo |
| 15 | `logo-a-mano.svg` | Pochi falsi positivi |
| 16 | `logo-video-ridisegnato.svg` | Marchio simile a quello del video (solo test interno) |
| 17 | `grande-2000-anchor.svg` | Prestazioni |

Le fixture 01–05 e 09–12 si generano con lo script `scripts/gen-fixtures.ts`, così i valori veri sono noti. Le altre le disegni tu in Illustrator o Figma e le esporti in SVG.

### 10.2 Test automatici

- **Unit:** matematica, parser, fit, ogni relazione.
- **Property test (fast-check):** un cerchio casuale approssimato con 4 cubiche deve dare un fit con centro e raggio corretti entro lo 0,1%. Un cerchio deformato oltre ε_larga non deve essere riconosciuto come cerchio.
- **Golden test:** `analyze(fixture)` viene confrontato con `fixtures/expected/*.json`, a tolleranza numerica. `pnpm fixtures:update` rigenera i file e mostra le differenze, che **vanno approvate da Marco**.
- **Regole dei pacchetti:** un test di lint verifica che `core` non importi da `ui` o dalle app.

### 10.3 Comandi

`pnpm test` · `pnpm test:watch` · `pnpm typecheck` · `pnpm lint` · `pnpm bench` · `pnpm -F harness dev` · `pnpm -F illustrator dev | build | zxp`

### 10.4 Checklist manuale in Illustrator (Fase 5 e Fase 7)

- [ ] Senza selezione compare lo stato vuoto e il pulsante è disattivato.
- [ ] Un cerchio semplice dà 1 cerchio e nessuna anomalia.
- [ ] Il logo del video ridisegnato dà circa 5 cerchi e 12 linee, con un risultato visivamente simile al riferimento.
- [ ] Gruppi annidati, tracciati composti e maschere vengono gestiti.
- [ ] Il testo vivo produce un avviso e l'analisi corretta; nessuna copia resta nel documento.
- [ ] DISEGNA crea il layer bloccato, RIDISEGNA lo sostituisce, Rimuovi lo elimina.
- [ ] Modificare gli slider e premere RIDISEGNA applica spessore e marker.
- [ ] Funziona su documenti CMYK e RGB.
- [ ] Funziona con una tavola non all'origine e con più tavole.
- [ ] Ctrl+Z dopo il disegno non lascia stati incoerenti nel pannello.
- [ ] Con più di 2.000 anchor compare l'avviso e i tempi restano accettabili.

---

## 11. Roadmap a fasi (scalette)

Legenda: dimensione **S/M/L** = lavoro relativo · 🧠 = modello consigliato in Claude Code.

### Fase 0 — Preparazione · S
**Obiettivo:** ambiente pronto sul PC Windows.
- [ ] Installare Node.js LTS, Git per Windows e VS Code; eseguire `corepack enable` (attiva pnpm).
- [ ] Installare Claude Code e fare il login.
- [ ] Attivare la Modalità sviluppatore di Windows.
- [ ] Creare il repository GitHub privato `compasso` e clonarlo.
- [ ] Copiare questo file in `docs/SPEC.md` e l'Appendice A in `CLAUDE.md`. Creare `docs/STATO.md` vuoto.
- [x] Illustrator 2026 installato (serve dalla Fase 4). Annotare il numero di versione esatto (Aiuto → Informazioni su Illustrator) in STATO.md.

**Fatto quando:** `node -v`, `pnpm -v`, `git --version` e `claude` funzionano.

### Fase 1 — Fondamenta del motore · M · 🧠 Opus
- [ ] Monorepo pnpm, TypeScript strict, Vitest, ESLint/Prettier, script di root.
- [ ] `core/model.ts` con i contratti del §5.4.
- [ ] `math/`: Vec2, bbox, distanze, intersezione di rette, campionamento delle cubiche.
- [ ] `extract/`: parser dei path SVG (M L H V C S Q T A Z, assoluti e relativi; Q e A convertiti in cubiche) → `DocumentGeometry`. `parseSvg()` legge `<path>`, `<circle>`, `<rect>`, `<ellipse>`, `<polygon>` e applica `transform`.
- [ ] Normalizzazione (§6.2).
- [ ] `fit/`: test kappa, Taubin (Newton), catene (§6.3).
- [ ] `scripts/gen-fixtures.ts` per le fixture sintetiche 01–05.
- [ ] Test unit e property test.

**Fatto quando:** `pnpm test` e `pnpm typecheck` sono verdi e le fixture 01–05 danno gli archi e i cerchi attesi.

### Fase 2 — Motore completo v1 · L · 🧠 Opus
- [ ] Cerchi canonici (§6.4).
- [ ] Rette: clustering, snap, rette da allineamento (§6.5).
- [ ] Relazioni (§6.6).
- [ ] Simmetrie (§6.7).
- [ ] Unità x e Specs (§6.8).
- [ ] Findings a doppia soglia con chiavi di messaggio (§6.9).
- [ ] Punteggio e livelli (§6.10).
- [ ] `plan()` (§6.11).
- [ ] Preset di tolleranza.
- [ ] Golden test su tutte le fixture disponibili + `fixtures:update`.
- [ ] Benchmark (§9).
- [ ] Prima calibrazione delle tolleranze sulle fixture.

**Fatto quando:** i golden test sono verdi, gli obiettivi di prestazione sono raggiunti e c'è un report di calibrazione in STATO.md.

### Fase 3 — Harness web e UI del pannello · M · 🧠 Sonnet
- [ ] *(Opzionale, consigliato)* Mockup del pannello in **Figma** tramite il connettore, oppure in **Magic Patterns**, da approvare prima di scrivere codice.
- [ ] `ui/tokens.css`, `strings.ts` e i componenti del §7.4.
- [ ] `Panel.svelte` con la tab ANALIZZA completa (§4.2).
- [ ] `apps/harness`:
  - trascinamento di un file SVG;
  - "tavola" centrale con il logo e l'overlay del piano;
  - pannello a destra largo 320 px.
- [ ] Analisi in un Web Worker; anteprima che segue livello e slider.
- [ ] Elenchi Elementi e Anomalie con evidenziazione nell'anteprima.
- [ ] Stati vuoto, caricamento ed errore.

**Fatto quando:** caricando una fixture e cambiando livello, l'overlay cambia correttamente e il pannello rispetta il wireframe §7.2.

### Fase 4 — Illustrator: lettura · M · 🧠 Sonnet
- [ ] Creare lo scaffold di Bolt CEP (Svelte + TS) in `apps/illustrator` e collegarlo a `core` e `ui`.
- [ ] Manifest: id `com.marcodolce.compasso`, host ILST. Si sviluppa e si testa su Illustrator 2026; versioni precedenti vanno dichiarate solo dopo averle testate.
- [ ] PlayerDebugMode, symlink e debug con DevTools (§8.6).
- [ ] `extractSelection()` (§6.1, §8.3): gruppi, compound, testo, inversione della Y.
- [ ] Rilevamento della selezione (§8.4) e anteprima live.
- [ ] Tema sincronizzato (§8.5).

**Fatto quando:** selezionando un logo in Illustrator l'anteprima è corretta e i numeri coincidono con quelli dell'harness sullo stesso SVG.

### Fase 5 — Illustrator: disegno · M · 🧠 Sonnet → **MVP**
- [ ] `drawPlan()`, `removeConstruction()`, `hasConstruction()` (§8.1–8.3).
- [ ] Colore automatico in base alla modalità del documento.
- [ ] DISEGNA, RIDISEGNA e Rimuovi collegati.
- [ ] Una sola `evalScript` per operazione, con misura dei tempi.
- [ ] Checklist manuale §10.4.

**Fatto quando:** la checklist è tutta ✓ su 3 loghi reali. 🎉 **MVP utilizzabile.**

### Fase 6 — Misure e area di rispetto · S/M · 🧠 Sonnet
- [ ] Sotto-tab Misure completa (§4.2 B3).
- [ ] Disegno dell'area di rispetto con i quadratini x.
- [ ] "Copia misure".

**Fatto quando:** l'unità x è corretta sulle fixture 06–08 e l'area di rispetto viene disegnata correttamente.

### Fase 7 — Rifinitura e v1.0 · M · 🧠 Sonnet
- [ ] Impostazioni (§4.5) e lingua EN/IT.
- [ ] Casi limite (§4.6): tracciati aperti, maschere, selezioni enormi.
- [ ] Ottimizzazioni delle prestazioni.
- [ ] Build ZXP self-signed e guida di installazione.
- [ ] README, CHANGELOG, versione 1.0.0.
- [ ] Decidere il modello di distribuzione (D10).

**Fatto quando:** lo ZXP installato su un'altra macchina (o un altro utente Windows) funziona e la checklist §10.4 è tutta ✓.

### Fase 8 — COSTRUISCI · L (v1.1)
- [ ] Progressione di cerchi e griglia modulare (§4.3).
- [ ] "Ricostruisci perfetto" su una copia.
- [ ] Pulsante `Correggi` sui singoli findings: snap del raggio, dell'allineamento o dell'angolo, su una copia o con conferma.
- [ ] Analisi per glifo dei wordmark, con un risultato per ogni lettera.

### Fase 9 — PRESENTA · M (v1.2)
- [ ] Tavola di presentazione (§4.4) con template di impaginazione.
- [ ] Esportazione in PNG, SVG e PDF.
- [ ] *Idea distintiva:* esportare la costruzione come **SVG animato o Lottie**, con le linee che si "disegnano", da rifinire in **LottieLab** o **Jitter** per i video social.

### Fase 10 — Altre piattaforme · L (opzionale)
- [ ] **Figma:** `apps/figma`, adapter da `vectorPaths` più `absoluteTransform`, UI riusata, disegno con `EllipseNode`/`VectorNode` in un frame bloccato.
- [ ] **UXP:** quando sarà disponibile la beta pubblica di Illustrator (annunciata per la primavera 2027), nuovo adapter e formato `.ccx`.

### Fase 11 — Lancio · M
- [ ] Verifica del marchio "Compasso" (EUIPO TMview) e dei nomi su Adobe Exchange e Figma Community.
- [ ] Canale scelto in D10: GitHub (come per V.A.N.T.A.), Gumroad o Adobe Exchange (CEP accettato fino a dicembre 2028).
- [ ] Licenza d'uso (EULA) o licenza open source, privacy policy, contatto di supporto.
- [ ] ZXP firmato con un certificato valido per la distribuzione; guida di installazione per Windows e macOS.
- [ ] Materiali propri: screenshot, GIF e immagini di copertina realizzati con il plugin, non con quelli di altri.
- [ ] Landing page (WordPress o Wix, che stai studiando nel corso).
- [ ] Video "prima/dopo" girato con la Fujifilm e montato in DaVinci Resolve; animazioni con Jitter o LottieLab; carosello LinkedIn.

**MVP = Fasi 0–5** · **v1.0 = Fasi 0–7**

---

## 12. Procedimento con Claude Code

### 12.1 Ciclo di ogni fase

1. `/clear` per partire con un contesto pulito (fa risparmiare token).
2. Incollare il **prompt della fase** (Appendice B).
3. Claude Code propone un piano in **plan mode** (Shift+Tab). Lo leggi e lo approvi o correggi.
4. Implementazione: per il `core` **prima i test**, poi il codice.
5. Verifica automatica: `pnpm test && pnpm typecheck && pnpm lint`.
6. Verifica visiva: nell'harness (Fasi 3+) o in Illustrator (Fasi 4+).
7. Commit con un messaggio chiaro e aggiornamento di `docs/STATO.md`.
8. Fine fase: rileggi STATO.md e decidi se passare alla fase successiva.

### 12.2 Modelli e consumo

| Lavoro | Modello |
|---|---|
| Algoritmi geometrici (Fasi 1–2), bug difficili | **Opus** |
| UI, adapter Illustrator, setup, packaging (Fasi 3–7) | **Sonnet** |
| Piccole modifiche, testi, rinomine | **Haiku** |

Consigli per spendere meno:
- indicare a Claude Code **solo le sezioni** dello SPEC che servono ("leggi §6.3"), non l'intero file;
- usare `/clear` tra una fase e l'altra e `/compact` nelle sessioni lunghe;
- tenere `CLAUDE.md` breve;
- non far leggere `node_modules` o le build;
- fixture piccole.

### 12.3 Quando fermarsi e chiedere

Claude Code deve chiederti conferma prima di:
- aggiungere dipendenze;
- cambiare i contratti del §5.4;
- aggiornare i JSON attesi delle fixture;
- fare refactoring su più pacchetti;
- toccare il registro di Windows.

---

## 13. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Fine di CEP (default off da dicembre 2028, rimosso a fine 2029) | Core separato; adapter UXP non appena esce la beta (2027–2028) |
| Troppi falsi positivi sui loghi disegnati a mano | Doppia soglia, preset di tolleranza, calibrazione sulle fixture 15–16, limite di 30 findings |
| ExtendScript lento | Una sola chiamata per operazione, JSON compatto, calcolo nel pannello |
| Errori di coordinate (Y, origine della tavola) | Conversione centralizzata nell'adapter; test con tavola non all'origine |
| Illustrator non disponibile | Le Fasi 1–3 si fanno interamente nell'harness web; Figma come host alternativo |
| Prestazioni su loghi enormi | Web Worker, griglia spaziale, avviso oltre 3.000 anchor |
| Rischio legale | §14: nome, brand e codice propri |
| Progetto troppo grande | MVP chiaro (Fasi 0–5); COSTRUISCI e PRESENTA dopo |

---

## 14. Note legali (indicazioni generali, non consulenza legale)

- **Idee e funzionalità sono libere.** Nell'UE la protezione riguarda il codice, non le funzioni (Direttiva 2009/24/CE; Corte di giustizia, C-406/10 *SAS Institute*). Ricreare un analizzatore di costruzione con tab simili è legittimo.
- **Non copiare codice o asset di Linyal:** niente estrazione o decompilazione del pannello originale.
- **Nome:** non usare "Linyal" né nomi simili. Il nome definitivo va verificato su EUIPO TMview prima di pubblicare.
- **Aspetto:** la struttura a tab è generica. Copiare in modo identico l'insieme distintivo (palette scura + lime, monospace, testi identici) potrebbe configurare imitazione servile (art. 2598 c.c.). Per questo cambiamo accento, testi e icone (§7).
- **Promozione:** il formato "Beginner vs Pro" è libero, ma non vanno usati video o screenshot altrui.

---

## 15. Strumenti che hai già e dove servono

| Strumento | Uso nel progetto |
|---|---|
| **Claude Code** | Sviluppo di tutte le fasi |
| **Figma** (connettore su Claude) | Mockup del pannello in Fase 3; host alternativo in Fase 10 |
| **Magic Patterns** (connettore) | Prototipo veloce dell'interfaccia, alternativo a Figma |
| **GitHub** | Repository (privato fino a D10); pubblicazione possibile come per V.A.N.T.A. |
| **Illustrator** | Host del plugin e disegno delle fixture SVG |
| **LottieLab / Jitter** | Animazioni della costruzione per la promozione (Fase 9 e 11) |
| **Fujifilm X-T30 II + DaVinci Resolve** | Video promozionale "prima/dopo" |
| **WordPress / Wix** (connettori) | Landing page per il lancio (Fase 11) |

---

## Appendice A — `CLAUDE.md` (da copiare nella root del repository)

~~~markdown
# Compasso — istruzioni per Claude Code

Plugin per Adobe Illustrator (pannello CEP, Bolt CEP + Svelte 5 + TS) che deduce la
costruzione geometrica di un logo dai suoi tracciati e la disegna su un layer dedicato.
Specifica completa: docs/SPEC.md (leggi SOLO le sezioni indicate nel prompt).
Avanzamento: docs/STATO.md (aggiornalo a fine fase).

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
~~~

---

## Appendice B — Prompt pronti per ogni fase

**Fase 1**
> Leggi CLAUDE.md e in docs/SPEC.md solo §5.2–5.5, §6.1–6.3, §10 e §11 (Fase 1). In plan mode proponi il piano per la Fase 1. Dopo la mia approvazione implementala scrivendo prima i test. Non andare oltre la Fase 1. Alla fine esegui i controlli e aggiorna docs/STATO.md.

**Fase 2**
> Leggi CLAUDE.md, docs/STATO.md e in SPEC solo §5.4, §6 e §11 (Fase 2). Piano in plan mode, poi implementazione con TDD. Mostrami prima i JSON attesi delle fixture, poi aggiornali. Alla fine fammi un report di calibrazione delle tolleranze in STATO.md.

**Fase 3**
> Leggi CLAUDE.md, STATO.md e in SPEC §4.1–4.2, §4.6, §7 e §11 (Fase 3). Costruisci packages/ui e apps/harness. Il pannello deve rispettare il wireframe §7.2 e i token §7.3. Alla fine dimmi come avviare l'harness.

**Fase 4**
> Leggi CLAUDE.md, STATO.md e in SPEC §5.1, §6.1, §8 e §11 (Fase 4). Ho Illustrator 2026 su Windows (versione esatta in STATO.md). Crea apps/illustrator con Bolt CEP, guidami passo passo nel debug e implementa la sola lettura della selezione con anteprima live. Prima di toccare il registro chiedimi conferma.

**Fase 5**
> Leggi CLAUDE.md, STATO.md e in SPEC §6.11, §8.1–8.3, §10.4 e §11 (Fase 5). Implementa disegno, ridisegno e rimozione. Alla fine dammi la checklist §10.4 da eseguire a mano.

**Fasi 6–11:** stesso schema. Indica le sezioni dello SPEC della fase e la fase da eseguire.

---

## Appendice C — Fonti principali

- Adobe Developer Blog (24/09/2026): transizione da CEP a UXP — https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications
- Community Adobe: stato di UXP per Illustrator nel 2026 — https://community.adobe.com/questions-652/clarification-needed-is-uxp-publicly-available-for-illustrator-in-2026-1548811
- Bolt CEP (Hyper Brew) — https://github.com/hyperbrew/bolt-cep
- Illustrator Scripting Guide, tracciati e forme — https://ai-scripting.docsforadobe.dev/scriptingJavascript/creatingPathsShapes/
- Guida CEP — https://ivg-design.github.io/cep/guide/developing-cep-extensions/
- Figma Plugin API: VectorNode, VectorPath, VectorNetwork — https://developers.figma.com/docs/plugins/api/VectorNode/
- Al-Sharadqah & Chernov, *Error analysis for circle fitting algorithms* (2009) — https://projecteuclid.org/journals/electronic-journal-of-statistics/volume-3/issue-none/Error-analysis-for-circle-fitting-algorithms/10.1214/09-EJS419.pdf
- Pomax, *A Primer on Bézier Curves* — https://pomax.github.io/bezierinfo/
- Concorrenti: GridMe https://gridme.in/ · panoramica Anchr https://anchr.tools/learn/best-illustrator-plugins-for-logo-designers · tydi https://tsmusty.gumroad.com/l/tydi
- Linyal (unica fonte primaria, didascalia del post di @kadlab) — https://www.instagram.com/kadlab/
