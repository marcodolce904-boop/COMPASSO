export * from './model';
export * from './math';
export { parseSvg } from './extract/parseSvg';
export { parsePathData, arcToCubics, quadToCubic, KAPPA } from './extract/pathParser';
export { normalizeGeometry, geometryBBox, type NormalizedGeometry } from './normalize';
export { kappaArc, type KappaArc } from './fit/kappa';
export { fitCircleTaubin, fitCircleKasa, maxRadialDeviation, type CircleFit } from './fit/taubin';
export {
  detectArcs,
  arcTolerance,
  type DetectedArc,
  type DetectedEllipse,
  type ArcDetection,
  type ArcTolerance,
} from './fit/arcs';
export { analyze } from './analyze';
export { plan, LAYER_NAME, type PlanOptions } from './plan/plan';
export { tolerances, type Tolerances, type Band } from './tolerance';
export {
  refine,
  refineDefaults,
  type RefineOptions,
  type RefineReport,
  type RefineResult,
  type SymmetryAxis,
} from './fix/refine';
export { arcSpline, type ArcPiece } from './fit/arcspline';
export { findMirrorAxis, mirrorHalf, type MirrorAxis, type MirrorKeep } from './fix/mirror';
export { UNIT_ID } from './rank/rank';
export {
  fitEllipse,
  ellipsePoint,
  ellipseDistance,
  nearestParam,
  toEllipseFrame,
  type EllipseFit,
} from './fit/ellipse';
export {
  buildReport,
  parseReport,
  reportFileName,
  meetsExpected,
  grayOf,
  rasterOfGray,
  bytesToBase64,
  base64ToBytes,
  type CompassoReport,
  type ReportTrace,
  type ReportExpect,
  type Expected,
} from './report';
export {
  trace,
  traceDefaults,
  type TraceMode,
  type TraceOptions,
  type TracePlacement,
  type TraceOutput,
  type TraceTuning,
  FULL_TUNING,
} from './trace/trace';
export { downscale, type RasterImage, type Mask } from './trace/raster';
export {
  PERFECT_DEFAULTS,
  perfectPlan,
  type PerfectOptions,
  type PerfectReport,
  type PerfectSymmetry,
} from './trace/perfect';
export {
  toEdit,
  fromEdit,
  isSmooth,
  moveNodes,
  moveHandle,
  insertNode,
  removeNode,
  toggleCorner,
  nearestOnPaths,
  type EditNode,
  type EditPath,
  type NodeRef,
} from './edit/edit';
export {
  generate,
  generateDefaults,
  type GenerateMode,
  type GenerateOptions,
  type GenerateReport,
  type GenerateGuides,
  type GenerateResult,
  type GenerateNote,
  type MinimalLevel,
} from './generate/generate';
export type { MathOptions } from './generate/math';
export type { GoldenOptions, GoldenRatio } from './generate/golden';
