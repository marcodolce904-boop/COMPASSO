import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, parseSvg, type DocumentGeometry, type PathData } from '@compasso/core';
import {
  extractSelection,
  selectionFingerprint,
  MANY_ANCHORS,
  type AiDocument,
  type AiItem,
  type AiPathPoint,
  type XGeometry,
} from '../src/jsx/ilst/extract';
import { FIXTURES } from '../../../scripts/fixtures-def';

// Il risultato dell'estrattore deve essere assegnabile al contratto del core (§5.4).
const _contract = (g: XGeometry): DocumentGeometry => g;
void _contract;

// Tavola attiva NON all'origine (checklist §10.4): in Illustrator la Y cresce verso l'alto.
const AB = { left: 100, top: 500, width: 200, height: 200 };
const toDoc = (p: { x: number; y: number }) => [p.x + AB.left, AB.top - p.y];

/** PathData del core → PathItem simulato di Illustrator. */
function aiPath(p: PathData, style: Partial<AiItem> = {}): AiItem {
  const segs = p.segments;
  const n = p.closed ? segs.length : segs.length + 1;
  const pts: AiPathPoint[] = [];
  for (let i = 0; i < n; i++) {
    const out = segs[i];
    const inn = p.closed ? segs[(i - 1 + segs.length) % segs.length]! : segs[i - 1];
    const anchor = out ? out.p0 : inn!.p1;
    const right = out ? (out.kind === 'cubic' ? out.c1 : out.p0) : anchor;
    const left = inn ? (inn.kind === 'cubic' ? inn.c2 : inn.p1) : anchor;
    pts.push({ anchor: toDoc(anchor), rightDirection: toDoc(right), leftDirection: toDoc(left) });
  }
  return {
    typename: 'PathItem',
    pathPoints: pts,
    closed: p.closed,
    filled: p.filled,
    stroked: p.stroked,
    strokeWidth: p.strokeWidth ?? 1,
    ...style,
  };
}

/** DocumentGeometry (da SVG) → selezione simulata: i glifi diventano tracciati composti. */
function aiDocFrom(g: DocumentGeometry, wrapInGroup = true): AiDocument {
  const items: AiItem[] = [];
  const byGlyph = new Map<string, AiItem>();
  for (const p of g.paths) {
    if (p.glyphId) {
      let c = byGlyph.get(p.glyphId);
      if (!c) {
        c = { typename: 'CompoundPathItem', pathItems: [] as unknown as AiItem['pathItems'] };
        byGlyph.set(p.glyphId, c);
        items.push(c);
      }
      (c.pathItems as unknown as AiItem[]).push(aiPath(p));
    } else items.push(aiPath(p));
  }
  const selection = wrapInGroup ? [{ typename: 'GroupItem', pageItems: items } as AiItem] : items;
  return {
    name: 'test.ai',
    selection,
    artboards: Object.assign(
      [{ artboardRect: [AB.left, AB.top, AB.left + AB.width, AB.top - AB.height] }],
      {
        getActiveArtboardIndex: () => 0,
      },
    ),
  };
}

const strip = (r: ReturnType<typeof analyze>) => ({ ...r, durationMs: 0 });

describe.each(FIXTURES)('parità harness ↔ Illustrator: $file', (fx) => {
  const svgGeom = parseSvg(
    readFileSync(join(__dirname, '..', '..', '..', 'fixtures', 'svg', fx.file), 'utf8'),
  );
  const res = extractSelection(aiDocFrom(svgGeom));

  it('estrae la selezione', () => {
    expect(res.ok).toBe(true);
  });

  it('stessa geometria (coordinate tavola, Y in giù)', () => {
    if (!res.ok) throw new Error(res.reason);
    expect(res.geometry.paths).toHaveLength(svgGeom.paths.length);
    expect(res.geometry.artboard).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    const a = res.geometry.paths[0]!.segments[0]!;
    const b = svgGeom.paths[0]!.segments[0]!;
    expect(a.p0.x).toBeCloseTo(b.p0.x, 9);
    expect(a.p0.y).toBeCloseTo(b.p0.y, 9);
  });

  it('stessi numeri dell’analisi dell’harness', () => {
    if (!res.ok) throw new Error(res.reason);
    const ra = analyze(res.geometry);
    const rb = analyze(svgGeom);
    expect(ra.stats).toEqual(rb.stats);
    expect(ra.findings.map((f) => [f.kind, f.delta])).toEqual(
      rb.findings.map((f) => [f.kind, f.delta]),
    );
    expect(ra.specs.unitX).toEqual(rb.specs.unitX);
    for (let i = 0; i < rb.circles.length; i++) {
      expect(ra.circles[i]!.r).toBeCloseTo(rb.circles[i]!.r, 6);
      expect(ra.circles[i]!.cx).toBeCloseTo(rb.circles[i]!.cx, 6);
    }
    expect(strip(ra).levels).toEqual(strip(rb).levels);
  });
});

describe('extractSelection: casi limite (§4.6)', () => {
  const g = parseSvg('<svg><rect x="10" y="10" width="50" height="40"/></svg>');

  it('nessun documento / nessuna selezione', () => {
    expect(extractSelection(null)).toEqual({ ok: false, reason: 'no-document' });
    expect(extractSelection({ ...aiDocFrom(g), selection: [] })).toEqual({
      ok: false,
      reason: 'no-selection',
    });
  });

  it('maschera di ritaglio: il tracciato di ritaglio è ignorato con avviso', () => {
    const doc = aiDocFrom(g, false);
    const clip = aiPath(g.paths[0]!, { clipping: true });
    doc.selection = [
      { typename: 'GroupItem', clipped: true, pageItems: [clip, ...(doc.selection as AiItem[])] },
    ];
    const r = extractSelection(doc);
    if (!r.ok) throw new Error(r.reason);
    expect(r.geometry.paths).toHaveLength(1);
    expect(r.geometry.warnings).toContain('clip-ignored');
  });

  it('testo vivo: legge una copia convertita in tracciati e la elimina', () => {
    const doc = aiDocFrom(g, false);
    let removed = 0;
    const outline: AiItem = {
      typename: 'GroupItem',
      pageItems: doc.selection as AiItem[],
      remove: () => removed++,
    };
    const text: AiItem = {
      typename: 'TextFrame',
      duplicate: () => ({ typename: 'TextFrame', createOutline: () => outline }),
    };
    doc.selection = [text];
    const r = extractSelection(doc);
    if (!r.ok) throw new Error(r.reason);
    expect(r.geometry.warnings).toContain('live-text-outlined');
    expect(removed).toBe(1);
  });

  it('tracciato aperto con contorno: avviso linea centrale', () => {
    const open = parseSvg('<svg><path d="M0 0 L50 0 L50 50" fill="none" stroke="#000"/></svg>');
    const r = extractSelection(aiDocFrom(open));
    if (!r.ok) throw new Error(r.reason);
    expect(r.geometry.warnings).toEqual(['stroke-centerline']);
    expect(r.geometry.paths[0]!.closed).toBe(false);
  });

  it('oggetti nascosti e guide ignorati; solo immagini → nessun tracciato', () => {
    const doc = aiDocFrom(g, false);
    doc.selection = [
      { ...(doc.selection as AiItem[])[0]!, hidden: true },
      { typename: 'RasterItem' },
    ];
    expect(extractSelection(doc)).toEqual({ ok: false, reason: 'no-paths' });
  });

  it(`più di ${MANY_ANCHORS} anchor: avviso`, () => {
    const big = Array.from(
      { length: 800 },
      (_, i) => `<rect x="${i}" y="0" width="0.5" height="1"/>`,
    ).join('');
    const r = extractSelection(aiDocFrom(parseSvg(`<svg>${big}</svg>`)));
    if (!r.ok) throw new Error(r.reason);
    expect(r.anchors).toBe(3200);
    expect(r.geometry.warnings).toContain('too-many-anchors');
  });

  it('impronta della selezione: cambia solo se cambia la selezione', () => {
    const doc = aiDocFrom(g, false);
    (doc.selection as AiItem[])[0]!.geometricBounds = [110, 490, 160, 450];
    const f1 = selectionFingerprint(doc);
    expect(selectionFingerprint(doc)).toBe(f1);
    (doc.selection as AiItem[])[0]!.geometricBounds = [111, 490, 160, 450];
    expect(selectionFingerprint(doc)).not.toBe(f1);
    expect(selectionFingerprint(null)).toBe('none');
  });
});
