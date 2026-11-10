// Firma delle funzioni ExtendScript chiamabili con evalTS() (Bolt). Sta qui, senza globali
// di Illustrator, così il pannello (contesto browser) ha i tipi senza importare src/jsx.
import type { ExtractResult } from '../../jsx/ilst/extract';
import type { DrawResult, PPlan } from '../../jsx/ilst/draw';

export interface DocInfo {
  open: boolean;
  colorMode?: 'cmyk' | 'rgb';
  artboard?: number;
  name?: string;
}

export type Scripts = {
  extractSelection: () => ExtractResult;
  getSelectionFingerprint: () => string;
  getDocInfo: () => DocInfo;
  drawPlan: (plan: PPlan) => DrawResult;
  removeConstruction: () => boolean;
  hasConstruction: () => boolean;
};
