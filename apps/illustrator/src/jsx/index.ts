// @include './lib/json2.js'
// Ingresso ExtendScript (da Bolt CEP): registra le funzioni di Illustrator sotto l'id del pannello.
import { ns } from '../shared/shared';
import type { Scripts } from '../shared/es-types';
import * as ilst from './ilst/ilst';

// La firma pubblica sta in src/shared/es-types (usata dal pannello): qui si verifica che coincida.
const api: Scripts = ilst;
($ as unknown as Record<string, Scripts>)[ns] = api;
