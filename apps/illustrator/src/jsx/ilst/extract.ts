// Estrazione della selezione di Illustrator → DocumentGeometry (SPEC §6.1).
// Gira in ExtendScript: Bolt lo traduce in ES3. Solo cicli `for`, niente API moderne,
// nessun import dal core (le forme dei dati replicano il contratto §5.4; un test ne verifica
// la compatibilità). Il modulo non tocca `app`: riceve il documento, così si testa in Node.

export interface XVec {
  x: number;
  y: number;
}
export type XSegment =
  { kind: 'line'; p0: XVec; p1: XVec } | { kind: 'cubic'; p0: XVec; c1: XVec; c2: XVec; p1: XVec };
export interface XPath {
  id: string;
  glyphId?: string;
  closed: boolean;
  filled: boolean;
  stroked: boolean;
  strokeWidth?: number;
  segments: XSegment[];
}
export type XWarning =
  'live-text-outlined' | 'clip-ignored' | 'stroke-centerline' | 'too-many-anchors';
export interface XGeometry {
  source: 'illustrator';
  artboard: { x: number; y: number; width: number; height: number };
  paths: XPath[];
  warnings: XWarning[];
}
export type ExtractResult =
  | { ok: true; geometry: XGeometry; anchors: number }
  | { ok: false; reason: 'no-document' | 'no-selection' | 'no-paths' };

/** Oltre questa soglia il pannello chiede conferma prima di analizzare (§4.6). */
export var MANY_ANCHORS = 3000;

// --- forme minime del DOM di Illustrator che usiamo (coordinate del documento, Y in su) ---
export interface AiPathPoint {
  anchor: number[];
  leftDirection: number[];
  rightDirection: number[];
}
export interface AiItem {
  typename: string;
  hidden?: boolean;
  // PathItem
  pathPoints?: { length: number; [i: number]: AiPathPoint };
  closed?: boolean;
  filled?: boolean;
  stroked?: boolean;
  strokeWidth?: number;
  clipping?: boolean;
  guides?: boolean;
  // CompoundPathItem
  pathItems?: { length: number; [i: number]: AiItem };
  // GroupItem
  pageItems?: { length: number; [i: number]: AiItem };
  clipped?: boolean;
  // TextFrame
  duplicate?: () => AiItem;
  createOutline?: () => AiItem;
  remove?: () => void;
  geometricBounds?: number[];
  layer?: { name: string };
}
export interface AiDocument {
  name?: string;
  selection: AiItem[] | { length?: number; [i: number]: AiItem } | null;
  artboards: {
    getActiveArtboardIndex: () => number;
    [i: number]: { artboardRect: number[] };
  };
}

interface Ctx {
  left: number;
  top: number;
  paths: XPath[];
  warn: { [k: string]: boolean };
  nextPath: number;
  nextGlyph: number;
  anchors: number;
  temp: AiItem[];
}

function pt(ctx: Ctx, p: number[]): XVec {
  // documento (Y in su) → core (origine in alto a sinistra della tavola attiva, Y in giù)
  return { x: p[0] - ctx.left, y: ctx.top - p[1] };
}

function same(a: number[], b: number[]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function readPath(ctx: Ctx, item: AiItem, glyphId: string | null, style: AiItem): void {
  if (item.guides || item.clipping) return;
  var pts = item.pathPoints;
  if (!pts || pts.length < 2) return;
  var n = pts.length;
  var closed = !!item.closed;
  var segments: XSegment[] = [];
  var last = closed ? n : n - 1;
  for (var i = 0; i < last; i++) {
    var a = pts[i];
    var b = pts[(i + 1) % n];
    if (same(a.rightDirection, a.anchor) && same(b.leftDirection, b.anchor)) {
      segments.push({ kind: 'line', p0: pt(ctx, a.anchor), p1: pt(ctx, b.anchor) });
    } else {
      segments.push({
        kind: 'cubic',
        p0: pt(ctx, a.anchor),
        c1: pt(ctx, a.rightDirection),
        c2: pt(ctx, b.leftDirection),
        p1: pt(ctx, b.anchor),
      });
    }
  }
  ctx.anchors += n;
  var filled = !!style.filled;
  var stroked = !!style.stroked;
  if (!closed && stroked) ctx.warn['stroke-centerline'] = true;
  var path: XPath = {
    id: 'p' + ctx.nextPath++,
    closed: closed,
    filled: filled,
    stroked: stroked,
    segments: segments,
  };
  if (glyphId !== null) path.glyphId = glyphId;
  if (stroked && typeof style.strokeWidth === 'number') path.strokeWidth = style.strokeWidth;
  ctx.paths.push(path);
}

/** Layer della costruzione di Compasso: i suoi oggetti non fanno parte del logo. */
export var CONSTRUCTION_LAYER = 'Compasso — Construction';

function inConstructionLayer(item: AiItem): boolean {
  var l = item.layer as { name: string; parent?: { name?: string; typename?: string } } | undefined;
  while (l) {
    if (l.name === CONSTRUCTION_LAYER) return true;
    l = l.parent && l.parent.typename === 'Layer' ? (l.parent as { name: string }) : undefined;
  }
  return false;
}

function visit(ctx: Ctx, item: AiItem, glyphId: string | null): void {
  if (!item || item.hidden || inConstructionLayer(item)) return;
  var t = item.typename;
  if (t === 'PathItem') {
    readPath(ctx, item, glyphId, item);
  } else if (t === 'CompoundPathItem') {
    var parts = item.pathItems;
    if (!parts || parts.length === 0) return;
    if (parts[0].clipping) {
      ctx.warn['clip-ignored'] = true;
      return;
    }
    var g = glyphId !== null ? glyphId : 'g' + ctx.nextGlyph++;
    // lo stile di un tracciato composto è quello dei suoi sotto-tracciati (uguale per tutti)
    for (var i = 0; i < parts.length; i++) readPath(ctx, parts[i], g, parts[0]);
  } else if (t === 'GroupItem') {
    var items = item.pageItems;
    if (!items) return;
    if (item.clipped) ctx.warn['clip-ignored'] = true;
    for (var j = 0; j < items.length; j++) {
      var child = items[j];
      if (item.clipped && child.clipping) continue;
      visit(ctx, child, glyphId);
    }
  } else if (t === 'TextFrame') {
    // testo vivo: si converte una copia in tracciati, si legge, poi si elimina (§4.6)
    if (!item.duplicate) return;
    var copy = item.duplicate();
    if (!copy.createOutline) return;
    var outlined = copy.createOutline();
    ctx.temp.push(outlined);
    ctx.warn['live-text-outlined'] = true;
    visit(ctx, outlined, null);
  }
  // PlacedItem, RasterItem, SymbolItem, PluginItem…: ignorati nella v1
}

/** Legge la selezione del documento nel sistema di coordinate della tavola attiva. */
export function extractSelection(doc: AiDocument | null): ExtractResult {
  if (!doc) return { ok: false, reason: 'no-document' };
  var sel = doc.selection as { length?: number; [i: number]: AiItem } | null;
  if (!sel || !sel.length) return { ok: false, reason: 'no-selection' };
  var rect = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect; // [l, t, r, b]
  var ctx: Ctx = {
    left: rect[0],
    top: rect[1],
    paths: [],
    warn: {},
    nextPath: 0,
    nextGlyph: 0,
    anchors: 0,
    temp: [],
  };
  try {
    for (var i = 0; i < sel.length; i++) visit(ctx, sel[i], null);
  } finally {
    for (var k = 0; k < ctx.temp.length; k++) {
      try {
        if (ctx.temp[k].remove) ctx.temp[k].remove!();
      } catch (e) {
        // la copia potrebbe essere già stata rimossa: niente da fare
        void e;
      }
    }
  }
  if (ctx.paths.length === 0) return { ok: false, reason: 'no-paths' };
  if (ctx.anchors > MANY_ANCHORS) ctx.warn['too-many-anchors'] = true;
  var warnings: XWarning[] = [];
  var order: XWarning[] = [
    'live-text-outlined',
    'clip-ignored',
    'stroke-centerline',
    'too-many-anchors',
  ];
  for (var w = 0; w < order.length; w++) if (ctx.warn[order[w]]) warnings.push(order[w]);
  return {
    ok: true,
    anchors: ctx.anchors,
    geometry: {
      source: 'illustrator',
      artboard: { x: 0, y: 0, width: rect[2] - rect[0], height: rect[1] - rect[3] },
      paths: ctx.paths,
      warnings: warnings,
    },
  };
}

/**
 * Impronta leggera della selezione (§8.4): nome documento, tavola attiva, numero di oggetti e
 * bounds arrotondati. Il pannello estrae e analizza solo quando l'impronta cambia.
 */
export function selectionFingerprint(doc: AiDocument | null): string {
  if (!doc) return 'none';
  var sel = doc.selection as { length?: number; [i: number]: AiItem } | null;
  var n = sel && sel.length ? sel.length : 0;
  var s = (doc.name || '') + '|' + doc.artboards.getActiveArtboardIndex() + '|' + n;
  var max = n < 50 ? n : 50;
  for (var i = 0; i < max; i++) {
    var b = sel![i].geometricBounds;
    if (b)
      s +=
        '|' +
        Math.round(b[0] * 100) +
        ',' +
        Math.round(b[1] * 100) +
        ',' +
        Math.round(b[2] * 100) +
        ',' +
        Math.round(b[3] * 100);
  }
  return s;
}
