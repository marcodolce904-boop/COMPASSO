// RICALCA: legge l'immagine selezionata (percorso del file e posizione) e crea i tracciati
// ricalcati su un layer dedicato. ExtendScript (Bolt -> ES3): cicli for, niente condizionali
// annidati, try/catch espliciti. Solo lettura del documento e disegno su un layer nuovo.

import { findLayer, type AiDrawDocument, type AiLayer } from './draw';
import { writePath, type FixPath } from './fix';
import type { AiItem } from './extract';

export var TRACE_LAYER = 'Compasso ' + String.fromCharCode(8212) + ' Ricalco';

export interface SelectedImage {
  ok: boolean;
  /** Percorso del file dell'immagine (collegata). */
  path?: string;
  /** Posizione e dimensioni in coordinate della tavola attiva (pt, Y in giu'). */
  bounds?: { x: number; y: number; width: number; height: number };
  reason?: 'no-document' | 'no-selection' | 'not-image' | 'embedded';
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
export function selectedImage(doc: AiTraceDocument | null): SelectedImage {
  if (!doc) return { ok: false, reason: 'no-document' };
  var sel = doc.selection as { length?: number; [i: number]: AiImageItem } | null;
  if (!sel || !sel.length) return { ok: false, reason: 'no-selection' };
  var item: AiImageItem | null = null;
  for (var i = 0; i < sel.length && item === null; i++) {
    var t = sel[i].typename;
    if (t === 'PlacedItem' || t === 'RasterItem') item = sel[i];
  }
  if (item === null) return { ok: false, reason: 'not-image' };
  var path = '';
  try {
    if (item.file) path = item.file.fsName;
  } catch (e) {
    void e;
    path = '';
  }
  if (!path) return { ok: false, reason: 'embedded' };
  var rect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  var b = item.geometricBounds as number[]; // [sinistra, alto, destra, basso], Y in su
  return {
    ok: true,
    path: path,
    bounds: { x: b[0] - rect[0], y: rect[1] - b[1], width: b[2] - b[0], height: b[1] - b[3] },
  };
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
