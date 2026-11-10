// @include './lib/json2.js'
// Ingresso ExtendScript (da Bolt CEP): registra le funzioni di Illustrator sotto l'id del pannello.
import { ns } from '../shared/shared';
import type { Scripts } from '../shared/es-types';
import {
  drawPlan,
  extractSelection,
  getDocInfo,
  getSelectionFingerprint,
  hasConstruction,
  removeConstruction,
} from './ilst/ilst';

// Oggetto esplicito (non `import *`): evita l'oggetto-namespace con `__proto__: null`.
// La firma pubblica sta in src/shared/es-types (usata dal pannello): qui si verifica che coincida.
var api: Scripts = {
  drawPlan: drawPlan,
  extractSelection: extractSelection,
  getDocInfo: getDocInfo,
  getSelectionFingerprint: getSelectionFingerprint,
  hasConstruction: hasConstruction,
  removeConstruction: removeConstruction,
};
($ as unknown as Record<string, Scripts>)[ns] = api;
