# Compasso — Stato di avanzamento

Aggiornato da Claude Code a fine fase. Le decisioni stanno in `docs/SPEC.md` §2.

## Fase corrente
**Fase 2 — Motore completo v1: implementata.** In attesa dell'approvazione dei JSON attesi
(`fixtures/expected/`) per attivare i golden test. Poi: Fase 3 (harness web e UI, Sonnet).

## Ambiente
- Fasi 1–3: sessione cloud Linux — Node 22, pnpm 10, Git.
- Illustrator (Fasi 4+): PC Windows dell'autore. Versione esatta di Illustrator 2026: **da annotare** (Aiuto → Informazioni su Illustrator).

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
  - `pnpm bench`; 151 test verdi (10 golden saltati finché mancano i JSON attesi); typecheck e lint verdi.

## Da fare
- [ ] Approvare e committare `fixtures/expected/*.json` (golden test).
- [ ] Fase 3 — harness web e UI del pannello.

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
- **Fase 2, scelte di interpretazione** (da confermare):
  - estensione delle rette "bbox + 25%" = margine del 12,5% del lato maggiore su ogni lato;
  - `lineExtent: 'artboard'` per ora ricade su bbox + 25%: `AnalysisResult` non contiene la tavola. Per supportarla serve aggiungere la tavola al contratto (§5.4) → da approvare;
  - righe di anchor: gli estremi dei cerchi (cx ± r, cy ± r) contano solo se non coincidono (entro ε_c) con un anchor; una guida nasce con ≥ 3 punti, ≥ 1 anchor reale e ≥ 2 provenienze;
  - gli assi si cercano su anchor + punti medi dei segmenti (più robusto dei soli anchor); gli assi validi quasi coincidenti si fondono;
  - archi sotto gli 8°: peso 0,25 nella media del cerchio canonico;
  - unità x: classe mobile larga l'1% di D (invece di classi fisse), valore = media pesata della classe modale;
  - rapporti dei raggi: si riportano le coppie consecutive e tutte quelle vicine (±1%) a 1,618 · 1,414 · 2 · 1,5;
  - id: `c1…` cerchi, `l1…` rette, `ax1…` assi, `rel1…` relazioni, `f1…` findings, `m:<cerchio>` / `t:<relazione>` marker, `unit-x`;
  - la fixture 06 è una O geometrica generata; si può sostituire con una disegnata.
