import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Esegue l'ExtendScript COMPILATO da Bolt (ES3) con un finto `app`: verifica il bundle reale.
// Serve `pnpm -F illustrator build`; senza build il test viene saltato.
const bundle = join(__dirname, '..', 'dist', 'cep', 'jsx', 'index.js');

describe.skipIf(!existsSync(bundle))('ExtendScript compilato', () => {
  const code = readFileSync(bundle, 'utf8');

  function host(selection: unknown[]) {
    const $: Record<string, Record<string, () => unknown>> = {};
    const app = {
      name: 'Adobe Illustrator',
      coordinateSystem: 'ARTBOARD',
      documents: { length: 1 },
      activeDocument: {
        name: 'logo.ai',
        documentColorSpace: 'CMYK',
        selection,
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
      'extractSelection',
      'getDocInfo',
      'getSelectionFingerprint',
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
    expect(api['getSelectionFingerprint']!()).toBe('logo.ai|0|1|1000,9000,5000,5000');
  });
});
