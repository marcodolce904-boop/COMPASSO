// Firma delle funzioni ExtendScript chiamabili con evalTS() (Bolt). Sta qui, senza globali
// di Illustrator, così il pannello (contesto browser) ha i tipi senza importare src/jsx.
import type { ExtractResult } from '../../jsx/ilst/extract';
import type { DrawResult, PPlan } from '../../jsx/ilst/draw';
import type { ApplyFixResult, FixPath } from '../../jsx/ilst/fix';
import type { CreateTraceResult, SelectedImage, TraceStyle } from '../../jsx/ilst/tracejsx';

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
  applyFix: (paths: FixPath[]) => ApplyFixResult;
  revertFix: () => number;
  applyGenerate: (paths: FixPath[]) => ApplyFixResult;
  revertGenerate: () => number;
  getSelectedImage: () => SelectedImage;
  createTracePaths: (paths: FixPath[], style: TraceStyle, plan?: PPlan | null) => CreateTraceResult;
};
