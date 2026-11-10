// Funzioni chiamate dal pannello con evalTS() (Bolt): UNA chiamata per operazione (§5.5).
// ExtendScript legge e disegna, nient'altro: il calcolo è nel core, nel pannello.
import {
  extractSelection as extract,
  selectionFingerprint,
  type AiDocument,
  type ExtractResult,
} from './extract';
import type { DocInfo } from '../../shared/es-types';

function activeDocument(): AiDocument | null {
  return app.documents.length > 0 ? (app.activeDocument as unknown as AiDocument) : null;
}

/** Esegue `fn` con le coordinate del documento (Y in su), poi ripristina l'impostazione. */
function withDocumentCoordinates<T>(fn: () => T): T {
  var previous = app.coordinateSystem;
  app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
  try {
    return fn();
  } finally {
    app.coordinateSystem = previous;
  }
}

/** §8.3: geometria della selezione (DocumentGeometry) o il motivo per cui non c'è. */
export const extractSelection = (): ExtractResult => {
  return withDocumentCoordinates(function () {
    return extract(activeDocument());
  });
};

/** §8.4: impronta della selezione per il polling. */
export const getSelectionFingerprint = (): string => {
  return selectionFingerprint(activeDocument());
};

/** §8.3: modalità colore, tavola attiva e unità del documento. */
export const getDocInfo = (): DocInfo => {
  if (app.documents.length === 0) return { open: false };
  var doc = app.activeDocument;
  return {
    open: true,
    name: doc.name,
    colorMode: doc.documentColorSpace === DocumentColorSpace.CMYK ? 'cmyk' : 'rgb',
    artboard: doc.artboards.getActiveArtboardIndex(),
  };
};
