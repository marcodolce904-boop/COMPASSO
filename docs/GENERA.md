# GENERA — specifica

_Approvata da Marco il 18/11/2026 («ok a tutte le proposte» del §8). Matematico e Minimal
realizzati nella 0.10.0._
_Primo rilascio previsto: modalità **Matematico** e **Minimal**. Le altre (Simmetrico, Sezione aurea,
Strutturato) seguono con le stesse regole di base._

## 0. PRINCIPIO (cambiato da Marco il 19/11/2026: vale su tutto il resto del documento)

> «La versione GENERA non deve assomigliare troppo all'originale: se serve lo stravolge completamente,
> verso la correttezza matematica. Deve renderlo **canonico** ai parametri che gli diamo: con la sezione
> aurea deve essere perfettamente canonico alla sezione aurea, e così via.» (Marco)

Quindi:
- **Nessuna guardia di somiglianza di base.** Lo «scarto massimo» diventa un'opzione **spenta di base**
  («Limita lo stravolgimento»). Solo se la si accende valgono le attenuazioni dei paragrafi sotto
  (griglia più fine, regole saltate, intensità ridotta).
- **Ricostruzione, non ritocco.** Ogni tracciato diventa una **costruzione**: rette, archi di cerchio e
  raccordi. Le curve libere diventano archi tangenti, come in Strutturato. Un **risolutore** impone la
  regola a tutto il logo insieme e tiene esatti i raccordi tangenti, così il risultato resta continuo.
- **Regole canoniche, senza eccezioni:**

  | Modalità | Regola |
  |---|---|
  | **Sezione aurea** | ogni raggio (anche degli archi delle curve) nella serie R/φᵏ del più grande; angoli delle rette a multipli di 18° (la famiglia dei triangoli aurei: 36°, 72°…); centri, rette orizzontali e verticali sulla griglia aurea |
  | **Matematico** | ogni raggio multiplo del passo (m/2); centri e spigoli sulla griglia del modulo; angoli a multipli dell'angolo base |
  | **Strutturato** | tutto archi e rette; raggi simili (entro il 12%) unificati; centri vicini resi coincidenti; raccordi tangenti esatti |
  | **Simmetrico** | riflette sempre la metà migliore rispetto all'asse più plausibile |
  | **Minimal** | semplificazione forte di base, poi archi e rette |

- La **somiglianza** resta nel riepilogo solo come informazione («quanto è cambiato»), non come limite.

## 1. Cos'è

Una scheda nuova, **GENERA**, accanto ad ANALIZZA, CORREGGI e RICALCA.

- Prende il logo selezionato e ne propone **versioni ricomposte**, ognuna secondo una regola precisa.
- Le versioni si vedono **affiancate all'originale**, con la costruzione che le giustifica.
- Si sceglie una versione e si applica su una **copia**, come in CORREGGI: l'originale resta, nascosto.

È diversa da CORREGGI. CORREGGI **toglie le imperfezioni**: un cerchio quasi giusto diventa giusto.
GENERA **impone una regola** anche dove il disegno non la seguiva: tutti i raggi diventano multipli di
un modulo, tutte le inclinazioni multipli di 15°. Per questo può cambiare il logo di più, e ha sempre
un limite di riconoscibilità.

## 2. Regole comuni a tutte le modalità

1. **Si parte dal logo già corretto.** Prima di ogni modalità si applica CORREGGI con i valori
   predefiniti. Le regole lavorano su geometria pulita, non su tremolii.
2. **Riconoscibilità garantita.** Ogni versione deve restare entro lo **scarto massimo**: la distanza
   massima di ogni punto del contorno dall'originale, in % della diagonale del logo (D).
   - Valore di base: **3% di D**.
   - Se una regola supererebbe lo scarto, quella regola **si applica di meno** (intensità ridotta
     automaticamente) o **si salta su quell'elemento**, e il riepilogo lo dice.
   - Sotto ogni anteprima compare la **somiglianza**: 100% meno lo scarto medio in % di D
     (es. «somiglianza 98%»).
3. **Stessi tracciati.** Il numero di tracciati non cambia mai: Illustrator scrive la copia tracciato
   per tracciato. I punti dentro ogni tracciato possono cambiare.
4. **Spiega cosa ha fatto.** Ogni anteprima ha un riepilogo di una riga, ad esempio «6 angoli a
   multipli di 15° · 3 raggi a multipli del modulo · somiglianza 97%».
5. **Spiega cosa non ha fatto.** Se una modalità non ha senso per il logo, l'anteprima lo dice al posto
   del logo (es. Simmetrico su un logo asimmetrico: «Nessun asse plausibile»).
6. **Deterministico.** Stesso logo e stessi parametri danno sempre lo stesso risultato.
7. **Parametri comuni:**
   - **Intensità**: da 0% (originale corretto) a 100% (regola piena), base 100%;
   - **Scarto massimo**: da 0,5% a 10% di D, base 3%.

## 3. Modalità MATEMATICO

Idea: il logo come se fosse stato disegnato con riga, squadra e compasso **su un modulo**.

### Il modulo (m)

- **Automatico** (base): l'unità x che ANALIZZA già trova (spessore ricorrente dei tratti, `specs.unitX`).
  Se manca, D/24 arrotondato a 0,5 pt.
- **Manuale**: un valore in pt scelto da Marco.
- **Suddivisione**: tutte le misure possono essere multipli di m/2 (base) oppure di m. Con m/2 il logo
  cambia meno.

### Regole, in quest'ordine

1. **Angoli.** Ogni retta del logo viene ruotata al multiplo più vicino dell'**angolo base**: 15° di
   base, oppure 30°, 45° o 90° (solo orizzontali e verticali).
   - La rotazione avviene intorno al centro del tratto.
   - Le rette che erano quasi parallele (entro 3°) **diventano parallele** e prendono lo stesso angolo,
     anche se non è un multiplo (es. le due gambe della A restano inclinate uguali tra loro).
2. **Raggi.** Ogni cerchio vero ha un raggio multiplo di m/2 (o di m). I cerchi con lo stesso raggio
   restano uguali. Gli archi delle curve libere (0.9.0) **non** si toccano in questa modalità.
3. **Posizioni.** Centri dei cerchi, punti d'incontro tra rette e anchor degli spigoli vanno sulla
   **griglia del modulo**, con origine nell'angolo in alto a sinistra del logo.
   - Prima si sistemano gli spigoli, poi le rette si ricollegano agli spigoli spostati.
   - Le curve tra due anchor spostati si deformano in modo dolce: le maniglie seguono gli anchor.
4. **Spessori.** Dove il logo ha tratti di spessore quasi uguale (es. le gambe di una lettera),
   lo spessore diventa lo stesso multiplo del modulo.

### Cosa mostra l'anteprima

Il logo ricomposto, la **griglia del modulo** (leggera), le rette con il loro angolo e i cerchi con il
raggio («r = 6m»).

### Parametri

- angolo base (15° · 30° · 45° · 90°);
- modulo (automatico o valore) e suddivisione (m o m/2);
- quali regole applicare: angoli, raggi, posizioni, spessori (tutte attive di base).

## 4. Modalità MINIMAL

Idea: **lo stesso logo con meno di tutto**: meno anchor, curve più semplici, niente dettagli superflui.

### Regole, in quest'ordine

1. **Curve semplici.**
   - I tratti quasi circolari diventano archi esatti; i quasi dritti diventano rette (stesse soglie di
     CORREGGI, ma più larghe: 1,5% di D invece di 0,8%).
   - Le curve libere vengono rifatte con il **minimo di curve di Bézier** entro lo scarto massimo: si
     riusa il motore del ricalco, che sa già farlo.
2. **Meno anchor.**
   - Due curve consecutive si fondono quando la curva unica resta entro lo scarto.
   - Rette consecutive allineate diventano una.
   - Gli anchor in mezzo a una curva liscia, che non servono a definirla, si tolgono.
3. **Dettagli.** Le piccole irregolarità del contorno (gobbe, rientranze, smussi minuscoli sotto
   l'1,5% di D) vengono **appiattite**. Le forme piccole intere **non si cancellano** (il numero di
   tracciati non cambia): vengono semplificate al massimo e l'anteprima le segnala («2 forme molto
   piccole: valuta se toglierle»).
4. **Spigoli.** Gli spigoli veri restano spigoli. Gli smussi minuscoli (raccordi sotto l'1% di D)
   tornano spigoli vivi.

### Cosa mostra l'anteprima

Il logo semplificato con gli **anchor visibili** e il conteggio prima/dopo: «anchor 64 → 22 (−66%)».

### Parametri

- **Numero massimo di anchor**: facoltativo. Se impostato, le regole si ripetono con soglie via via più
  larghe finché si scende sotto il numero, sempre entro lo scarto massimo; altrimenti si ferma e dice
  quanti ne restano.
- **Livello di semplificazione**: leggero · medio (base) · forte. Sposta insieme le soglie delle
  regole 1–4.

## 5. La scheda nel pannello

```
GENERA
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  ORIGINALE   │ │  MATEMATICO  │ │   MINIMAL    │
│  (corretto)  │ │  + griglia   │ │  + anchor    │
│              │ │              │ │              │
│ 64 anchor    │ │ somigl. 97%  │ │ 64 → 22      │
└──────────────┘ └──────────────┘ └──────────────┘
  riepilogo della versione scelta (una riga)
  ▸ Parametri di Matematico     (tendina)
  ▸ Parametri di Minimal        (tendina)
  Intensità ───●──   Scarto massimo ──●─── 3%
  [ APPLICA SU UNA COPIA ]
```

- **Clic su un'anteprima**: si seleziona e si ingrandisce nella vista grande (con zoom e
  spostamento, come le altre schede).
- **Confronto**: nella vista grande c'è il pulsante «Confronta». L'originale appare come contorno
  sottile sotto la versione, così si vede cosa è cambiato.
- **Tendina per ogni modalità** con i suoi parametri, chiusa di base: chi non vuole regolare niente
  non vede niente.
- **Applica** crea la copia nel layer «Compasso — Generato» e la seleziona. Il layer è distinto da
  quello di CORREGGI, così si possono tenere entrambe le versioni.
- Le anteprime si ricalcolano quando cambia la selezione o un parametro, nel worker (il pannello non
  si blocca). Obiettivo: meno di 1 secondo per un logo da 200 anchor.

## 6. Come lo costruiamo (per chi sviluppa)

- **Core:** nuova cartella `core/src/generate/`.
  - `generate(geom, mode, opts)` restituisce `{ geometry, report, guides }`.
  - `report`: cosa è cambiato, somiglianza, avvisi.
  - `guides`: griglia, raggi e angoli da disegnare nell'anteprima.
  - Riusa `refine` (CORREGGI), il fit di Schneider del ricalco, `arcSpline` e `mirror`.
  - **Nessuna modifica a `model.ts`.** I tipi di GENERA vivono in `generate/`, come quelli di CORREGGI
    in `fix/refine.ts`.
- **Riconoscibilità:**
  - `drift(a, b)` = distanza di Hausdorff campionata tra i contorni;
  - se supera lo scarto massimo si ritenta con intensità più bassa (ricerca binaria, al massimo 6
    tentativi), poi si saltano gli elementi che sforano.
- **UI:** `GeneratePanel.svelte` nel pacchetto `ui`, con le miniature disegnate come le anteprime di
  CORREGGI. Testi in `strings.ts` (it/en).
- **Illustrator:** si riusa la scrittura della copia di CORREGGI (`fix.ts`), con un nome di layer
  diverso.
- **Test, prima del codice:**
  - **proprietà**: ogni risultato resta entro lo scarto massimo, stesso numero di tracciati,
    risultato identico a ogni esecuzione;
  - **Matematico**: angoli multipli dell'angolo base, raggi multipli del modulo, rette quasi parallele
    rese parallele;
  - **Minimal**: meno anchor, nessuno spigolo vero perso;
  - **casi veri**: la «A con coda» (ricostruita) e i loghi disegnati a mano del banco di prova.

## 7. Modalità SIMMETRICO e STRUTTURATO (0.11.0, avviate da Marco il 19/11)

### Simmetrico

Idea: il logo **perfettamente simmetrico**, con il metodo sulle forme della 0.8.0 (`mirror.ts`).

- Si cerca l'asse (verticale, orizzontale o automatico) confrontando le curve dei due lati.
- Una metà resta com'è e l'altra diventa il suo **riflesso esatto**. Le forme che attraversano l'asse
  si tagliano e si ricompongono; quelle tutte da un lato prendono la forma del gemello riflesso.
- **Metà da tenere**: Auto (la più pulita, cioè quella con meno anchor) · Sinistra · Destra · Sopra ·
  Sotto.
- Vale lo scarto massimo:
  - se i due lati sono troppo diversi l'anteprima lo dice («nessun asse plausibile entro lo scarto»);
  - se una forma non ha gemello, resta com'è e il riepilogo lo segnala.
- L'anteprima mostra l'**asse** tratteggiato.

### Strutturato

Idea: ogni curva libera **diventa davvero** la catena di archi tangenti che ANALIZZA mostra dalla 0.9.0.
Il logo diventa interamente costruibile con riga e compasso.

- Le curve già circolari restano archi e le rette restano rette. Le curve libere (né archi, né ovali,
  né rette) vengono sostituite dalla loro catena di archi tangenti: senza spigoli tra un arco e
  l'altro e con lo scarto più piccolo possibile.
- Parte dal logo **originale**, non da quello corretto: gli archi di CORREGGI non sono per forza
  tangenti tra loro, mentre qui la catena deve esserlo.
- Tolleranza degli archi: dallo 0,2% allo 0,8% della diagonale secondo l'intensità, mai oltre lo
  scarto massimo.
- Una curva che richiederebbe troppi archi (più di 3 per tratto) resta com'è e il riepilogo lo dice.
- L'anteprima mostra i **cerchi** degli archi nuovi.
- Il riepilogo dice quante curve sono diventate archi e quanti archi sono stati usati.

## 7c. Modalità SEZIONE AUREA (approvata da Marco il 19/11/2026, «ok a tutte le proposte»)

Idea: il logo ricomposto su **rapporti aurei**. Le misure principali stanno tra loro come
φ = 1,618…: ogni misura è la precedente divisa o moltiplicata per φ (1 : 0,618 : 0,382 : 0,236…).
È il metodo con cui molti marchi famosi sono stati costruiti, con cerchi di diametri in serie aurea.

### Il rapporto

- **φ = 1,618** di base. In alternativa: **√2 = 1,414** (formati carta), **3:2 = 1,5**, **1:1**
  (cerchi tutti uguali).
- **Passo**: rapporto intero (r, r/φ, r/φ²…) di base, oppure **mezzo passo** (√φ = 1,272 tra un
  gradino e l'altro), che cambia meno il logo.

### Regole, in quest'ordine

1. **Raggi in serie aurea.**
   - Il cerchio vero **più grande** è il riferimento R e non cambia.
   - Ogni altro cerchio prende il raggio della serie più vicino al suo: R/φ, R/φ², R/φ³…
   - I cerchi con raggi uguali restano uguali; quelli concentrici restano concentrici.
   - I cerchi vengono scalati intorno al proprio centro, come in Matematico.
   - Vale per i **cerchi interi**: un pezzo d'arco dentro un contorno resta com'è, perché cambiarne il
     raggio lo staccherebbe dalle curve vicine.
2. **Griglia aurea.** Sul riquadro del logo si tracciano le linee che lo dividono in proporzione aurea:
   - verticali a 0,382 e 0,618 della larghezza, poi le suddivisioni successive (0,236 e 0,764);
   - orizzontali allo stesso modo sull'altezza.

   I **centri dei cerchi** e le **rette orizzontali e verticali** del logo (bordi, tagli, assi) vicini
   a una linea della griglia ci si spostano sopra. Gli spigoli si ricollegano come in Matematico.

3. **Proporzioni tra spessori.** Dove il logo ha tratti di due spessori diversi e il loro rapporto è
   vicino a φ (tra 1,45 e 1,8), il più sottile diventa esattamente il più spesso diviso φ.
4. **Riquadro aureo (facoltativo, spento di base).** Se il rapporto larghezza/altezza del logo è vicino
   a φ (o a 1/φ), il logo viene allungato o accorciato su un solo asse, quanto basta per arrivare a φ
   esatto. È spento di base perché deforma anche le curve.

### Loghi senza cerchi

Le regole 2 e 3 valgono anche senza cerchi. Se nessun elemento è vicino a un rapporto aureo (entro lo
scarto massimo), l'anteprima lo dice («nessuna misura vicina alla sezione aurea») invece di forzare.

### Cosa mostra l'anteprima

- La **griglia aurea** sul riquadro.
- I **cerchi** con il loro gradino (es. «R», «R/φ», «R/φ²»).
- Facoltativa: la **spirale aurea** inscritta nel riquadro, come riferimento visivo (solo anteprima).
- Il riepilogo: «3 raggi in serie φ · 2 centri sulla griglia aurea · 1 rapporto di spessori φ ·
  somiglianza 98%».

### Parametri

- rapporto (φ · √2 · 3:2 · 1:1) e passo (intero · mezzo);
- regole attive: raggi, griglia, spessori (accese di base), riquadro (spento di base);
- spirale nell'anteprima (sì/no);
- come sempre: intensità e scarto massimo, con la stessa guardia di riconoscibilità delle altre
  modalità (prima si saltano gli elementi che sforano, poi si riduce l'intensità).

### Come si costruisce (per chi sviluppa)

- Nuovo `core/src/generate/golden.ts`, che riusa da Matematico lo scalamento dei cerchi e la
  ricostruzione degli spigoli come intersezioni.
- Nessuna modifica a `model.ts`.
- Test prima del codice:
  - raggi esattamente in serie R/φᵏ (o R/φ^(k/2));
  - centri sulle linee 0,382/0,618;
  - un logo senza misure auree non cambia e la nota lo dice;
  - scarto massimo rispettato;
  - stesso numero di tracciati.

### Decisioni da prendere con Marco

1. **Riferimento dei raggi:** il cerchio più grande (proposta) o il cerchio con più peso nel logo?
2. **Passo di base:** intero (più «aureo», cambia di più) o mezzo passo (proposta: intero)?
3. **Riquadro aureo:** spento di base (proposta) o acceso?
4. **Spirale aurea nell'anteprima:** sì (proposta) o no?
5. **Rapporti alternativi** (√2, 3:2, 1:1): servono subito (proposta: sì, costano poco) o solo φ?

## 7b. Ancora fuori

- Preset salvabili dei parametri.

## 8. Decisioni da prendere con Marco

1. **Scarto massimo di base**: 3% di D va bene, o il logo deve cambiare meno (2%) o di più (5%)?
2. **Matematico, angolo base**: 15° di base, o 45° (più "geometrico", ma cambia di più i loghi
   inclinati)?
3. **Matematico, modulo**: automatico (unità x del logo) con suddivisione m/2: va bene come partenza?
4. **Minimal, forme piccole**: solo segnalate (proposta), o anche un'opzione per **nasconderle** nella
   copia?
5. **Posizione**: scheda a sé «GENERA» (proposta), o tendina dentro CORREGGI?
