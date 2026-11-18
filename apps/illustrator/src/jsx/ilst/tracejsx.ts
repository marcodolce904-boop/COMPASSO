// RICALCA: legge l'immagine selezionata (percorso del file e posizione) e crea i tracciati
// ricalcati su un layer dedicato. ExtendScript (Bolt -> ES3): cicli for, niente condizionali
// annidati, try/catch espliciti. Solo lettura del documento e disegno su un layer nuovo.

import { findLayer, type AiDrawDocument, type AiLayer } from './draw';
import { CONSTRUCTION_LAYER } from './extract';
import { writePath, type FixPath } from './fix';
import type { AiItem } from './extract';

export var TRACE_LAYER = 'Compasso ' + String.fromCharCode(8212) + ' Ricalco';

export interface SelectedImage {
  ok: boolean;
  /** Percorso del file dell'immagine (collegata). */
  path?: string;
  /** Posizione e dimensioni in coordinate della tavola attiva (pt, Y in giu'). */
  bounds?: { x: number; y: number; width: number; height: number };
  reason?: 'no-document' | 'no-selection' | 'not-image' | 'embedded' | 'capture-failed';
  /** L'immagine è stata "fotografata" da Illustrator (incorporata, ritagliata, PSD…). */
  captured?: boolean;
}

/** "Foto" di un'area del documento in un PNG temporaneo (Document.imageCapture). */
export interface TraceCaptureEnv {
  tempFile: () => string;
  capture: (file: string, bounds: number[], ppi: number) => void;
}

export interface TraceStyle {
  filled: boolean;
  strokeWidth: number;
}

export interface CreateTraceResult {
  ok: boolean;
  paths: number;
  reason?: 'no-document';
}

interface AiImageItem extends AiItem {
  file?: { fsName: string; exists?: boolean };
}
export interface AiTraceDocument extends AiDrawDocument {
  selection: unknown;
}
export interface TraceEnv {
  black: unknown;
  smooth: unknown;
  corner: unknown;
}

/** L'immagine selezionata (collegata) e dove sta sulla tavola attiva. */
/** Prima immagine dentro un oggetto (anche in gruppi e maschere di ritaglio). */
function findImage(
  item: AiImageItem,
  depth: number,
  clipped: boolean,
): { image: AiImageItem; clipped: boolean } | null {
  var t = item.typename;
  if (t === 'PlacedItem' || t === 'RasterItem') return { image: item, clipped: clipped };
  if (t !== 'GroupItem' || depth > 6) return null;
  var items = (item as unknown as { pageItems?: { length: number; [i: number]: AiImageItem } })
    .pageItems;
  if (!items) return null;
  var inClip = clipped || !!(item as unknown as { clipped?: boolean }).clipped;
  for (var k = 0; k < items.length; k++) {
    var found = findImage(items[k], depth + 1, inClip);
    if (found) return found;
  }
  return null;
}

/** Formati che il pannello sa leggere direttamente dal file collegato. */
function readable(path: string): boolean {
  var low = path.toLowerCase();
  var exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
  for (var k = 0; k < exts.length; k++) {
    var e = exts[k];
    if (low.length > e.length && low.substring(low.length - e.length) === e) return true;
  }
  return false;
}

/**
 * L'immagine selezionata e dove sta sulla tavola attiva. Se è collegata a un file leggibile si
 * usa il file (risoluzione piena). Altrimenti (incorporata, dentro un ritaglio, PSD/TIFF…)
 * Illustrator ne fa una "foto" PNG dell'area visibile in un file temporaneo: il documento non
 * cambia (si nascondono solo per un attimo i layer di Compasso, per non fotografarli).
 */
export function selectedImage(doc: AiTraceDocument | null, env?: TraceCaptureEnv): SelectedImage {
  if (!doc) return { ok: false, reason: 'no-document' };
  var sel = doc.selection as { length?: number; [i: number]: AiImageItem } | null;
  if (!sel || !sel.length) return { ok: false, reason: 'no-selection' };
  var found: { image: AiImageItem; clipped: boolean } | null = null;
  var top: AiImageItem | null = null;
  for (var i = 0; i < sel.length && found === null; i++) {
    found = findImage(sel[i], 0, false);
    if (found) top = sel[i];
  }
  if (found === null || top === null) return { ok: false, reason: 'not-image' };
  var path = '';
  try {
    if (found.image.file) path = found.image.file.fsName;
  } catch (e) {
    void e;
    path = '';
  }
  var rect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  // con il ritaglio conta l'area visibile (il gruppo), altrimenti l'immagine intera
  var box: number[];
  if (found.clipped) box = top.geometricBounds as number[];
  else box = found.image.geometricBounds as number[];
  var bounds = {
    x: box[0] - rect[0],
    y: rect[1] - box[1],
    width: box[2] - box[0],
    height: box[1] - box[3],
  };
  if (path && readable(path) && !found.clipped) return { ok: true, path: path, bounds: bounds };
  if (!env) return { ok: false, reason: 'embedded' };
  // "foto" dell'area: lato lungo ~1600 px (tra 72 e 600 ppi)
  var longPt = Math.max(bounds.width, bounds.height);
  var ppi = Math.round((1600 / Math.max(1, longPt)) * 72);
  if (ppi < 72) ppi = 72;
  if (ppi > 600) ppi = 600;
  var file = env.tempFile();
  var hidden: AiLayer[] = [];
  var names = [TRACE_LAYER, CONSTRUCTION_LAYER];
  for (var n = 0; n < names.length; n++) {
    var l = findLayer(doc, names[n]);
    if (l && l.visible) {
      l.visible = false;
      hidden.push(l);
    }
  }
  var failed = false;
  try {
    env.capture(file, box, ppi);
  } catch (e) {
    void e;
    failed = true;
  }
  for (var h = 0; h < hidden.length; h++) hidden[h].visible = true;
  if (failed) return { ok: false, reason: 'capture-failed' };
  return { ok: true, path: file, bounds: bounds, captured: true };
}

/** Crea i tracciati ricalcati su un layer nuovo (o svuotato) e li seleziona. */
export function createTrace(
  doc: AiTraceDocument | null,
  paths: FixPath[],
  style: TraceStyle,
  env: TraceEnv,
): CreateTraceResult {
  if (!doc) return { ok: false, paths: 0, reason: 'no-document' };
  var layer: AiLayer | null = findLayer(doc, TRACE_LAYER);
  if (!layer) {
    layer = doc.layers.add();
    layer.name = TRACE_LAYER;
  }
  layer.locked = false;
  layer.visible = true;
  var rect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  var made: AiItem[] = [];
  for (var i = 0; i < paths.length; i++) {
    if (paths[i].nodes.length < 2) continue;
    var item = layer.pathItems.add() as unknown as AiItem;
    writePath(item, paths[i], rect[0], rect[1], env);
    var styled = item as unknown as {
      filled: boolean;
      stroked: boolean;
      fillColor: unknown;
      strokeColor: unknown;
      strokeWidth: number;
    };
    if (style.filled) {
      styled.filled = true;
      styled.fillColor = env.black;
      styled.stroked = false;
    } else {
      styled.filled = false;
      styled.stroked = true;
      styled.strokeColor = env.black;
      styled.strokeWidth = style.strokeWidth;
    }
    made.push(item);
  }
  try {
    doc.selection = null;
    for (var s = 0; s < made.length; s++) made[s].selected = true;
  } catch (e) {
    void e;
  }
  return { ok: true, paths: made.length };
}
