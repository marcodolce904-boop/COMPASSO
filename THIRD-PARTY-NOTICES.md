# Componenti di terze parti

Compasso include o usa questi componenti, ciascuno con la propria licenza:

| Componente                                                     | Uso                                             | Licenza                                        |
| -------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| [Bolt CEP](https://github.com/hyperbrew/bolt-cep) (Hyper Brew) | struttura del pannello CEP (`apps/illustrator`) | MIT — vedi `apps/illustrator/LICENSE.bolt-cep` |
| CSInterface / Vulcan (Adobe)                                   | comunicazione pannello ↔ Illustrator            | licenza Adobe CEP Resources                    |
| [json2.js](https://github.com/douglascrockford/JSON-js)        | JSON in ExtendScript                            | pubblico dominio                               |
| [Svelte](https://svelte.dev)                                   | interfaccia del pannello                        | MIT                                            |
| [Inter](https://rsms.me/inter/) (Rasmus Andersson)             | carattere dell'interfaccia                      | SIL Open Font License 1.1                      |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/)           | carattere monospace dell'interfaccia            | SIL Open Font License 1.1                      |

Il motore geometrico (`packages/core`) e l'interfaccia (`packages/ui`) sono codice originale di Compasso.
Il progetto si ispira al concetto del plugin Linyal, senza usarne codice, nome, testi o grafica (SPEC §14).
