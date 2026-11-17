import type { RasterImage } from '@compasso/core';

export interface LoadedImage {
  image: RasterImage;
  /** URL per mostrare l'immagine nell'anteprima. */
  url: string;
  /** Dimensioni originali (px) prima della riduzione. */
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Decodifica un'immagine (PNG/JPEG) e la riduce perché il lato lungo non superi `maxSide`:
 * per ricalcare uno schizzo bastano ~1600 px e i tempi restano da pannello.
 */
export async function loadRaster(blob: Blob, maxSide = 1600): Promise<LoadedImage> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas 2D non disponibile');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  return {
    image: { width: w, height: h, data },
    url,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  };
}

/** Immagine RGBA → URL da mostrare nell'anteprima (es. lo schizzo di una segnalazione). */
export async function rasterUrl(image: RasterImage): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D non disponibile');
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  );
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('immagine non convertibile');
  return URL.createObjectURL(blob);
}
