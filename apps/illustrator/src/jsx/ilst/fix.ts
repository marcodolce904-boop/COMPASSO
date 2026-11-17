// Applicazione delle correzioni (scheda CORREGGI) nel documento. Gira in ExtendScript (Bolt -> ES3):
// solo cicli for, nessun condizionale annidato, try/catch espliciti.
// Le correzioni vanno su una COPIA del logo in un layer dedicato; l'originale viene nascosto e
// marcato, cosi' "Ripristina" lo rimette com'era.

import { walk, type AiItem, type Walker, type WalkState } from './extract';
import { findLayer, type AiDrawDocument, type AiLayer } from './draw';

export var FIX_LAYER = 'Compasso ' + String.fromCharCode(8212) + ' Corretto';
export var ORIGINAL_NOTE = 'compasso:originale';

/** Nodo di un tracciato corretto, in coordinate del core (tavola attiva, Y in giu'). */
export interface FixNode {
  a: number[];
  l: number[];
  r: number[];
}
export interface FixPath {
  id: string;
  closed: boolean;
  nodes: FixNode[];
}
export interface FixEnv {
  placeAtEnd: unknown;
  smooth: unknown;
  corner: unknown;
  now: () => number;
}
export interface ApplyFixResult {
  ok: boolean;
  paths: number;
  ms: number;
  reason?: 'no-document' | 'no-selection';
}

export interface AiFixDocument extends AiDrawDocument {
  selection: unknown;
  pageItems: { length: number; [i: number]: AiItem };
}

function inLayer(item: AiItem, name: string): boolean {
  var l = item.layer as { name: string; parent?: { name?: string; typename?: string } } | undefined;
  while (l) {
    if (l.name === name) return true;
    if (l.parent && l.parent.typename === 'Layer') l = l.parent as { name: string };
    else l = undefined;
  }
  return false;
}

/** Le maniglie di un nodo sono allineate (nodo "smooth")? */
function smoothNode(n: FixNode): boolean {
  var ax = n.l[0] - n.a[0];
  var ay = n.l[1] - n.a[1];
  var bx = n.r[0] - n.a[0];
  var by = n.r[1] - n.a[1];
  var la = Math.sqrt(ax * ax + ay * ay);
  var lb = Math.sqrt(bx * bx + by * by);
  if (la < 1e-6 || lb < 1e-6) return false;
  var cross = (ax * by - ay * bx) / (la * lb);
  var dot = (ax * bx + ay * by) / (la * lb);
  return Math.abs(cross) < 0.01 && dot < 0;
}

export function writePath(
  item: AiItem,
  fp: FixPath,
  left: number,
  top: number,
  env: { smooth: unknown; corner: unknown },
): void {
  var toDoc = function (p: number[]): number[] {
    return [left + p[0], top - p[1]];
  };
  var anchors: number[][] = [];
  for (var i = 0; i < fp.nodes.length; i++) anchors.push(toDoc(fp.nodes[i].a));
  item.setEntirePath!(anchors);
  var pts = item.pathPoints!;
  for (var k = 0; k < fp.nodes.length && k < pts.length; k++) {
    var n = fp.nodes[k];
    pts[k].leftDirection = toDoc(n.l);
    pts[k].rightDirection = toDoc(n.r);
    if (smoothNode(n)) pts[k].pointType = env.smooth;
    else pts[k].pointType = env.corner;
  }
  item.closed = fp.closed;
}

/**
 * Applica i tracciati corretti alla selezione. Se la selezione e' gia' la copia corretta (layer
 * "Compasso - Corretto") la aggiorna; altrimenti crea la copia e nasconde l'originale.
 */
export function applyFix(doc: AiFixDocument | null, fixed: FixPath[], env: FixEnv): ApplyFixResult {
  var t0 = env.now();
  if (!doc) return { ok: false, paths: 0, ms: 0, reason: 'no-document' };
  var selection = doc.selection as { length?: number; [i: number]: AiItem } | null;
  if (!selection || !selection.length)
    return { ok: false, paths: 0, ms: 0, reason: 'no-selection' };
  var items: AiItem[] = [];
  for (var i = 0; i < selection.length; i++) items.push(selection[i]);

  var byId: { [id: string]: FixPath } = {};
  for (var f = 0; f < fixed.length; f++) byId[fixed[f].id] = fixed[f];

  var allCopies = true;
  for (var c = 0; c < items.length; c++) if (!inLayer(items[c], FIX_LAYER)) allCopies = false;

  var targets: AiItem[] = [];
  if (allCopies) {
    targets = items;
  } else {
    var layer: AiLayer | null = findLayer(doc, FIX_LAYER);
    if (!layer) {
      layer = doc.layers.add();
      layer.name = FIX_LAYER;
    }
    layer.locked = false;
    layer.visible = true;
    for (var d = 0; d < items.length; d++) {
      var copy = items[d].duplicate!(layer, env.placeAtEnd);
      targets.push(copy);
      items[d].note = ORIGINAL_NOTE;
      items[d].hidden = true;
    }
  }

  var rect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  var written = 0;
  var st: WalkState = { nextPath: 0, nextGlyph: 0 };
  var writer: Walker = {
    path: function (item, id) {
      var fp = byId[id];
      if (!fp || !item.setEntirePath || fp.nodes.length < 2) return;
      writePath(item, fp, rect[0], rect[1], env);
      written++;
    },
    text: function (item) {
      // sulla copia il testo diventa tracciati in modo permanente (come in lettura)
      if (!item.createOutline) return null;
      return item.createOutline();
    },
    warn: function () {},
  };
  for (var w = 0; w < targets.length; w++) walk(targets[w], null, st, writer);

  // la copia corretta resta selezionata: il pannello analizza subito il risultato
  try {
    doc.selection = null;
    for (var s = 0; s < targets.length; s++) targets[s].selected = true;
  } catch (e) {
    void e;
  }
  return { ok: true, paths: written, ms: env.now() - t0 };
}

/** Elimina la copia corretta e rimostra (e riseleziona) l'originale. */
export function revertFix(doc: AiFixDocument | null): number {
  if (!doc) return 0;
  var layer = findLayer(doc, FIX_LAYER);
  if (layer) {
    layer.locked = false;
    layer.remove();
  }
  var restored: AiItem[] = [];
  for (var i = 0; i < doc.pageItems.length; i++) {
    var it = doc.pageItems[i];
    if (it.note === ORIGINAL_NOTE) restored.push(it);
  }
  for (var k = 0; k < restored.length; k++) {
    restored[k].hidden = false;
    restored[k].note = '';
  }
  try {
    doc.selection = null;
    for (var s = 0; s < restored.length; s++) restored[s].selected = true;
  } catch (e) {
    void e;
  }
  return restored.length;
}

export function hasFix(doc: AiFixDocument | null): boolean {
  return doc !== null && findLayer(doc, FIX_LAYER) !== null;
}
