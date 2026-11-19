# PERFEZIONA — specifica breve (bozza da approvare)

_19/11/2026. Nasce dai video di presentazione: lì il «perfezionamento» è stato fatto con script fuori
dal plugin. Questa funzione lo porta dentro Compasso, così il plugin fa davvero quello che i video
mostrano._

## 0. Principio

**Il disegno resta quello.** Perfeziona non reinterpreta: ricalca fedelmente e poi rende esatto.
- Ogni contorno diventa una **catena di archi di cerchio tangenti**: niente spigoli dove il disegno
  è morbido; spigoli solo dove il disegno ha una punta.
- Lo scarto massimo dal disegno è una **tolleranza** dichiarata (in % della diagonale D).
- Se il disegno è quasi simmetrico, le due metà diventano **identiche** (opzione, attiva di base).
- Le **costruzioni** (i cerchi degli archi e l'asse) si possono disegnare su un livello a parte, come
  in ANALIZZA.

## 1. Dove sta nel pannello

Proposta: **terza modalità di RICALCA**, accanto a «Linee» e «Forme piene»:
`Linee · Forme piene · Perfeziona`.
- Parte dall'immagine (schizzo, scansione, foto o immagine piccola) come le altre modalità.
- Esce con tracciati pieni (forme e fori), come «Forme piene».

Variante da decidere: la stessa correzione anche in **CORREGGI** sui tracciati vettoriali già esistenti
(«Archi tangenti»: campiona il tracciato e lo rifà ad archi).

## 2. Come funziona (il metodo dei video)

1. **Campo morbido dalle sfumature.** Il contorno si calcola dal grigio dell'immagine, ingrandita e
   leggermente sfumata, non da una maschera bianco/nero. Bordi sotto il pixel e niente scalini, anche
   da immagini piccole (il gufo: 144 px di partenza).
2. **Simmetria sul campo.** Si cerca l'asse verticale (poi anche orizzontale) che rende il campo più
   simile al suo riflesso; se lo scarto è entro la soglia, il campo diventa la media con il riflesso.
   Le due metà escono identiche per costruzione. Nota nel report: asse trovato / non trovato.
3. **Contorni.** `isoContours` al livello 0 (forme piene e fori, come «Forme piene»).
4. **Spigoli.** Punti dove la direzione gira bruscamente (punte di orecchie, becco, coda).
5. **Archi tangenti.** Tra due spigoli: la catena di biarchi più lunga possibile entro la tolleranza
   (stesso criterio dei video). Archi consecutivi sullo stesso cerchio si fondono.
6. **Uscita.** Ogni arco diventa cubiche (al massimo 90° l'una), come Strutturato in GENERA.

Riuso: `signedField`, `isoContours`, `arcToCubics`, l'orientamento dei fori già in `trace.ts`.
Nuovo: campo da grigio, simmetria sul campo, catena di biarchi con spigoli (in `core/src/trace/`).

## 3. Regolazioni

| Regolazione | Valori | Base |
|---|---|---|
| Precisione (tolleranza) | da 0,1% a 1% di D | 0,3% |
| Simmetria | Auto · Verticale · Orizzontale · No | Auto |
| Morbidezza del bordo | da 0 a 100% | 50% |
| Disegna la costruzione | sì / no | no |

## 4. Report nel pannello

«12 forme · 289 archi · simmetria verticale · scarto max 0,4 pt»; se la simmetria è rifiutata:
«simmetria non applicata: lati troppo diversi».

## 5. Test (prima del codice)

- Cerchio, ellisse, forma a goccia rasterizzati piccoli: un cerchio → 1 arco (o 2), scarto < tolleranza.
- Forma simmetrica disturbata a mano: dopo Perfeziona le metà coincidono entro 0,05% di D.
- Forma con punte (stella, becco): gli spigoli restano spigoli, il resto è G1 (tangenti continue).
- Golden sui riferimenti dei video (gufo, maneki-neko): numero di forme e fori uguale all'originale.
- Bench del ricalco invariato per «Linee» e «Forme piene».

## 6. Fuori da questa versione

- Morph animato prima/dopo nel pannello (c'è già la tendina di confronto da fare, §4 della memoria).
- Simmetria radiale.
