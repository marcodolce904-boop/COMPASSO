# Compasso — Stato di avanzamento

Aggiornato da Claude Code a fine fase. Le decisioni stanno in `docs/SPEC.md` §2.

## Fase corrente
**Fase 1 — Fondamenta del motore: completata.** Prossima: Fase 2 (motore completo v1, modello consigliato Opus).

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

## Da fare
- [ ] Fase 2 — cerchi canonici, rette, relazioni, simmetrie, unità x, findings, punteggio, `plan()`, golden test, benchmark, calibrazione.

## Note e decisioni emerse
- **Dipendenze aggiunte** (dev, root): typescript (fissato a ~6.0: typescript-eslint non supporta ancora TS 7), vitest, fast-check, eslint, @eslint/js, typescript-eslint, prettier, tsx, @types/node.
- **Contratti §5.4:** copiati identici, con una sola aggiunta: `WarningCode` era usato ma non definito; ho scritto l'unione minima (`live-text-outlined | clip-ignored | stroke-centerline | too-many-anchors`). Da confermare.
- `analyze()` e `plan()` non esistono ancora (sono Fase 2); l'API pubblica per ora espone `parseSvg`, `normalizeGeometry`, `detectArcs` e i fit.
- Gli indici dei segmenti nei `SegmentRef` si riferiscono ai segmenti **dopo la normalizzazione** (i degeneri vengono rimossi).
- `detectArcs` restituisce `quality: 'arc'` (entro ε stretta, o kappa esatto) oppure `'near-arc'` (candidato finding). Tolleranze del preset Normale: strict 0,15% D, wide 0,8% D ([DA CALIBRARE] in Fase 2).
- Il bbox si calcola sulle curve campionate (16 punti per cubica), non sui punti di controllo.
- Fixture 04: un quarto di cerchio con maniglie ×1,26 → scarto 1,03 pt dal miglior cerchio (≈1,3% del raggio), tra le due soglie: dà 1 arco da 270° + 1 near-arc.
- Il file `.debug`, il registro di Windows e Bolt CEP non sono toccati in questa fase.
