# Changelog

## 0.2.2 — 10/11/2026

- **Caricamento dello script di Illustrator verificato**: il pannello controlla che Illustrator risponda e,
  se il caricamento standard non riesce, riprova in altri due modi. Se fallisce comunque, mostra il motivo
  esatto (messaggio e riga) invece di «JSON non definito».
- Script per Illustrator reso più conservativo (niente `try/finally` senza `catch`, niente `__proto__`).
- Corretto: un errore comparso una sola volta all'avvio restava visibile anche quando tutto funzionava.

## 0.2.1 — 10/11/2026

- **Corretto l'errore «JSON non definito»** all'apertura del pannello: nella 0.2.0 lo script per Illustrator
  veniva compilato senza la libreria JSON, quindi nessuna funzione rispondeva.

## 0.2.0 — 10/11/2026

- **Nuovo installer per Windows: un solo file, `Compasso-Setup.exe`.** Doppio clic → Installa → Fine.
  Niente ZIP, niente ZXP, niente altri programmi. Si disinstalla da «App installate» di Windows.
  Ogni release viene installata e disinstallata in automatico su Windows prima di essere pubblicata.
- Per ora solo Windows (gli installer macOS sono stati rimossi).
- Corretto: il nome del layer «Compasso — Construction» poteva essere letto male da Illustrator su Windows
  (trattino lungo), impedendo a Rimuovi/Ridisegna di ritrovare il layer. Lo script per Illustrator ora è solo ASCII.
- Corretto: se l'analisi in background non rispondeva, il pannello poteva restare su «Analisi…»; ora riparte da sola.
- Corretto: nessun errore ripetuto mentre si modifica un testo in Illustrator.
- Il pannello parte in italiano se Illustrator è in italiano.
- Le release 0.1.0 e 0.1.1 (installer difettosi) sono state ritirate.

## 0.1.1 — anteprima (beta) · 10/11/2026

- **Installer Windows corretto**: la versione 0.1.0 poteva chiudersi prima di installare (errore nello script).
  Ora verifica che Compasso sia davvero installato e dice dove.
- Nuovo **«Diagnostica Compasso (Windows).bat»** (solo lettura): raccoglie in un file sul Desktop le
  informazioni utili se il pannello non compare.
- Istruzioni: il pannello può trovarsi in **Finestra → Estensioni (legacy)** nelle versioni recenti di Illustrator.

## 0.1.0 — anteprima (beta) · 10/11/2026

Prima versione installabile per Adobe Illustrator 2026 (v31) su Windows e macOS.

- **Analizza**: deduce dai tracciati selezionati cerchi, rette, allineamenti di anchor, assi di
  simmetria, unità x, raggi e rapporti notevoli; quattro livelli (Essenziale, Struttura, Dettaglio, Tutto).
- **Anteprima live** nel pannello, che segue la selezione in Illustrator.
- **Anomalie**: quasi-archi, raggi quasi uguali, centri quasi coincidenti, quasi-tangenze, anchor fuori
  riga/colonna, quasi-simmetrie, angoli quasi notevoli, con evidenziazione nell'anteprima.
- **Misure**: unità x con affidabilità, bounding box e proporzione, raggi e rapporti, area di rispetto, «Copia misure».
- **Disegna / Ridisegna / Rimuovi** su un layer bloccato «Compasso — Construction» (grigio K60 in CMYK, #7A7A7A in RGB).
- Elementi includibili/escludibili uno per uno; spessore linee e dimensione marker regolabili.
- Tolleranza Rigida/Normale/Morbida; interfaccia in inglese e italiano; tema chiaro/scuro come Illustrator.

Limiti noti: COSTRUISCI e PRESENTA arriveranno nelle versioni successive; tracciati aperti con contorno
analizzati sulla linea centrale; immagini e simboli ignorati.
