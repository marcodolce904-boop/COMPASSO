import type {
  AnalysisResult,
  ConstructionPlan,
  DocumentGeometry,
  Finding,
  PathData,
  Segment,
  Vec2,
} from '@compasso/core';
import type { Lang } from './strings';
import { num, t } from './strings';

const f = (v: number) => Number(v.toFixed(3));

/** Attributo `d` SVG di un tracciato. */
export function pathD(p: PathData): string {
  if (p.segments.length === 0) return '';
  const first = p.segments[0]!;
  let d = `M${f(first.p0.x)} ${f(first.p0.y)}`;
  for (const s of p.segments) d += segD(s);
  return p.closed ? d + 'Z' : d;
}

function segD(s: Segment): string {
  return s.kind === 'line'
    ? `L${f(s.p1.x)} ${f(s.p1.y)}`
    : `C${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.p1.x)} ${f(s.p1.y)}`;
}

export interface LogoShape {
  key: string;
  d: string;
  filled: boolean;
  strokeWidth: number;
}

/** Tracciati del logo, uniti per glifo (così i buchi dei tracciati composti restano vuoti). */
export function logoShapes(g: DocumentGeometry): LogoShape[] {
  const byGlyph = new Map<string, LogoShape>();
  for (const p of g.paths) {
    const key = p.glyphId ?? p.id;
    const prev = byGlyph.get(key);
    const d = pathD(p);
    if (prev) prev.d += d;
    else byGlyph.set(key, { key, d, filled: p.filled, strokeWidth: p.strokeWidth ?? 1 });
  }
  return [...byGlyph.values()];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** viewBox che contiene logo e piano, con un margine del 3%. */
export function viewBoxFor(result: AnalysisResult, plan: ConstructionPlan | null): Box {
  const b = result.specs.bbox;
  let x0 = b.x,
    y0 = b.y,
    x1 = b.x + b.width,
    y1 = b.y + b.height;
  const grow = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const p of plan?.primitives ?? []) {
    if (p.type === 'circle') {
      grow(p.cx - p.r, p.cy - p.r);
      grow(p.cx + p.r, p.cy + p.r);
    } else if (p.type === 'ellipse') {
      const c = Math.cos(p.rotation);
      const s = Math.sin(p.rotation);
      const hw = Math.hypot(p.rx * c, p.ry * s);
      const hh = Math.hypot(p.rx * s, p.ry * c);
      grow(p.cx - hw, p.cy - hh);
      grow(p.cx + hw, p.cy + hh);
    } else if (p.type === 'line') {
      grow(p.a.x, p.a.y);
      grow(p.b.x, p.b.y);
    } else if (p.type === 'rect') {
      grow(p.x, p.y);
      grow(p.x + p.w, p.y + p.h);
    } else if (p.type === 'unit') {
      grow(p.x, p.y - p.size);
      grow(p.x + p.size, p.y + p.size);
    }
  }
  const w = Math.max(x1 - x0, 1e-6),
    h = Math.max(y1 - y0, 1e-6);
  const m = 0.03 * Math.max(w, h);
  return { x: x0 - m, y: y0 - m, width: w + 2 * m, height: h + 2 * m };
}

export interface Highlight {
  /** id di cerchi, rette, assi e primitive da evidenziare. */
  ids: Set<string>;
  /** Segmenti del logo coinvolti (finding `near-arc`, `near-angle`). */
  segments: string[];
  /** Anchor coinvolti (finding `near-row`, `near-symmetry`). */
  anchors: Vec2[];
  /** Assi candidati da mostrare tratteggiati (finding `near-symmetry`). */
  axes: { theta: number; rho: number }[];
}

export const emptyHighlight = (): Highlight => ({
  ids: new Set(),
  segments: [],
  anchors: [],
  axes: [],
});

/**
 * Cosa evidenziare nell'anteprima: l'elemento sotto il mouse, oppure gli elementi di un
 * finding selezionato. Gli id `s:<path>:<i>` sono segmenti, `a:<path>:<i>` anchor.
 */
export function highlightFor(
  geom: DocumentGeometry | null,
  hoverId: string | null,
  finding: Finding | null,
): Highlight {
  const h = emptyHighlight();
  if (hoverId) h.ids.add(hoverId);
  if (!finding) return h;
  const pathById = new Map((geom?.paths ?? []).map((p) => [p.id, p]));
  for (const ref of finding.refs) {
    const m = /^([sa]):(.+):(\d+)$/.exec(ref);
    if (!m) {
      h.ids.add(ref);
      continue;
    }
    const path = pathById.get(m[2]!);
    const i = Number(m[3]);
    if (!path) continue;
    if (m[1] === 's') {
      const s = path.segments[i];
      if (s) h.segments.push(`M${f(s.p0.x)} ${f(s.p0.y)}${segD(s)}`);
    } else {
      const s = path.segments[i] ?? path.segments[path.segments.length - 1];
      if (s) h.anchors.push(path.segments[i] ? s.p0 : s.p1);
    }
  }
  if (finding.kind === 'near-symmetry') {
    h.axes.push({
      theta: (Number(finding.params['theta']) * Math.PI) / 180,
      rho: Number(finding.params['rho']),
    });
  }
  return h;
}

/** Testo per «Copia misure» (§4.2 B3). */
export function specsText(lang: Lang, r: AnalysisResult, clearspace: number): string {
  const s = r.specs;
  const lines: string[] = [];
  lines.push(
    s.unitX === null
      ? t(lang, 'specs.unitXUnknown')
      : `${t(lang, 'specs.unitX')}: ${num(lang, s.unitX, 2)} pt (${t(lang, `specs.confidence.${s.unitXConfidence}`)})`,
  );
  lines.push(
    `${t(lang, 'specs.bbox')}: ${num(lang, s.bbox.width, 2)} × ${num(lang, s.bbox.height, 2)} pt · ${ratioText(lang, s.bbox)}`,
  );
  lines.push(
    `${t(lang, 'specs.radii')}: ${s.radii.length ? s.radii.map((v) => `${num(lang, v, 2)} pt`).join(' · ') : t(lang, 'specs.noRadii')}`,
  );
  for (const q of s.notableRatios) {
    lines.push(
      `  ${q.a} : ${q.b} = ${num(lang, q.ratio, 3)}${q.name ? ` (${t(lang, `ratio.${q.name}` as Parameters<typeof t>[1])})` : ''}`,
    );
  }
  if (s.unitX !== null) {
    lines.push(
      `${t(lang, 'specs.clearspace')}: ${num(lang, clearspace, 1)} x = ${num(lang, clearspace * s.unitX, 2)} pt`,
    );
  }
  return lines.join('\n');
}

/** Proporzione del bounding box «1 : 1,12» (lato corto = 1). */
export function ratioText(lang: Lang, b: { width: number; height: number }): string {
  if (b.width <= 0 || b.height <= 0) return '—';
  return b.width <= b.height
    ? `1 : ${num(lang, b.height / b.width, 2)}`
    : `${num(lang, b.width / b.height, 2)} : 1`;
}

/** Riquadro che contiene uno o più loghi (punti e maniglie), con un margine del 4%. */
export function geometryBox(...geoms: (DocumentGeometry | null | undefined)[]): Box | null {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const g of geoms) {
    for (const p of g?.paths ?? []) {
      for (const s of p.segments) {
        const pts = s.kind === 'line' ? [s.p0, s.p1] : [s.p0, s.c1, s.c2, s.p1];
        for (const q of pts) {
          x0 = Math.min(x0, q.x);
          y0 = Math.min(y0, q.y);
          x1 = Math.max(x1, q.x);
          y1 = Math.max(y1, q.y);
        }
      }
    }
  }
  if (!Number.isFinite(x0)) return null;
  const w = Math.max(x1 - x0, 1e-6);
  const h = Math.max(y1 - y0, 1e-6);
  const m = 0.04 * Math.max(w, h);
  return { x: x0 - m, y: y0 - m, width: w + 2 * m, height: h + 2 * m };
}

/** Anchor dell'originale che la correzione ha spostato (oltre `min` pt). */
export function movedAnchors(
  before: DocumentGeometry,
  after: DocumentGeometry,
  min = 0.05,
): Vec2[] {
  const a = before.paths.flatMap((p) => p.segments.map((s) => s.p0));
  const b = after.paths.flatMap((p) => p.segments.map((s) => s.p0));
  if (a.length * b.length > 4_000_000) return [];
  return a.filter((p) => !b.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= min));
}
