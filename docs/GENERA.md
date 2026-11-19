# GENERA — specifica

_Approvata da Marco il 18/11/2026 («ok a tutte le proposte» del §8). Matematico e Minimal
realizzati nella 0.10.0._
_Primo rilascio previsto: modalità **Matematico** e **Minimal**. Le altre (Simmetrico, Sezione aurea,
Strutturato) seguono con le stesse regole di base._

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

## 7b. Ancora fuori

- **Sezione aurea**: raggi in progressione φ, proporzioni del riquadro e posizioni sulla griglia aurea.
  Ha bisogno di una specifica sua.
- Preset salvabili dei parametri.

## 8. Decisioni da prendere con Marco

1. **Scarto massimo di base**: 3% di D va bene, o il logo deve cambiare meno (2%) o di più (5%)?
2. **Matematico, angolo base**: 15° di base, o 45° (più "geometrico", ma cambia di più i loghi
   inclinati)?
3. **Matematico, modulo**: automatico (unità x del logo) con suddivisione m/2: va bene come partenza?
4. **Minimal, forme piccole**: solo segnalate (proposta), o anche un'opzione per **nasconderle** nella
   copia?
5. **Posizione**: scheda a sé «GENERA» (proposta), o tendina dentro CORREGGI?
