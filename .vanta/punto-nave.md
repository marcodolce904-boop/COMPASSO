# Punto Nave · 2026-11-19 (sera, dopo la 0.14.0 e i materiali LinkedIn)

- **Obiettivo:** portare Compasso (plugin Illustrator, Windows) a trasformare un logo disegnato a
  mano in una grafica esatta e costruita, e farlo conoscere su LinkedIn come strumento per chi
  disegna ancora a matita.
- **Vincoli:**
  - Solo Windows, pannello CEP, ExtendScript ES3.
  - Chiedere conferma per `model.ts`, nuove dipendenze e `fixtures/expected`.
  - Specifica breve approvata da Marco prima delle novità di peso.
  - Marco giudica sui risultati visivi: niente reinterpretazioni dei suoi disegni o riferimenti.
- **Variabili chiave:**
  - versione pubblicata = 0.14.0 (installer: releases/latest/download/Compasso-Setup.exe)
  - test = 388, tutti verdi
  - schede = RICALCA, CORREGGI, ANALIZZA, GENERA (PRESENTA vuota)
  - video di presentazione = 8 in `docs/media/` (pettirosso, ginkgo, maneki-neko, gufo + 4 iniziali)
  - loghi veri di Marco provati nel plugin = 0
- **Decisioni prese:**
  - GENERA ricostruisce in modo canonico, senza preservare l'originale (0.13.0).
  - RICALCA «Crea forme» lavora su forme intere, con barra per il bordo (0.14.0).
  - Comunicazione: stile Swiss (carta, nero, un rosso), 4:5, muto, apertura sul risultato e
    chiusura che riparte dall'inizio.
  - Dai riferimenti di Marco: ricalco fedele, poi perfezionamento (archi tangenti, simmetria).
    Mai ridisegnare a modo proprio: il pettirosso e il gatto rifatti «a occhio» sono stati scartati.
  - Primo post LinkedIn: video del maneki-neko con testo corto e link nel primo commento.
- **Questioni aperte:**
  1. Portare nel plugin il metodo usato per i video (proposta di Claude, da approvare):
     contorni dalle sfumature di grigio, simmetria automatica sul campo, catene di archi tangenti
     entro una tolleranza. Potrebbe diventare «Perfeziona» in RICALCA o in CORREGGI.
  2. Migliorie UX del §4 ancora da ordinare: confronto prima/dopo a tendina (già mostrato nel
     video del ginkgo), spiegazioni quando una correzione resta a 0, percorso guidato, preset.
  3. Attribuzioni Freepik/Vecteezy da inserire nei post (nome autore).
  4. Verifica completa in Illustrator vero (checklist §10.4 della SPEC).
- **Rischi principali:**
  - **Nessuna prova su loghi veri.** Segnale: Marco trova difetti nuovi appena usa il plugin.
  - **Promessa più grande del prodotto.** I video mostrano un ricalco fatto fuori dal plugin.
    Segnale: chi lo scarica non ottiene lo stesso risultato.
  - **Pannello sovraccarico.** Segnale: Marco chiede «dove si fa X».
- **Stato:**
  - Plugin 0.14.0 rilasciato.
  - Carosello LinkedIn (5 slide, 4:3) pronto.
  - Video pettirosso, ginkgo, maneki-neko e gufo pronti.
  - Post del maneki-neko scritto.
  - Nessuno sviluppo nuovo del plugin dopo la 0.14.0.
- **Prossima azione:** Marco decide se il prossimo sviluppo è «Perfeziona» (il metodo dei video
  dentro il plugin) o le migliorie del §4; poi Claude scrive la specifica breve.
