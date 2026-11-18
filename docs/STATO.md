# Compasso — Stato di avanzamento

Aggiornato da Claude Code a fine fase. Le decisioni stanno in `docs/SPEC.md` §2.

## Fase corrente
**Fasi 4–5 — Illustrator: lettura e disegno + release 0.1.0 (anteprima).** Codice pronto e verificato in
cloud; manca la **verifica in Illustrator**. Per gli utenti: README («Scarica e installa»). Per lo sviluppo:
guida qui sotto. «Fatto quando»: selezionando un logo in Illustrator l'anteprima è corretta e i numeri
coincidono con quelli dell'harness sullo stesso SVG.

### Fase 4 — guida per Windows (Illustrator 2026 v31.0)
1. Aggiorna e installa: `git pull`, poi `pnpm install` (Node LTS, `corepack enable`).
2. **Registro (debug delle estensioni non firmate)** — da fare a mano, Claude non lo tocca.
   Verifica prima quali versioni CEP ha registrato Illustrator: `reg query HKCU\Software\Adobe`
   (cerca le chiavi `CSXS.11`, `CSXS.12`…). Poi, sulla più alta (probabilmente 12):
   `reg add HKCU\Software\Adobe\CSXS.12 /v PlayerDebugMode /t REG_SZ /d 1 /f`
3. Attiva la **Modalità sviluppatore** di Windows (Impostazioni → Sistema → Per sviluppatori): serve ai symlink.
4. `pnpm -F illustrator build` → crea `apps/illustrator/dist/cep` e il collegamento nella cartella delle
   estensioni CEP dell'utente (se manca: `pnpm -F illustrator symlink`).
5. Riavvia Illustrator → **Finestra → Estensioni → Compasso**.
6. Sviluppo con ricarica automatica: `pnpm -F illustrator dev` (il pannello si collega a localhost:3000).
7. Debug: Chrome su `http://localhost:8860` (porta nel file `dist/cep/.debug`).
8. Prova: seleziona un logo → anteprima e numeri; apri lo stesso SVG nell'harness (`pnpm dev`) e confronta
   «N tracciati · N cerchi, N linee», anomalie e misure. Prova anche: tavola non all'origine, gruppi,
   tracciati composti, testo vivo (avviso, nessuna copia rimasta), maschere, tema chiaro/scuro.
   Il pulsante DISEGNA mostra «arriva con il prossimo aggiornamento» (Fase 5).

## Lavori da fare (concordati con Marco il 17/11/2026)

Fatto (0.3.0): **scheda CORREGGI** — `refine()` nel core (8 correzioni, intensità, report, idempotente),
anteprima Prima/Dopo/Confronto, applicazione su copia (layer «Compasso — Corretto») con ripristino,
pannello ridimensionabile a due colonne.
Fatto (0.4.0): **ovali** (modello `Ellipse`, fit diretto di Fitzgibbon/Halíř–Flusser, distanza
geometrica vera) in analisi, livelli, piano, anteprima, disegno ExtendScript e CORREGGI (con «ovali → cerchi»);
riconoscimento per tratti lisci interi (cerchio unico → greedy → ovale → quasi-cerchio) contro la
frammentazione dei ricalchi; test `traced.test.ts` con loghi ricalcati sintetici.
Fatto (0.5.0): **RICALCA** (`core/src/trace`: soglia adattiva + Otsu, chiusura, asole sottili,
Zhang–Suen, grafo dei tratti con punte acute e incroci, ricucitura degli spazi, ricampionamento,
media gaussiana, spigoli, rette ai minimi quadrati con spigoli esatti, Schneider, orientamento);
velocità (simmetria su griglia); «Segnala un problema» + `fixtures/reports`; esclusione di forme in
CORREGGI. Da fare: provare RICALCA su schizzi veri di Marco e tarare i valori predefiniti; GitHub
Pages non attivo (il sito in `site/` non è online).
Fatto (0.5.1): collaudo del ricalco con banco di prova (`pnpm bench:trace`, `trace-quality.test.ts`),
ablazione del metodo e correzioni (vedi `docs/RICALCO.md`); segnalazioni con schizzo; build del pannello
protetta da `pnpm typecheck` (svelte-check non riscrive più dist/).
Fatto (0.6.0): penna in RICALCA (`core/src/edit`), immagini incorporate/ritagliate/PSD via `imageCapture`.
Fatto (0.7.0): ricalco con meno punti agli incroci (`reduceAnchors`, direzione oltre l'incrocio,
ricucitura che guarda la direzione), storico unico tracciati+regolazioni con Indietro/Avanti e «Azzera
tutto»; ANALIZZA senza linee superflue (rette sopra un asse, doppioni paralleli, raccordi minuscoli: solo
in «dettaglio»/«tutto»; fixtures 06, 09, 11 aggiornate con l'ok di Marco); CORREGGI: simmetria riscritta
(asse sulla mediana delle coppie, maniglie speculari, gemello aggiunto all'anchor in più, passaggio
finale dopo gli archi), «Curve fluide» (tangenti continue sotto i 12°), corretto l'arco ricostruito sul
cerchio speculare sbagliato (foglie, mandorle).
Fatto (0.8.0): simmetria sulle forme (`core/src/fix/mirror.ts`) con «Metà da tenere» e spiegazione quando
non si applica; funziona sui ricalchi a mano (test `mirror.test.ts`). Prossimo: specifica di GENERA
(vedi `docs/MEMORIA.md`).

Da riprendere dopo, in quest'ordine di discussione:
1. **Collaudo con loghi reali** — 2–3 loghi veri in SVG (anche ricalcati da uno schizzo), checklist §10.4,
   regolazione delle soglie (oggi tarate solo su forme sintetiche) per ridurre i falsi allarmi.
2. **«Ricostruisci perfetto»** (flusso schizzo → ricalco), su una copia del logo: curve quasi circolari →
   archi esatti; quasi-rette raddrizzate e anchor allineati; simmetrie corrette. *(Confluisce in buona parte
   nella scheda CORREGGI.)*
3. **Rifinitura della v1.0** — impostazioni complete (colore della costruzione, estensione delle rette, nome
   del layer); casi limite (tracciati aperti, maschere, selezioni enormi); prestazioni; guida d'uso.
4. **Presentazione e lancio** — scheda PRESENTA (tavola di presentazione del logo, esportazione PNG/SVG/PDF);
   repository pubblico e pagina web online.

## Ambiente
- Fasi 1–3: sessione cloud Linux — Node 22, pnpm 10, Git.
- Illustrator (Fasi 4+): PC Windows dell'autore, **Illustrator 2027**.

## Fatto
- [x] Fase 0: `docs/SPEC.md`, `CLAUDE.md`, `docs/STATO.md`.
- [x] Fase 1:
  - monorepo pnpm, TypeScript strict, Vitest, fast-check, ESLint, Prettier;
  - `core/model.ts` (contratti §5.4);
  - `math/` (Vec2, bbox, Bézier, intersezioni);
  - `extract/` (parser path SVG M L H V C S Q T A Z, trasformazioni, `parseSvg()`);
  - `normalize.ts` (§6.2);
  - `fit/` (test kappa, Taubin con Newton, Kåsa come riserva, catene di archi greedy);
  - fixture 01–05 generate da `scripts/gen-fixtures.ts` (`pnpm fixtures:gen`) con la verità in `scripts/fixtures-def.ts`;
  - 57 test (unit, property, fixture, regole dei pacchetti) verdi; typecheck e lint verdi.

- [x] Fase 2:
  - `analyze()` completo: cerchi canonici (§6.4), rette con snap e righe/colonne di anchor (§6.5), relazioni (§6.6), assi di simmetria (§6.7), unità x e Specs (§6.8), findings a doppia soglia (§6.9), punteggio e livelli (§6.10);
  - `plan()` (§6.11) con marker, quadrato x e area di rispetto;
  - preset di tolleranza Rigida/Normale/Morbida (×0,5/×1/×2) in `tolerance.ts`;
  - fixture sintetiche 06 (O geometrica) e 09–12 aggiunte al generatore;
  - golden test (`scripts/golden.test.ts`) + `pnpm fixtures:update [--out dir]` che mostra le differenze;
  - `pnpm bench`; 164 test verdi (golden inclusi); typecheck e lint verdi;
  - `fixtures/expected/*.json` approvati e committati.

- [x] Fase 3 (preparazione): wireframe e mockup del pannello in Figma, **in attesa di approvazione** —
  https://www.figma.com/design/uBBzOGMjVLG4NpMkLePI1f
  - pagina *Wireframe*: bassa fedeltà annotata (§7.2);
  - pagina *Mockup*: 5 stati della tab ANALIZZA (Geometria, elenco aperto con hover, Anomalie, Misure dopo il disegno, stato vuoto);
  - token §7.3 come variabili Figma (collezione «Compasso · tokens»: colori, spazi, raggi);
  - componenti: Panel/Header, Panel/Tabs, Panel/SubTabs, Panel/Levels, Control/Slider, Button/Primary, List/ElementRow.

- [x] Fase 3:
  - `packages/ui`: `tokens.css` (§7.3 + misure dei componenti), `fonts.css` (Inter e JetBrains Mono in locale, OFL), `strings.ts` (EN predefinito, IT, plurali), `labels.ts` (nomi degli elementi, frasi dei findings), `preview.ts` (SVG del logo, viewBox, evidenziazione, testo «Copia misure»);
  - componenti Svelte 5 (§7.4): Header, TabBar, PreviewCard, ConstructionSvg, Segmented (frecce da tastiera), Slider (doppio clic = reset, frecce ±passo), ElementList (occhio includi/escludi, hover = evidenzia), FindingList (clic = evidenzia), SpecsView (unità x, bbox, raggi, rapporti, area di rispetto, copia), PrimaryButton (caricamento/disattivato), TextButton, EmptyState, Toast;
  - `Panel.svelte`: tab ANALIZZA completa; COSTRUISCI e PRESENTA mostrano «In arrivo»; ⚙ con lingua e tolleranza;
  - `apps/harness` (Vite): trascinamento SVG, scelta fixture, tavola con il layer disegnato, pannello a destra largo 320 px, analisi in Web Worker con indicatore dopo 300 ms, stati vuoto/caricamento/errore;
  - 177 test verdi (nuovi: testi EN/IT, nomi, findings, anteprima, copia misure); typecheck (tsc + svelte-check) e lint (ESLint + Prettier, anche `.svelte`) verdi;
  - verifica nel browser con Playwright: nessun errore in console.

- [x] Fase 4 (parte cloud):
  - `apps/illustrator` da Bolt CEP 2.2.3 (Svelte, solo ILST), id `com.marcodolce.compasso`, host `ILST [31.0,99.9]`, CSXS 11.0, pannello 320×720 (min 280×420), icone proprie;
  - Bolt resta con le sue versioni (Vite 6, plugin Svelte 5, TS 5.9) dentro il monorepo e importa `@compasso/core` e `@compasso/ui` via workspace (§5.2);
  - `src/jsx/ilst/extract.ts`: estrazione §6.1 (gruppi, composti, testo vivo su copia poi eliminata, maschere ignorate, guide/nascosti esclusi, Y invertita rispetto alla tavola attiva, avvisi §4.6); `ilst.ts`: `extractSelection`, `getSelectionFingerprint`, `getDocInfo` (una evalScript ciascuna); ExtendScript in TS → ES3 con Babel + json2;
  - pannello: polling dell'impronta ogni 800 ms (sospeso se il pannello è nascosto; refresh su cambio documento), conferma oltre 3.000 anchor, analisi in worker incluso nel bundle con ripiego nel thread del pannello, tema sincronizzato (token chiari per le interfacce chiare);
  - test: parità harness ↔ Illustrator su tutte le fixture con tavola fuori origine; casi limite; il bundle ES3 compilato eseguito in una sandbox Node con un finto `app`. 219 test verdi; typecheck e lint verdi.
- Evento di cambio selezione (§8.4): Illustrator non ne espone uno ai pannelli CEP, quindi si usa il polling dell'impronta.

- [x] Fase 5 (parte cloud): `drawPlan`, `removeConstruction`, `hasConstruction` (§8.1–8.3) in `src/jsx/ilst/draw.ts`: layer «Compasso — Construction» in cima con sotto-layer Circles/Lines/Axes/Markers/Specs, nomi `circle#c3 r=…`, grigio K60 (CMYK) o #7A7A7A (RGB), assi tratteggiati, quadrato x K20 con etichetta, layer bloccato; RIDISEGNA sostituisce, Rimuovi elimina; gli oggetti del layer di costruzione sono esclusi dall'analisi; l'impronta riporta anche la presenza del layer (DISEGNA/RIDISEGNA coerente dopo Ctrl+Z). Testato sul bundle ES3 compilato con un finto DOM.
- [x] Distribuzione 0.2.0 (10/11/2026, solo Windows):
  - `installer/compasso.iss` → **`Compasso-Setup.exe`** (Inno Setup): copia il pannello firmato in `%APPDATA%\Adobe\CEP\extensions\com.marcodolce.compasso`, senza amministratore e senza toccare il registro di Adobe; disinstallazione da «App installate»;
  - la firma (certificato self-signed, strumento Adobe incluso in Bolt) resta dietro le quinte: Illustrator carica solo pannelli firmati; l'utente non vede né ZXP né altri strumenti;
  - `.github/workflows/release.yml`: push su `main` con versione nuova → build e firma su Windows, verifica della firma, compilazione dell'installer, **prova di installazione, aggiornamento e disinstallazione**, pubblicazione di `Compasso-Setup.exe` e `Compasso-Diagnostica.bat`; ritiro delle release 0.1.x;
  - verifica end-to-end del pannello compilato in Chromium con un finto Illustrator che esegue il vero script ES3 (lettura, analisi nel worker, disegno, ridisegno, rimozione, cambio selezione, tema, font);
  - corretti: nome del layer non ASCII nello script (ora bundle solo ASCII, con test), analisi che poteva restare bloccata se il worker falliva, errori durante la modifica di un testo; lingua iniziale dall'host;
  - nota: `pnpm -F illustrator build` produce il pannello di sviluppo (punta a localhost:3000); quello distribuibile è `pnpm -F illustrator zxp` (solo Windows/macOS).

## Da fare
- [ ] Verifica in Illustrator 2027 su Windows (Marco): `Compasso-Setup.exe`, lettura, anteprima, disegno, checklist §10.4.
- [ ] Se il pannello firmato non venisse caricato: piano B = PlayerDebugMode (da decidere con Marco).
- [ ] Rendere il repository pubblico (o scegliere un altro canale, D10) perché chiunque possa scaricare; attivare GitHub Pages.

## Proposte aperte (da decidere)
- **Flusso «schizzo a mano → foto → Ricalco immagine → Compasso» (idea di Marco, 10/11/2026).** È il caso d'uso principale. Conseguenze:
  1. calibrare le soglie su loghi *ricalcati* (molti anchor, curve irregolari): servono fixture vere (15 «logo a mano») e forse un preset dedicato «Ricalco» più morbido di Morbida;
  2. anticipare **«Ricostruisci perfetto»** (Fase 8, §4.3): su una copia, sostituire le curve quasi circolari con archi esatti, raddrizzare le quasi-rette, allineare gli anchor quasi in riga, simmetrizzare. È ciò che rende il logo «preciso e perfetto»;
  3. anomalie raggruppate per tipo (sui ricalchi saranno decine).
  Proposta di ordine: MVP (Fasi 4–5) → «Ricostruisci perfetto» subito dopo, prima di Misure/rifinitura.

## Decisioni prese durante lo sviluppo
- **Livello Essenziale e pari merito (approvato 10/11/2026):** raggiunto il 60% di L_tot (§6.10), entrano ancora gli elementi con punteggio uguale all'ultimo incluso. Golden aggiornati: 05 (4° cerchio) e 11 (una retta).

## Report di calibrazione (Fase 2)

Preset Normale, valori iniziali del §6.9 invariati.

| Fixture | Cerchi | Rette | Assi | Findings | Unità x |
|---|---|---|---|---|---|
| 01 cerchio | 1 | 0 | 2 | — | — |
| 02 arco 90° | 1 | 0 | 0 | — | — |
| 03 arco 3 cubiche | 1 | 0 | 0 | — | — |
| 04 quasi-cerchio | 1 | 0 | 0 | near-arc 1,03 pt | — |
| 05 rett. arrotondato | 4 | 8 | 2 | — | — |
| 06 lettera O | 2 | 2 | 2 | — | 24,00 (alta) |
| 09 simmetrico | 1 | 6 | 1 (x=100) | — | — |
| 10 quasi-simmetrico | 1 | 6 | 0 | near-symmetry 1,5 pt · near-angle 0,73° | — |
| 11 fuori riga | 0 | 11 | 0 | near-row 0,30 pt | 40 (alta) |
| 12 diagonali | 0 | 10 | 0 | — | 14,14 (alta) |

Tutte le fixture esatte sono "pulite" (zero findings) e ogni errore inserito viene trovato con il delta giusto.

**Robustezza al rumore** (anchor spostati a caso di ±a pt, D ≈ 110–230 pt):

| Rumore | Findings totali sulle 10 fixture | Note |
|---|---|---|
| 0 | 4 (tutti veri) | |
| ±0,02 pt | 6 | |
| ±0,1 pt | 23 | 18 sono near-row/near-column |
| ±0,3 pt | 44 | cerchi e assi restano stabili |

**Osservazioni e proposte (da decidere con le fixture 15–16 disegnate a mano):**
- ε_row stretta = max(0,02 pt; 0,005% D) è molto rigida: su un logo disegnato a mano quasi ogni coppia di anchor vicina diventa un near-row. È voluto (sono errori reali), ma potrebbe essere rumore per l'utente. Proposta: valutare 0,05 pt o 0,02% D dopo i test reali.
- Cerchi, rette e assi restano stabili fino a ±0,3 pt: le soglie di arco, centro e raggio sembrano adeguate.
- Prestazioni (`pnpm bench`): 200 anchor → ~10 ms (obiettivo 150), 2.000 anchor → ~470 ms (obiettivo 1.500). Clustering ancora O(n²) tranne la simmetria (griglia spaziale): margine sufficiente.

## Note e decisioni emerse
- **Dipendenze aggiunte** (dev, root): typescript (fissato a ~6.0: typescript-eslint non supporta ancora TS 7), vitest, fast-check, eslint, @eslint/js, typescript-eslint, prettier, tsx, @types/node.
- **Contratti §5.4:** copiati identici, con una sola aggiunta: `WarningCode` era usato ma non definito; ho scritto l'unione minima (`live-text-outlined | clip-ignored | stroke-centerline | too-many-anchors`). Da confermare.
- `analyze()` e `plan()` non esistono ancora (sono Fase 2); l'API pubblica per ora espone `parseSvg`, `normalizeGeometry`, `detectArcs` e i fit.
- Gli indici dei segmenti nei `SegmentRef` si riferiscono ai segmenti **dopo la normalizzazione** (i degeneri vengono rimossi).
- `detectArcs` restituisce `quality: 'arc'` (entro ε stretta, o kappa esatto) oppure `'near-arc'` (candidato finding). Tolleranze del preset Normale: strict 0,15% D, wide 0,8% D ([DA CALIBRARE] in Fase 2).
- Il bbox si calcola sulle curve campionate (16 punti per cubica), non sui punti di controllo.
- Fixture 04: un quarto di cerchio con maniglie ×1,26 → scarto 1,03 pt dal miglior cerchio (≈1,3% del raggio), tra le due soglie: dà 1 arco da 270° + 1 near-arc.
- Il file `.debug`, il registro di Windows e Bolt CEP non sono toccati in questa fase.
- **Fase 3, dipendenze aggiunte:** svelte, vite, @sveltejs/vite-plugin-svelte, svelte-check, eslint-plugin-svelte, prettier-plugin-svelte, globals, @fontsource/inter, @fontsource/jetbrains-mono (previste da D4/D5/§5.3).
- **Fase 3, scelte:** `plan()` mette il quadrato x fuori anche dall'area di rispetto quando è disegnata; i quadratini agli angoli dell'area non hanno etichetta. L'anteprima usa un viewBox stabile (calcolato sul livello Tutto), così non "salta" cambiando livello. Le tavole dell'harness mostrano anche gli oggetti fuori tavola. Un nuovo file azzera il layer disegnato; cambiare tolleranza no.
- **Contratto §5.4 esteso (approvato 09/11/2026):** `AnalysisResult.artboard?` (copiata da `DocumentGeometry.artboard`). `plan()` con `lineExtent: 'artboard'` estende le rette fino al bordo della tavola; senza tavola ricade su bbox + 25%. `parseSvg()` legge la tavola dal `viewBox` del `<svg>` radice, altrimenti da `width`/`height`. Anche `WarningCode` approvato.
- **Fase 2, scelte di interpretazione** (confermate da Marco il 09/11/2026):
  - estensione delle rette "bbox + 25%" = margine del 12,5% del lato maggiore su ogni lato;
  - righe di anchor: gli estremi dei cerchi (cx ± r, cy ± r) contano solo se non coincidono (entro ε_c) con un anchor; una guida nasce con ≥ 3 punti, ≥ 1 anchor reale e ≥ 2 provenienze;
  - gli assi si cercano su anchor + punti medi dei segmenti (più robusto dei soli anchor); gli assi validi quasi coincidenti si fondono;
  - archi sotto gli 8°: peso 0,25 nella media del cerchio canonico;
  - unità x: classe mobile larga l'1% di D (invece di classi fisse), valore = media pesata della classe modale;
  - rapporti dei raggi: si riportano le coppie consecutive e tutte quelle vicine (±1%) a 1,618 · 1,414 · 2 · 1,5;
  - id: `c1…` cerchi, `l1…` rette, `ax1…` assi, `rel1…` relazioni, `f1…` findings, `m:<cerchio>` / `t:<relazione>` marker, `unit-x`;
  - la fixture 06 è una O geometrica generata; si può sostituire con una disegnata.
