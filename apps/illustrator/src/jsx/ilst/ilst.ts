// Funzioni chiamate dal pannello con evalTS() (Bolt): UNA chiamata per operazione (§5.5).
// ExtendScript legge e disegna, nient'altro: il calcolo è nel core, nel pannello.
import {
  CONSTRUCTION_LAYER,
  extractSelection as extract,
  selectionFingerprint,
  type AiDocument,
  type ExtractResult,
} from './extract';
import type { DocInfo } from '../../shared/es-types';
import {
  applyFix as applyFixTo,
  hasFix,
  revertFix as revertFixIn,
  type AiFixDocument,
  type ApplyFixResult,
  type FixPath,
} from './fix';
import {
  drawPlan as draw,
  findLayer,
  removeConstruction as remove,
  type AiDrawDocument,
  type ColorEnv,
  type DrawResult,
  type PPlan,
} from './draw';

import {
  createTrace,
  selectedImage,
  type AiTraceDocument,
  type CreateTraceResult,
  type SelectedImage,
  type TraceStyle,
} from './tracejsx';

var LAYER_NAME = CONSTRUCTION_LAYER;

function drawDocument(): AiDrawDocument | null {
  return app.documents.length > 0 ? (app.activeDocument as unknown as AiDrawDocument) : null;
}

var colorEnv: ColorEnv = {
  isCMYK: function (space) {
    return space === DocumentColorSpace.CMYK;
  },
  cmyk: function (c, m, y, k) {
    var col = new CMYKColor();
    col.cyan = c;
    col.magenta = m;
    col.yellow = y;
    col.black = k;
    return col;
  },
  rgb: function (r, g, b) {
    var col = new RGBColor();
    col.red = r;
    col.green = g;
    col.blue = b;
    return col;
  },
  now: function () {
    return new Date().getTime();
  },
};

function activeDocument(): AiDocument | null {
  return app.documents.length > 0 ? (app.activeDocument as unknown as AiDocument) : null;
}

/** Esegue `fn` con le coordinate del documento (Y in su), poi ripristina l'impostazione. */
function withDocumentCoordinates<T>(fn: () => T): T {
  var previous = app.coordinateSystem;
  app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
  var result: T | undefined;
  var failure: unknown = null;
  var failed = false;
  // try/catch esplicito (niente try/finally): massima compatibilita' con ExtendScript
  try {
    result = fn();
  } catch (e) {
    failed = true;
    failure = e;
  }
  app.coordinateSystem = previous;
  if (failed) throw failure;
  return result as T;
}

/** §8.3: geometria della selezione (DocumentGeometry) o il motivo per cui non c'è. */
export const extractSelection = (): ExtractResult => {
  return withDocumentCoordinates(function () {
    return extract(activeDocument());
  });
};

/**
 * §8.4: impronta della selezione per il polling, più «#1» o «#0» se il layer di costruzione
 * esiste: una sola chiamata tiene allineato anche il pulsante DISEGNA/RIDISEGNA (es. dopo Ctrl+Z).
 */
export const getSelectionFingerprint = (): string => {
  // mai un errore dal polling: durante la modifica di un testo `selection` puo' non essere leggibile
  try {
    var doc = drawDocument();
    var drawn = doc !== null && findLayer(doc, LAYER_NAME) !== null;
    var fixed = hasFix(doc as unknown as AiFixDocument | null);
    var flags = '#0';
    if (drawn) flags = '#1';
    if (fixed) flags += '#1';
    else flags += '#0';
    return selectionFingerprint(activeDocument()) + flags;
  } catch (e) {
    void e;
    return 'busy#0#0';
  }
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

/** §8.3: disegna il piano (una sola chiamata per tutto il disegno). */
export const drawPlan = (plan: PPlan): DrawResult => {
  return withDocumentCoordinates(function () {
    return draw(drawDocument(), plan, colorEnv);
  });
};

/** §8.3: elimina il layer di costruzione. */
export const removeConstruction = (): boolean => {
  return remove(drawDocument(), LAYER_NAME);
};

/** §8.3: c'è già un layer di costruzione? (il pulsante diventa RIDISEGNA) */
export const hasConstruction = (): boolean => {
  var doc = drawDocument();
  return doc !== null && findLayer(doc, LAYER_NAME) !== null;
};

/** CORREGGI: applica i tracciati corretti su una copia (l'originale resta, nascosto). */
export const applyFix = (paths: FixPath[]): ApplyFixResult => {
  return withDocumentCoordinates(function () {
    return applyFixTo(drawDocument() as unknown as AiFixDocument | null, paths, {
      placeAtEnd: ElementPlacement.PLACEATEND,
      smooth: PointType.SMOOTH,
      corner: PointType.CORNER,
      now: function () {
        return new Date().getTime();
      },
    });
  });
};

/** CORREGGI: elimina la copia corretta e rimostra l'originale. */
export const revertFix = (): number => {
  return revertFixIn(drawDocument() as unknown as AiFixDocument | null);
};

/** RICALCA: l'immagine selezionata (file collegato) e la sua posizione sulla tavola. */
export const getSelectedImage = (): SelectedImage => {
  return withDocumentCoordinates(function () {
    return selectedImage(drawDocument() as unknown as AiTraceDocument | null);
  });
};

/** RICALCA: crea i tracciati ricalcati su un layer dedicato. */
export const createTracePaths = (paths: FixPath[], style: TraceStyle): CreateTraceResult => {
  return withDocumentCoordinates(function () {
    var doc = drawDocument();
    var black: unknown;
    if (doc && colorEnv.isCMYK(doc.documentColorSpace)) black = colorEnv.cmyk(0, 0, 0, 100);
    else black = colorEnv.rgb(0, 0, 0);
    return createTrace(doc as unknown as AiTraceDocument | null, paths, style, {
      black: black,
      smooth: PointType.SMOOTH,
      corner: PointType.CORNER,
    });
  });
};
