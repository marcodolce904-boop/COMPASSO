# Migliorie del §4 — specifica breve (approvata da Marco il 19/11/2026: ok a tutto, rilascio unico nella 0.16)

_19/11/2026. Le quattro migliorie concordate il 18/11 (memoria §4). Nessun cambio a `model.ts`._

## 1. Confronto prima/dopo con la tendina

Oggi CORREGGI e GENERA hanno «Generato · Confronto · Prima»: il confronto sovrappone il contorno
originale al risultato. Si aggiunge una **quarta vista, «Tendina»**:
- l'anteprima mostra il **prima a sinistra** e il **dopo a destra** di una linea verticale;
- la linea si **trascina** col mouse (o con le frecce ← →); doppio clic = torna al centro;
- etichette «Prima» e «Dopo» ai due lati, come nel video del ginkgo.

Dove: CORREGGI, GENERA e RICALCA (in RICALCA: schizzo a sinistra, tracciati a destra).

## 2. Spiegazione quando una correzione resta a 0

Oggi CORREGGI dice solo «Nessuna correzione con queste tolleranze». Per **ogni correzione accesa che
resta a 0** il pannello dice **perché**, in una riga sotto il suo interruttore:
- **non c'è niente da correggere**: «nessuna curva quasi circolare nel logo»;
- **il caso più vicino è fuori tolleranza**: «la curva più vicina a un arco si scosta di 1,8 pt;
  la tolleranza è 0,9 pt» → con un pulsante **«Prova con 1,8 pt»** che alza la tolleranza di quella
  correzione;
- per la simmetria resta il messaggio che c'è già («lati troppo diversi»).

Core: `refine` aggiunge al report, per ogni correzione, il motivo e lo scarto del caso più vicino
(`RefineReport.why`, in `fix/refine.ts`, non nel modello).

## 3. Percorso guidato

In fondo a RICALCA, CORREGGI e GENERA, accanto al pulsante principale, un pulsante **«Avanti →»**:
- RICALCA → crea i tracciati e passa a **CORREGGI** con i tracciati già selezionati;
- CORREGGI → applica la copia corretta e passa a **ANALIZZA** (o a GENERA, a scelta);
- in alto, una riga di **passi** «1 Ricalca · 2 Correggi · 3 Analizza · 4 Genera» che mostra dove sei
  (cliccabile, come le schede).
Le schede restano: il percorso è una scorciatoia, non un obbligo.

## 4. Preset salvabili

Nella tendina «⚙» di RICALCA, CORREGGI e GENERA: **Salva come preset…**, elenco dei preset, **Elimina**.
- Un preset salva tutte le regolazioni della scheda (non i tracciati).
- Si salvano **nel pannello** (memoria locale di Illustrator), restano tra una sessione e l'altra.
- **Esporta/Importa** in un file `.json`, per portarli su un altro computer o condividerli.
- Tre preset di esempio già pronti in RICALCA: «Schizzo a matita», «Disegno a china», «Immagine piccola».

## Ordine proposto

1. Tendina prima/dopo (poco costo, si usa subito per giudicare).
2. Spiegazioni delle correzioni a 0.
3. Percorso guidato.
4. Preset.

Una versione per ogni punto (0.16 → 0.19), oppure tutte insieme nella 0.16.
