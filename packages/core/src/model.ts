// Unità: punti (pt). Coordinate del core: origine in alto a sinistra, Y verso il BASSO (come in SVG).
// Gli adapter convertono dal/verso il sistema dell'host (Illustrator ha la Y verso l'alto).
export type Vec2 = { x: number; y: number };

export type Segment =
  { kind: 'line'; p0: Vec2; p1: Vec2 } | { kind: 'cubic'; p0: Vec2; c1: Vec2; c2: Vec2; p1: Vec2 };

// Il §5.4 usa WarningCode senza definirlo: elenco minimo ricavato dai §4.6 e §5.4.
export type WarningCode =
  'live-text-outlined' | 'clip-ignored' | 'stroke-centerline' | 'too-many-anchors';

export interface PathData {
  id: string; // id stabile assegnato dall'adapter
  glyphId?: string; // tracciato composto o lettera di appartenenza
  closed: boolean;
  filled: boolean;
  stroked: boolean;
  strokeWidth?: number;
  segments: Segment[];
}

export interface DocumentGeometry {
  source: 'illustrator' | 'figma' | 'svg';
  artboard?: { x: number; y: number; width: number; height: number };
  paths: PathData[];
  warnings: WarningCode[]; // es. 'live-text-outlined', 'clip-ignored', 'stroke-centerline'
}

export type SegmentRef = { pathId: string; index: number };

export interface Circle {
  id: string;
  cx: number;
  cy: number;
  r: number;
  support: number;
  refs: SegmentRef[];
  score: number;
}
export interface GuideLine {
  id: string;
  theta: number;
  rho: number; // forma normale
  orientation: 'h' | 'v' | 'd45' | 'free';
  origin: 'segment' | 'anchor-row' | 'tangent';
  support: number;
  score: number;
}
export interface Axis {
  id: string;
  theta: number;
  rho: number;
  error: number;
  score: number;
}

export type RelationKind =
  | 'tangent-line-circle'
  | 'tangent-circle-circle'
  | 'concentric'
  | 'center-on-anchor'
  | 'center-on-line'
  | 'anchor-row'
  | 'anchor-column'
  | 'equal-radius';
export interface Relation {
  id: string;
  kind: RelationKind;
  refs: string[];
  error: number;
  at?: Vec2;
}

export type FindingKind =
  | 'near-arc'
  | 'near-concentric'
  | 'near-equal-radius'
  | 'near-row'
  | 'near-column'
  | 'near-tangent'
  | 'near-symmetry'
  | 'near-angle';
export interface Finding {
  id: string;
  kind: FindingKind;
  severity: 'info' | 'warn';
  refs: string[];
  delta: number;
  unit: 'pt' | '%' | 'deg';
  messageKey: string;
  params: Record<string, string | number>;
  importance: number;
}

export interface Specs {
  unitX: number | null;
  unitXConfidence: 'high' | 'medium' | 'low';
  bbox: { x: number; y: number; width: number; height: number };
  radii: number[];
  notableRatios: { a: string; b: string; ratio: number; name?: string }[];
}

export type Level = 'essential' | 'structure' | 'detail' | 'full';
export type TolerancePreset = 'strict' | 'normal' | 'loose';

export interface AnalysisResult {
  stats: { paths: number; anchors: number; circles: number; lines: number; axes: number };
  circles: Circle[];
  lines: GuideLine[];
  axes: Axis[];
  relations: Relation[];
  findings: Finding[];
  specs: Specs;
  levels: Record<Level, string[]>; // id degli elementi visibili per livello
  /** Tavola del documento (copiata da DocumentGeometry), usata da lineExtent 'artboard'. */
  artboard?: { x: number; y: number; width: number; height: number };
  tolerance: TolerancePreset;
  durationMs: number;
}

export interface DrawStyle {
  strokeWidth: number; // pt
  markerSize: number; // pt
  color: 'auto' | { r: number; g: number; b: number };
  axisDash: [number, number]; // es. [4, 3]
  lineExtent: 'bbox-margin' | 'artboard';
}

export type Primitive =
  | { type: 'circle'; id: string; cx: number; cy: number; r: number; group: 'circles' }
  | { type: 'line'; id: string; a: Vec2; b: Vec2; group: 'lines' | 'axes' }
  | { type: 'marker'; id: string; at: Vec2; shape: 'cross' | 'square'; group: 'markers' }
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

export interface ConstructionPlan {
  layerName: string;
  style: DrawStyle;
  primitives: Primitive[];
}
