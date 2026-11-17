// Disegno del ConstructionPlan nel documento (SPEC §6.11, §8.1–8.3). Gira in ExtendScript
// (Bolt → ES3). Riceve documento e costruttori dei colori, così si testa in Node.

export interface PVec {
  x: number;
  y: number;
}
export type PPrimitive =
  | { type: 'circle'; id: string; cx: number; cy: number; r: number; group: 'circles' }
  | { type: 'line'; id: string; a: PVec; b: PVec; group: 'lines' | 'axes' }
  | { type: 'marker'; id: string; at: PVec; shape: 'cross' | 'square'; group: 'markers' }
  | { type: 'unit'; id: string; x: number; y: number; size: number; label: string; group: 'specs' }
  | {
      type: 'rect';
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      dashed: boolean;
      group: 'specs';
    };
export interface PPlan {
  layerName: string;
  style: {
    strokeWidth: number;
    markerSize: number;
    color: 'auto' | { r: number; g: number; b: number };
    axisDash: number[];
    lineExtent: string;
  };
  primitives: PPrimitive[];
}
export interface DrawResult {
  ok: boolean;
  count: number;
  ms: number;
  reason?: 'no-document';
}

// --- forme minime del DOM di Illustrator usate qui ---
export interface AiPath {
  name: string;
  filled: boolean;
  stroked: boolean;
  strokeWidth: number;
  strokeColor: unknown;
  fillColor: unknown;
  strokeDashes: number[];
  setEntirePath: (pts: number[][]) => void;
  closed: boolean;
}
export interface AiText {
  name: string;
  contents: string;
  position: number[];
  textRange: { characterAttributes: { size: number; fillColor: unknown } };
}
export interface AiLayer {
  name: string;
  locked: boolean;
  visible: boolean;
  layers: {
    length: number;
    [i: number]: AiLayer;
    add: () => AiLayer;
    getByName?: (n: string) => AiLayer;
  };
  pathItems: {
    add: () => AiPath;
    ellipse: (top: number, left: number, w: number, h: number) => AiPath;
    rectangle: (top: number, left: number, w: number, h: number) => AiPath;
  };
  textFrames: { add: () => AiText };
  remove: () => void;
  zOrder?: (cmd: unknown) => void;
}
export interface AiDrawDocument {
  documentColorSpace: unknown;
  layers: { length: number; [i: number]: AiLayer; add: () => AiLayer };
  artboards: { getActiveArtboardIndex: () => number; [i: number]: { artboardRect: number[] } };
}
export interface ColorEnv {
  isCMYK: (space: unknown) => boolean;
  cmyk: (c: number, m: number, y: number, k: number) => unknown;
  rgb: (r: number, g: number, b: number) => unknown;
  now: () => number;
}

export var SUBLAYERS = ['Circles', 'Lines', 'Axes', 'Markers', 'Specs'];

export function findLayer(doc: AiDrawDocument, name: string): AiLayer | null {
  for (var i = 0; i < doc.layers.length; i++) if (doc.layers[i].name === name) return doc.layers[i];
  return null;
}

function unlockAll(layer: AiLayer): void {
  layer.locked = false;
  for (var i = 0; i < layer.layers.length; i++) unlockAll(layer.layers[i]);
}

function lockAll(layer: AiLayer): void {
  for (var i = 0; i < layer.layers.length; i++) lockAll(layer.layers[i]);
  layer.locked = true;
}

/** Rimuove il layer di costruzione, anche se bloccato (§8.1: «Rimuovi»). */
export function removeConstruction(doc: AiDrawDocument | null, name: string): boolean {
  if (!doc) return false;
  var layer = findLayer(doc, name);
  if (!layer) return false;
  unlockAll(layer);
  layer.remove();
  return true;
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** Disegna il piano: layer in cima, sotto-layer per gruppo, poi blocca (§8.1). */
export function drawPlan(doc: AiDrawDocument | null, plan: PPlan, env: ColorEnv): DrawResult {
  var t0 = env.now();
  if (!doc) return { ok: false, count: 0, ms: 0, reason: 'no-document' };
  removeConstruction(doc, plan.layerName); // RIDISEGNA = svuota e ridisegna

  var rect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  var left = rect[0];
  var top = rect[1];
  var X = function (x: number) {
    return left + x;
  };
  var Y = function (y: number) {
    return top - y;
  };

  var cmyk = env.isCMYK(doc.documentColorSpace);
  var c = plan.style.color;
  // if/else, NON condizionali annidati: ExtendScript non li sa leggere ("Previsto: :")
  var stroke: unknown;
  if (c !== 'auto') stroke = env.rgb(c.r, c.g, c.b);
  else if (cmyk) stroke = env.cmyk(0, 0, 0, 60);
  else stroke = env.rgb(122, 122, 122);
  var unitFill = cmyk ? env.cmyk(0, 0, 0, 20) : env.rgb(204, 204, 204);

  var root = doc.layers.add(); // il nuovo layer va in cima alla pila
  root.name = plan.layerName;
  var subs: { [k: string]: AiLayer } = {};
  for (var s = SUBLAYERS.length - 1; s >= 0; s--) {
    var l = root.layers.add();
    l.name = SUBLAYERS[s];
    subs[SUBLAYERS[s]] = l;
  }
  var groupLayer: { [k: string]: string } = {
    circles: 'Circles',
    lines: 'Lines',
    axes: 'Axes',
    markers: 'Markers',
    specs: 'Specs',
  };

  var styleLine = function (p: AiPath, dashed: boolean) {
    p.filled = false;
    p.stroked = true;
    p.strokeWidth = plan.style.strokeWidth;
    p.strokeColor = stroke;
    p.strokeDashes = dashed ? plan.style.axisDash : [];
  };
  var segment = function (layer: AiLayer, a: PVec, b: PVec, name: string, dashed: boolean) {
    var p = layer.pathItems.add();
    p.setEntirePath([
      [X(a.x), Y(a.y)],
      [X(b.x), Y(b.y)],
    ]);
    p.closed = false;
    p.name = name;
    styleLine(p, dashed);
    return p;
  };

  var count = 0;
  var ms = plan.style.markerSize;
  for (var i = 0; i < plan.primitives.length; i++) {
    var pr = plan.primitives[i];
    var layer = subs[groupLayer[pr.group]];
    if (pr.type === 'circle') {
      var e = layer.pathItems.ellipse(Y(pr.cy - pr.r), X(pr.cx - pr.r), 2 * pr.r, 2 * pr.r);
      e.name = 'circle#' + pr.id + ' r=' + fmt(pr.r);
      styleLine(e, false);
      count++;
    } else if (pr.type === 'line') {
      segment(
        layer,
        pr.a,
        pr.b,
        (pr.group === 'axes' ? 'axis#' : 'line#') + pr.id,
        pr.group === 'axes',
      );
      count++;
    } else if (pr.type === 'marker') {
      var h = ms / 2;
      if (pr.shape === 'cross') {
        segment(
          layer,
          { x: pr.at.x - h, y: pr.at.y },
          { x: pr.at.x + h, y: pr.at.y },
          'marker#' + pr.id,
          false,
        );
        segment(
          layer,
          { x: pr.at.x, y: pr.at.y - h },
          { x: pr.at.x, y: pr.at.y + h },
          'marker#' + pr.id,
          false,
        );
      } else {
        var q = layer.pathItems.rectangle(Y(pr.at.y - h / 2), X(pr.at.x - h / 2), h, h);
        q.name = 'marker#' + pr.id;
        styleLine(q, false);
      }
      count++;
    } else if (pr.type === 'unit') {
      var u = layer.pathItems.rectangle(Y(pr.y), X(pr.x), pr.size, pr.size);
      u.name = 'unit#' + pr.id + ' x=' + fmt(pr.size);
      u.filled = true;
      u.fillColor = unitFill;
      u.stroked = false;
      if (pr.label) {
        var tf = layer.textFrames.add();
        // etichetta a destra del quadrato: "x = 12.3 pt", cosi' si capisce cos'e'
        tf.contents = pr.label + ' = ' + fmt(pr.size) + ' pt';
        tf.name = 'label#' + pr.id;
        tf.textRange.characterAttributes.size = Math.max(4, pr.size * 0.45);
        tf.textRange.characterAttributes.fillColor = stroke;
        tf.position = [X(pr.x + pr.size * 1.25), Y(pr.y + pr.size * 0.2)];
      }
      count++;
    } else if (pr.type === 'rect') {
      var r = layer.pathItems.rectangle(Y(pr.y), X(pr.x), pr.w, pr.h);
      r.name = 'clearspace#' + pr.id;
      styleLine(r, pr.dashed);
      count++;
    }
  }
  lockAll(root);
  return { ok: true, count: count, ms: env.now() - t0 };
}
