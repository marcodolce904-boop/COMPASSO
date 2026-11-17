import type { RasterImage, Vec2 } from '../../src';

function rng(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Foglio bianco w×h (RGBA). */
export function paper(w: number, h: number): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  return { width: w, height: h, data };
}

/** Disco di grafite (grigio `tone`) in (x, y). */
function dab(img: RasterImage, x: number, y: number, r: number, tone: number) {
  for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++)
    for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
      if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) continue;
      if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 > r * r) continue;
      const i = (yy * img.width + xx) * 4;
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.min(img.data[i + c]!, tone);
    }
}

/**
 * Tratto a matita lungo una polilinea: `passes` passate, ognuna spostata e ondeggiante di
 * ±`wobble` px, spessore `width` px, grigio `tone`.
 */
export function pencil(
  img: RasterImage,
  pts: Vec2[],
  opts: { width?: number; passes?: number; wobble?: number; tone?: number; seed?: number } = {},
) {
  const { width = 3, passes = 3, wobble = 2, tone = 70, seed = 1 } = opts;
  const r = rng(seed);
  for (let p = 0; p < passes; p++) {
    const ox = (r() - 0.5) * 2 * wobble;
    const oy = (r() - 0.5) * 2 * wobble;
    const ph = r() * 6.28;
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      for (let t = 0; t <= d; t += 0.7) {
        s += 0.7;
        const w = Math.sin(s / 40 + ph) * wobble * 0.5;
        dab(
          img,
          a.x + ((b.x - a.x) * t) / d + ox + w,
          a.y + ((b.y - a.y) * t) / d + oy - w,
          width / 2,
          tone,
        );
      }
    }
  }
}

/** Zona piena (tratteggio fitto): riempie un poligono. */
export function fill(img: RasterImage, poly: Vec2[], tone = 80) {
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i]!;
        const b = poly[j]!;
        if (
          a.y > y + 0.5 !== b.y > y + 0.5 &&
          x + 0.5 < ((b.x - a.x) * (y + 0.5 - a.y)) / (b.y - a.y) + a.x
        )
          c = !c;
      }
      if (c) {
        const i = (y * img.width + x) * 4;
        for (let k = 0; k < 3; k++) img.data[i + k] = tone;
      }
    }
}

export const circlePts = (cx: number, cy: number, r: number, n = 200, rx = r): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    return { x: cx + rx * Math.cos(t), y: cy + r * Math.sin(t) };
  });
