import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
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
        setEntirePath: (pts: number[][]) => (it['pts'] = pts),
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

  it('registra le funzioni sotto l’id del pannello', () => {
    const { api } = host([square]);
    expect(Object.keys(api).sort()).toEqual([
      'drawPlan',
      'extractSelection',
      'getDocInfo',
      'getSelectionFingerprint',
      'hasConstruction',
      'removeConstruction',
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
    expect(api['getSelectionFingerprint']!()).toBe('logo.ai|0|1|1000,9000,5000,5000#0');
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

  it('RIDISEGNA sostituisce il layer; Rimuovi lo elimina; hasConstruction e impronta lo vedono', () => {
    const { api, app } = host([square]);
    api['drawPlan']!(plan);
    api['drawPlan']!(plan);
    expect(app.activeDocument.layers).toHaveLength(1);
    expect(api['hasConstruction']!()).toBe(true);
    expect(String(api['getSelectionFingerprint']!())).toMatch(/#1$/);
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
});
