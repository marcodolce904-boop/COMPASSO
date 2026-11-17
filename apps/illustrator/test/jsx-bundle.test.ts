import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Esegue l'ExtendScript COMPILATO da Bolt (ES3) con un finto `app`: verifica il bundle reale.
// Serve `pnpm -F illustrator build`; senza build il test viene saltato.
const bundle = join(__dirname, '..', 'dist', 'cep', 'jsx', 'index.js');

describe.skipIf(!existsSync(bundle))('ExtendScript compilato', () => {
  const code = readFileSync(bundle, 'utf8');

  // finto DOM per il disegno: registra layer e oggetti creati
  type Rec = Record<string, unknown>;
  function makeLayer(): Rec {
    const layer: Rec = { name: '', locked: false, visible: true, items: [] as Rec[] };
    const sub: Rec[] = [];
    layer['layers'] = Object.assign(sub, {
      add: () => {
        const l = makeLayer();
        sub.unshift(l);
        return l;
      },
    });
    const item = (kind: string, args: number[] = []) => {
      const it: Rec = {
        kind,
        args,
        name: '',
        setEntirePath: (pts: number[][]) => {
          it['pts'] = pts;
          it['pathPoints'] = pts.map((p) => ({ anchor: p }));
        },
      };
      (layer['items'] as Rec[]).push(it);
      return it;
    };
    layer['pathItems'] = {
      add: () => item('path'),
      ellipse: (...a: number[]) => item('ellipse', a),
      rectangle: (...a: number[]) => item('rect', a),
    };
    layer['textFrames'] = {
      add: () => ({ ...item('text'), textRange: { characterAttributes: {} } }),
    };
    return layer;
  }
  function makeLayers(): Rec[] & { add: () => Rec } {
    const arr: Rec[] = [];
    return Object.assign(arr, {
      add: () => {
        const l = makeLayer();
        l['remove'] = () => arr.splice(arr.indexOf(l), 1);
        arr.unshift(l);
        return l;
      },
    });
  }

  function host(selection: unknown[]) {
    const $: Record<string, Record<string, (...a: unknown[]) => unknown>> = {};
    const app = {
      name: 'Adobe Illustrator',
      coordinateSystem: 'ARTBOARD',
      documents: { length: 1 },
      activeDocument: {
        name: 'logo.ai',
        documentColorSpace: 'CMYK',
        selection,
        layers: makeLayers(),
        pageItems: [] as unknown[],
        artboards: Object.assign([{ artboardRect: [0, 100, 100, 0] }], {
          getActiveArtboardIndex: () => 0,
        }),
      },
    };
    runInNewContext(code, {
      $,
      app,
      CoordinateSystem: { DOCUMENTCOORDINATESYSTEM: 'DOCUMENT' },
      DocumentColorSpace: { CMYK: 'CMYK', RGB: 'RGB' },
      BridgeTalk: { appName: 'illustrator' },
      CMYKColor: class {},
      RGBColor: class {},
      ElementPlacement: { PLACEATEND: 'END' },
      PointType: { SMOOTH: 'SMOOTH', CORNER: 'CORNER' },
    });
    return { api: $['com.marcodolce.compasso']!, app };
  }

  const square = {
    typename: 'PathItem',
    closed: true,
    filled: true,
    stroked: false,
    geometricBounds: [10, 90, 50, 50],
    pathPoints: [
      [10, 90],
      [50, 90],
      [50, 50],
      [10, 50],
    ].map((a) => ({ anchor: a, leftDirection: a, rightDirection: a })),
  };

  it('è solo ASCII (Illustrator su Windows può leggere male gli altri caratteri)', () => {
    let nonAscii = 0;
    for (let i = 0; i < code.length; i++) if (code.charCodeAt(i) > 127) nonAscii++;
    expect(nonAscii).toBe(0);
  });

  it('include json2: funziona anche senza JSON di sistema, come in Illustrator', () => {
    const $: Record<string, unknown> = {};
    const out = runInNewContext(
      'delete this.JSON; var before = typeof JSON; ' +
        code +
        '; [before, typeof JSON.stringify, JSON.stringify({ a: [1, "x"] })]',
      { $, app: { documents: { length: 0 } }, BridgeTalk: { appName: 'illustrator' } },
    ) as string[];
    expect(Array.from(out)).toEqual(['undefined', 'function', '{"a":[1,"x"]}']);
  });

  it('nessun condizionale annidato nel ramo «vero» (ExtendScript: «Previsto: :»)', () => {
    // ExtendScript non sa leggere `a ? b ? x : y : z` senza parentesi; nel ramo «falso»
    // (catene else-if, usate anche da json2) invece funziona.
    const src = ts.createSourceFile('index.js', code, ts.ScriptTarget.ES5, true, ts.ScriptKind.JS);
    const bad: string[] = [];
    const walk = (n: ts.Node): void => {
      if (ts.isConditionalExpression(n) && ts.isConditionalExpression(n.whenTrue)) {
        const line = src.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        bad.push(`riga ${line}: ${n.getText().slice(0, 80)}`);
      }
      ts.forEachChild(n, walk);
    };
    walk(src);
    expect(bad).toEqual([]);
  });

  it('non usa API assenti in ExtendScript (ES3)', () => {
    expect(code).not.toMatch(
      /Object\.(freeze|defineProperty|keys|assign)|Array\.isArray|=>|\blet\b|\bconst\b/,
    );
  });

  it('registra le funzioni sotto l’id del pannello', () => {
    const { api } = host([square]);
    expect(Object.keys(api).sort()).toEqual([
      'applyFix',
      'drawPlan',
      'extractSelection',
      'getDocInfo',
      'getSelectionFingerprint',
      'hasConstruction',
      'removeConstruction',
      'revertFix',
    ]);
  });

  it('extractSelection: Y invertita, coordinate ripristinate', () => {
    const { api, app } = host([square]);
    const r = api['extractSelection']!() as {
      ok: boolean;
      geometry: { paths: { segments: { p0: unknown }[] }[] };
    };
    expect(r.ok).toBe(true);
    expect(r.geometry.paths[0]!.segments[0]!.p0).toEqual({ x: 10, y: 10 });
    expect(r.geometry.paths[0]!.segments).toHaveLength(4);
    expect(app.coordinateSystem).toBe('ARTBOARD');
  });

  it('getDocInfo e impronta', () => {
    const { api } = host([square]);
    expect(api['getDocInfo']!()).toEqual({
      open: true,
      name: 'logo.ai',
      colorMode: 'cmyk',
      artboard: 0,
    });
    expect(api['getSelectionFingerprint']!()).toBe('logo.ai|0|1|1000,9000,5000,5000#0#0');
  });

  const plan = {
    layerName: 'Compasso — Construction',
    style: {
      strokeWidth: 0.75,
      markerSize: 8,
      color: 'auto',
      axisDash: [4, 3],
      lineExtent: 'bbox-margin',
    },
    primitives: [
      { type: 'circle', id: 'c1', cx: 50, cy: 40, r: 20, group: 'circles' },
      { type: 'line', id: 'l1', a: { x: 0, y: 10 }, b: { x: 100, y: 10 }, group: 'lines' },
      { type: 'line', id: 'ax1', a: { x: 50, y: 0 }, b: { x: 50, y: 100 }, group: 'axes' },
      { type: 'marker', id: 'm:c1', at: { x: 50, y: 40 }, shape: 'cross', group: 'markers' },
      { type: 'unit', id: 'unit-x', x: -20, y: -20, size: 10, label: 'x', group: 'specs' },
    ],
  };

  it('drawPlan: layer in cima, sotto-layer, coordinate, colore CMYK, layer bloccato', () => {
    const { api, app } = host([square]);
    const r = api['drawPlan']!(plan) as { ok: boolean; count: number };
    expect(r).toMatchObject({ ok: true, count: 5 });
    const layers = app.activeDocument.layers as unknown as Rec[];
    expect(layers).toHaveLength(1);
    const root = layers[0]!;
    expect(root['name']).toBe('Compasso — Construction');
    expect(root['locked']).toBe(true);
    const subs = root['layers'] as Rec[];
    expect(subs.map((l) => l['name'])).toEqual(['Circles', 'Lines', 'Axes', 'Markers', 'Specs']);
    const circle = (subs[0]!['items'] as Rec[])[0]!;
    // ellipse(top, left, w, h) in coordinate documento: tavola [0,100,100,0], Y in su
    expect(circle['args']).toEqual([80, 30, 40, 40]);
    expect(circle['name']).toBe('circle#c1 r=20');
    expect((circle['strokeColor'] as Rec)['black']).toBe(60);
    const axis = (subs[2]!['items'] as Rec[])[0]!;
    expect(axis['strokeDashes']).toEqual([4, 3]);
    expect(axis['pts']).toEqual([
      [50, 100],
      [50, 0],
    ]);
    expect(subs[3]!['items'] as Rec[]).toHaveLength(2); // croce = due segmenti
    expect(app.coordinateSystem).toBe('ARTBOARD');
  });

  it('drawPlan: ovale ruotato con 4 anchor e maniglie esatte', () => {
    const { api, app } = host([square]);
    const ell = {
      ...plan,
      primitives: [
        {
          type: 'ellipse',
          id: 'e1',
          cx: 50,
          cy: 50,
          rx: 40,
          ry: 20,
          rotation: Math.PI / 2,
          group: 'circles',
        },
      ],
    };
    const r = api['drawPlan']!(ell) as { ok: boolean; count: number };
    expect(r).toMatchObject({ ok: true, count: 1 });
    const root = (app.activeDocument.layers as unknown as Rec[])[0]!;
    const e = ((root['layers'] as Rec[])[0]!['items'] as Rec[])[0]!;
    expect(e['name']).toBe('ellipse#e1 rx=40 ry=20');
    expect(e['closed']).toBe(true);
    const pts = (e['pts'] as number[][]).map((p) => p.map((v) => Math.round(v * 1e6) / 1e6));
    // asse maggiore verticale: in coordinate documento (Y in su) gli anchor sono a ±40 in Y
    expect(pts).toEqual([
      [50, 10],
      [30, 50],
      [50, 90],
      [70, 50],
    ]);
    const pp = e['pathPoints'] as Rec[];
    expect((pp[0]!['rightDirection'] as number[]).map((v) => Math.round(v * 1e3) / 1e3)).toEqual([
      38.954, 10,
    ]);
  });

  it('RIDISEGNA sostituisce il layer; Rimuovi lo elimina; hasConstruction e impronta lo vedono', () => {
    const { api, app } = host([square]);
    api['drawPlan']!(plan);
    api['drawPlan']!(plan);
    expect(app.activeDocument.layers).toHaveLength(1);
    expect(api['hasConstruction']!()).toBe(true);
    expect(String(api['getSelectionFingerprint']!())).toMatch(/#1#0$/);
    expect(api['removeConstruction']!()).toBe(true);
    expect(app.activeDocument.layers).toHaveLength(0);
    expect(api['hasConstruction']!()).toBe(false);
    expect(api['removeConstruction']!()).toBe(false);
  });

  it('gli oggetti del layer di costruzione non entrano nell’analisi', () => {
    const inLayer = { ...square, layer: { name: 'Compasso — Construction' } };
    const { api } = host([inLayer]);
    expect(api['extractSelection']!()).toEqual({ ok: false, reason: 'no-paths' });
  });

  // tracciato simulato che si puo' riscrivere (setEntirePath + maniglie) e duplicare in un layer
  function editable(points: number[][], layer: Rec = { name: 'Livello 1' }): Rec {
    const item: Rec = {
      typename: 'PathItem',
      closed: true,
      filled: true,
      stroked: false,
      hidden: false,
      note: '',
      selected: true,
      layer,
      geometricBounds: [0, 0, 1, 1],
      pathPoints: points.map((a) => ({ anchor: a, leftDirection: a, rightDirection: a })),
    };
    item['setEntirePath'] = (pts: number[][]) => {
      item['pathPoints'] = pts.map((a) => ({ anchor: a, leftDirection: a, rightDirection: a }));
    };
    item['duplicate'] = (target: Rec) => {
      const copy = editable(
        (item['pathPoints'] as { anchor: number[] }[]).map((p) => p.anchor),
        target,
      );
      (target['items'] as Rec[]).push(copy);
      return copy;
    };
    return item;
  }

  it('applyFix: copia corretta nel layer «Corretto», originale nascosto e marcato; Ripristina lo rimette', () => {
    // quadrato con un anchor fuori di 0,3 pt (coordinate documento, tavola [0,100,100,0])
    const original = editable([
      [10, 90],
      [50, 90.3],
      [50, 50],
      [10, 50],
    ]);
    const { api, app } = host([original]);
    const doc = app.activeDocument as unknown as Rec & { layers: Rec[]; pageItems: Rec[] };
    doc['pageItems'] = [original];
    const fixed = [
      {
        id: 'p0',
        closed: true,
        nodes: [
          [10, 10],
          [50, 10],
          [50, 50],
          [10, 50],
        ].map((a) => ({ a, l: a, r: a })),
      },
    ];
    const r = api['applyFix']!(fixed) as { ok: boolean; paths: number };
    expect(r).toMatchObject({ ok: true, paths: 1 });
    const fixLayer = doc.layers.find((l) => String(l['name']).endsWith('Corretto'))!;
    expect(fixLayer).toBeDefined();
    const copy = (fixLayer['items'] as Rec[])[0]!;
    // core (Y in giu') -> documento (Y in su): y_doc = 100 - y_core
    expect(
      (copy['pathPoints'] as { anchor: number[]; pointType: string }[]).map((p) => p.anchor),
    ).toEqual([
      [10, 90],
      [50, 90],
      [50, 50],
      [10, 50],
    ]);
    expect((copy['pathPoints'] as { pointType: string }[])[0]!.pointType).toBe('CORNER');
    expect(original['hidden']).toBe(true);
    expect(original['note']).toBe('compasso:originale');
    expect(String(api['getSelectionFingerprint']!())).toMatch(/#0#1$/);
    expect(app.coordinateSystem).toBe('ARTBOARD');

    const n = api['revertFix']!();
    expect(n).toBe(1);
    expect(original['hidden']).toBe(false);
    expect(original['note']).toBe('');
    expect(doc.layers.some((l) => String(l['name']).endsWith('Corretto'))).toBe(false);
  });

  it("applyFix sulla copia gia' corretta: la aggiorna senza crearne un'altra", () => {
    const fixLayer: Rec = { name: 'Compasso ' + String.fromCharCode(8212) + ' Corretto' };
    const copy = editable(
      [
        [10, 90],
        [50, 90],
        [50, 50],
      ],
      fixLayer,
    );
    const { api, app } = host([copy]);
    const r = api['applyFix']!([
      {
        id: 'p0',
        closed: true,
        nodes: [
          [10, 10],
          [60, 10],
          [50, 50],
        ].map((a) => ({ a, l: a, r: a })),
      },
    ]) as { ok: boolean; paths: number };
    expect(r.paths).toBe(1);
    expect((app.activeDocument as unknown as { layers: unknown[] }).layers).toHaveLength(0);
    expect((copy['pathPoints'] as { anchor: number[] }[])[1]!.anchor).toEqual([60, 90]);
  });
});
