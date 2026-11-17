// @include './lib/json2.js'
// Ingresso ExtendScript (da Bolt CEP): registra le funzioni di Illustrator sotto l'id del pannello.
import { ns } from '../shared/shared';
import type { Scripts } from '../shared/es-types';
import {
  applyFix,
  createTracePaths,
  drawPlan,
  extractSelection,
  getDocInfo,
  getSelectedImage,
  getSelectionFingerprint,
  hasConstruction,
  removeConstruction,
  revertFix,
} from './ilst/ilst';

// Oggetto esplicito (non `import *`): evita l'oggetto-namespace con `__proto__: null`.
// La firma pubblica sta in src/shared/es-types (usata dal pannello): qui si verifica che coincida.
var api: Scripts = {
  applyFix: applyFix,
  createTracePaths: createTracePaths,
  drawPlan: drawPlan,
  extractSelection: extractSelection,
  getDocInfo: getDocInfo,
  getSelectedImage: getSelectedImage,
  getSelectionFingerprint: getSelectionFingerprint,
  hasConstruction: hasConstruction,
  removeConstruction: removeConstruction,
  revertFix: revertFix,
};
($ as unknown as Record<string, Scripts>)[ns] = api;
