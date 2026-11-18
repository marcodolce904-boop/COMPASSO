# Ricalco degli schizzi (scheda RICALCA)

Come Compasso trasforma un disegno a matita in tracciati puliti, e quanto conta ogni passo.
I numeri vengono dal banco di prova: `pnpm bench:trace` (10 figure con forma vera nota, 3 livelli
di difficoltà, 3 disegni per figura). Il test `trace-quality.test.ts` blocca i peggioramenti.

## Il metodo

L'idea di partenza (Marco, 17/11/2026): «un calcolo di approssimazione medio tra punti tenendo
conto della distanza media tra essi, la direzione ed il verso, facendo un calcolo orario della
forma». Nel motore diventa:

1. **Inchiostro.** Soglia adattiva (un pixel è matita se è più scuro dei vicini) più soglia di
   Otsu per le zone piene; resiste a ombre e luce non uniforme.
2. **Tratti fusi.** Le passate vicine si uniscono (chiusura morfologica); le asole sottili tra
   passate parallele e i buchetti più piccoli di ~2,5 spessori si riempiono; sporco e puntini via.
3. **Linea centrale** (Zhang–Suen) e grafo dei tratti: estremi, incroci (gli incroci sdoppiati
   diventano uno), punte acute ricostruite, rametti di rumore tolti, tratti che quasi si toccano
   ricuciti, doppioni eliminati, estremi aperti riportati fino in fondo al segno.
4. **Distanza media** → ricampionamento a passo costante (1 px).
5. **Media tra punti** → ogni punto diventa la media pesata dei vicini (gaussiana, più vicini
   pesano di più), con una parabola locale che toglie il tremolio senza appiattire le curve.
6. **Direzione** → spigoli dove la direzione cambia più di un angolo, misurato su due finestre
   (lo spigolo arrotondato dalla matita si misura per intero, una curva stretta non conta).
7. **Curve minime.** Tra due spigoli: retta ai minimi quadrati se il pezzo è dritto, altrimenti
   il minimo di curve di Bézier (Schneider) entro la precisione, ognuna con al massimo 120° di
   rotazione (il cerchio ha 4 anchor), poi le curve vicine si uniscono se la precisione regge.
   Due rette consecutive si incontrano nel punto d'intersezione esatto.
8. **Verso** → forme esterne in senso orario, buchi in senso antiorario (riempimenti corretti
   in Illustrator).

## Quanto conta ogni passo (ablazione)

Medie su tutte le figure. Scarto = distanza del ricalco dalla forma vera (px); anchor rispetto
al minimo ideale di un designer; spigoli = distanza degli spigoli veri dall'anchor più vicino.

| Livello difficile (passate multiple, tremolio, spazi aperti, ombre, sporco) | scarto | scarto max | anchor/ideale | spigoli | verso ok |
| --------------------------------------------------------------------------- | ------ | ---------- | ------------- | ------- | -------- |
| metodo completo                                                             | 1,7    | 5,1        | 0,97          | 2,8     | 100%     |
| senza media tra punti                                                       | 2,4    | 8,0        | 1,25          | 5,6     | 100%     |
| senza ricampionamento (distanza media)                                      | 1,6    | 6,9        | 0,96          | 6,8     | 100%     |
| senza direzione (spigoli)                                                   | 2,1    | 9,7        | 1,32          | 12,9    | 100%     |
| senza spigoli esatti                                                        | 1,6    | 6,2        | 0,97          | 4,0     | 100%     |
| senza verso (orario)                                                        | 1,7    | 5,1        | 0,97          | 2,8     | 58%      |

Lettura:

- **Media tra punti**: senza, gli anchor crescono del 30–60% e l'errore sugli spigoli raddoppia.
- **Distanza media (ricampionamento)**: dimezza l'errore sugli spigoli e toglie i pezzi mancanti.
- **Direzione**: è il passo che conta di più per gli spigoli (errore ×4–5 senza).
- **Verso**: non cambia la forma, ma senza metà delle forme con buchi si riempirebbe male.

## Prima e dopo il collaudo del 17/11/2026 (livello difficile)

| | scarto max | spigoli | anchor/ideale | tracciati giusti |
| --- | --- | --- | --- | --- |
| prima | 16,9 px | 6,6 px | 0,96 | 100% (ma con spuntoni e punte perse) |
| dopo | 5,1 px | 2,8 px | 0,97 | 100% |

Correzioni: curve con rotazione massima (cerchi a 4 anchor), unione di curve vicine, controlli
più severi su punte e spigoli esatti, anelli con codino (punte acute di forme chiuse), incroci
sdoppiati, doppioni, estremi aperti, buchetti nella traccia, misura degli spigoli su due finestre,
partenza degli anelli dal punto più curvo.

## Immagini piccole e immagini nel documento

- Sotto i 450 px l'immagine si ingrandisce (bilineare, fino a ~900 px) prima del ricalco: sul banco di
  prova a 1/3 della risoluzione l'errore sugli spigoli scende da 3,1 a 2,8 px. Sopra non serve.
- Immagini incorporate, ritagliate o in formati non leggibili dal pannello (PSD, TIFF…): Illustrator ne
  fa una "foto" PNG dell'area visibile (`Document.imageCapture`, ~1600 px sul lato lungo, tra 72 e
  600 ppi) in un file temporaneo, che il pannello legge e cancella.

## Penna

Le modifiche a mano (`core/src/edit`) sono funzioni pure: aggiungere un punto divide la curva con
de Casteljau (forma identica); togliere un punto ricalca le due curve con una sola (minimi quadrati,
tangenti di prima); spostare una maniglia di un punto curvo muove l'opposta.

Lo storico è unico: ogni passo ricorda i tracciati modificati **e** le regolazioni. «← Indietro» e
«Avanti →» attraversano sia i ritocchi con la penna sia i movimenti delle barre (i movimenti ravvicinati
della stessa barra contano come un passo). Cambiare le regolazioni azzera le modifiche a mano, che restano
recuperabili con Indietro. «× Azzera tutto» rimette le barre ai valori iniziali senza togliere lo schizzo.

## Punti di troppo agli incroci

Dove un tratto ne incrocia un altro (es. la coda che passa dietro la gamba di una A) la linea centrale
forma un piccolo grumo. Tre accorgimenti evitano anchor in più e tracciati spostati:

- la direzione di ogni ramo si misura **oltre** il grumo, così i rami giusti vengono accoppiati;
- la ricucitura dei tratti vicini preferisce i capi che si guardano (costo = distanza + spazio ×
  (1 + coseno)); un tracciato si chiude su se stesso solo se i capi sono allineati;
- dopo il calcolo delle curve, due curve consecutive si fondono se l'angolo tra loro è sotto i 25° e la
  curva unica resta entro la precisione (`reduceAnchors`).

Sul banco di prova c'è la figura «A dietro la coda».

## Segnalazioni

«⚙ → Segnala un problema» con uno schizzo caricato salva anche lo schizzo (scala di grigi) e le
regolazioni. Il file va in `fixtures/reports/` con `expect.tracePaths` / `expect.traceAnchors` e
diventa un test fisso (`reports.test.ts`).
