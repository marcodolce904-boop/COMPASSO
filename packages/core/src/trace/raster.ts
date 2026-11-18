// Operazioni sull'immagine (maschere binarie): soglia adattiva, chiusura morfologica, macchie.
// Tutto in O(pixel) con somme cumulative: le foto di uno schizzo hanno milioni di pixel.

/** Immagine RGBA (come ImageData del browser). */
export interface RasterImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Maschera binaria: 1 = inchiostro. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Luminanza 0–255; i pixel trasparenti contano come carta bianca. */
export function luminance(img: RasterImage): Float32Array {
  const n = img.width * img.height;
  const out = new Float32Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3]! / 255;
    const l = 0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!;
    out[i] = l * a + 255 * (1 - a);
  }
  return out;
}

/** Media su una finestra quadrata (lato 2r+1) con l'immagine integrale. */
function boxMean(v: Float32Array, w: number, h: number, r: number): Float32Array {
  const W = w + 1;
  const integ = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += v[y * w + x]!;
      integ[(y + 1) * W + x + 1] = integ[y * W + x + 1]! + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s =
        integ[y1 * W + x1]! - integ[y0 * W + x1]! - integ[y1 * W + x0]! + integ[y0 * W + x0]!;
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/**
 * Soglia adattiva: un pixel è inchiostro se è più scuro della media dei vicini di almeno
 * `sensitivity` livelli (resiste alle ombre e alla luce non uniforme delle foto) e comunque
 * più scuro della carta (`paper`).
 */
export function adaptiveThreshold(
  img: RasterImage,
  sensitivity: number,
  win: number,
  paper = 235,
): Mask {
  const { width: w, height: h } = img;
  const lum = luminance(img);
  const mean = boxMean(lum, w, h, Math.max(1, Math.floor(win / 2)));
  // soglia globale (Otsu) per le zone piene grandi, dove la media locale è scura come il pixel
  const dark = otsu(lum) - sensitivity;
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const l = lum[i]!;
    data[i] = l < paper && (l < mean[i]! - sensitivity || l < dark) ? 1 : 0;
  }
  return { width: w, height: h, data };
}

/** Soglia di Otsu sull'istogramma della luminanza. */
export function otsu(lum: Float32Array): number {
  const hist = new Float64Array(256);
  for (const l of lum) hist[Math.max(0, Math.min(255, Math.round(l)))]!++;
  const total = lum.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0,
    wB = 0,
    best = 0,
    thr = 128,
    thrEnd = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best * (1 + 1e-9)) {
      best = between;
      thr = t;
      thrEnd = t;
    } else if (between >= best * (1 - 1e-9)) thrEnd = t;
  }
  // a parità (istogramma con valli piatte) si prende il centro della valle
  return (thr + thrEnd) / 2;
}

/** Somme in una finestra 1D (lato 2r+1) lungo righe o colonne. */
function windowCount(src: Uint8Array, w: number, h: number, r: number, horizontal: boolean) {
  const out = new Uint16Array(w * h);
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const at = (line: number, k: number) => (horizontal ? line * w + k : k * w + line);
  for (let line = 0; line < lines; line++) {
    let s = 0;
    for (let k = 0; k < Math.min(r, len); k++) s += src[at(line, k)]!;
    for (let k = 0; k < len; k++) {
      if (k + r < len) s += src[at(line, k + r)]!;
      if (k - r - 1 >= 0) s -= src[at(line, k - r - 1)]!;
      out[at(line, k)] = s;
    }
  }
  return out;
}

/** Dilatazione con un quadrato di lato 2r+1. */
export function dilate(m: Mask, r: number): Mask {
  if (r <= 0) return { ...m, data: m.data.slice() };
  const { width: w, height: h } = m;
  const hz = windowCount(m.data, w, h, r, true);
  const tmp = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) tmp[i] = hz[i]! > 0 ? 1 : 0;
  const vt = windowCount(tmp, w, h, r, false);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = vt[i]! > 0 ? 1 : 0;
  return { width: w, height: h, data };
}

/** Erosione con un quadrato di lato 2r+1 (fuori dall'immagine = carta). */
export function erode(m: Mask, r: number): Mask {
  if (r <= 0) return { ...m, data: m.data.slice() };
  const { width: w, height: h } = m;
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = m.data[i] ? 0 : 1;
  const d = dilate({ width: w, height: h, data: inv }, r);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = d.data[i] ? 0 : 1;
  // bordo: l'esterno è carta
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (x < r || y < r || x >= w - r || y >= h - r) {
        let any0 = false;
        for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r) && !any0; yy++)
          for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++)
            if (!m.data[yy * w + xx]) {
              any0 = true;
              break;
            }
        data[y * w + x] = !any0 && m.data[y * w + x] ? 1 : 0;
      }
  return { width: w, height: h, data };
}

/** Chiusura: dilata e poi erode. Fonde i tratti di matita vicini in un'unica traccia. */
export function close(m: Mask, r: number): Mask {
  return r > 0 ? erode(dilate(m, r), r) : m;
}

/** Componenti connesse (8-vicini per l'inchiostro, 4 per la carta). */
export function components(
  m: Mask,
  value: 0 | 1,
): { label: Int32Array; areas: number[]; touchesBorder: boolean[] } {
  const { width: w, height: h, data } = m;
  const label = new Int32Array(w * h).fill(-1);
  const areas: number[] = [];
  const border: boolean[] = [];
  const stack: number[] = [];
  const eight = value === 1;
  for (let s = 0; s < w * h; s++) {
    if (data[s] !== value || label[s] !== -1) continue;
    const id = areas.length;
    let area = 0;
    let touches = false;
    label[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      area++;
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!eight && dx !== 0 && dy !== 0)) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (data[j] === value && label[j] === -1) {
            label[j] = id;
            stack.push(j);
          }
        }
    }
    areas.push(area);
    border.push(touches);
  }
  return { label, areas, touchesBorder: border };
}

/** Toglie le macchie d'inchiostro più piccole di `minArea` e chiude i buchi più piccoli di `minHole`. */
export function clean(m: Mask, minArea: number, minHole: number): Mask {
  const data = m.data.slice();
  const ink = components(m, 1);
  for (let i = 0; i < data.length; i++)
    if (data[i] && ink.areas[ink.label[i]!]! < minArea) data[i] = 0;
  const cleaned = { width: m.width, height: m.height, data };
  const holes = components(cleaned, 0);
  for (let i = 0; i < data.length; i++) {
    const l = holes.label[i]!;
    if (!data[i] && l >= 0 && !holes.touchesBorder[l] && holes.areas[l]! < minHole) data[i] = 1;
  }
  return cleaned;
}

/** Riduce l'immagine (media dei pixel) finché il lato lungo è ≤ maxSide. */
export function downscale(
  img: RasterImage,
  maxSide: number,
): { image: RasterImage; factor: number } {
  const long = Math.max(img.width, img.height);
  if (long <= maxSide) return { image: img, factor: 1 };
  const f = Math.ceil(long / maxSide);
  const w = Math.floor(img.width / f);
  const h = Math.floor(img.height / f);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let yy = 0; yy < f; yy++)
          for (let xx = 0; xx < f; xx++)
            s += img.data[((y * f + yy) * img.width + x * f + xx) * 4 + c]!;
        data[(y * w + x) * 4 + c] = s / (f * f);
      }
  return { image: { width: w, height: h, data }, factor: f };
}

/** Distanza (chamfer 3-4, in px) di ogni pixel di valore `value` dal pixel di valore opposto più vicino. */
export function distance(m: Mask, value: 0 | 1): Float32Array {
  const { width: w, height: h, data } = m;
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = data[i] === value ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? INF : d[y * w + x]!);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i]!,
        at(x - 1, y) + 3,
        at(x, y - 1) + 3,
        at(x - 1, y - 1) + 4,
        at(x + 1, y - 1) + 4,
      );
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i]!,
        at(x + 1, y) + 3,
        at(x, y + 1) + 3,
        at(x + 1, y + 1) + 4,
        at(x - 1, y + 1) + 4,
      );
    }
  for (let i = 0; i < w * h; i++) d[i] = d[i]! / 3;
  return d;
}

/**
 * Chiude le asole sottili tra passate di matita parallele: un buco (non a contatto col bordo)
 * la cui metà larghezza massima è sotto `maxHalf` px diventa inchiostro. I buchi "veri" (es. il
 * triangolo della A) sono larghi e restano.
 */
export function fillThinHoles(m: Mask, maxHalf: number): Mask {
  const holes = components(m, 0);
  const dist = distance(m, 0);
  const widest = new Float32Array(holes.areas.length);
  for (let i = 0; i < m.data.length; i++) {
    const l = holes.label[i]!;
    if (l >= 0 && dist[i]! > widest[l]!) widest[l] = dist[i]!;
  }
  const data = m.data.slice();
  for (let i = 0; i < data.length; i++) {
    const l = holes.label[i]!;
    if (l >= 0 && !holes.touchesBorder[l] && widest[l]! <= maxHalf) data[i] = 1;
  }
  return { width: m.width, height: m.height, data };
}

/** Ingrandisce l'immagine di un fattore intero (interpolazione bilineare). */
export function upscale(img: RasterImage, f: number): RasterImage {
  if (f <= 1) return img;
  const W = img.width * f;
  const H = img.height * f;
  const data = new Uint8ClampedArray(W * H * 4);
  const s = img.data;
  for (let y = 0; y < H; y++) {
    const sy = Math.min(img.height - 1, Math.max(0, (y + 0.5) / f - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(img.height - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < W; x++) {
      const sx = Math.min(img.width - 1, Math.max(0, (x + 0.5) / f - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(img.width - 1, x0 + 1);
      const fx = sx - x0;
      for (let c = 0; c < 4; c++) {
        const a = s[(y0 * img.width + x0) * 4 + c]!;
        const b = s[(y0 * img.width + x1) * 4 + c]!;
        const d = s[(y1 * img.width + x0) * 4 + c]!;
        const e = s[(y1 * img.width + x1) * 4 + c]!;
        data[(y * W + x) * 4 + c] =
          (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
      }
    }
  }
  return { width: W, height: H, data };
}
