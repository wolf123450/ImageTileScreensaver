export type RGB = [number, number, number];
export type HSV = [number, number, number]; // H: 0-360, S: 0-1, V: 0-1

/**
 * Convert RGB (0-255 each) to HSV (H: 0-360, S: 0-1, V: 0-1).
 */
export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

/**
 * Weighted Euclidean color distance approximating perceptual difference.
 * √(2·ΔR² + 4·ΔG² + 3·ΔB²)
 */
export function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

/**
 * HSV-based color distance. Hue is circular and weighted heavily.
 * Returns a value in [0, ~1] range for normalized comparison.
 */
export function hsvDistance(a: RGB, b: RGB): number {
  const [ah, as, av] = rgbToHsv(a);
  const [bh, bs, bv] = rgbToHsv(b);
  // Circular hue difference (0-180) normalized to 0-1
  let dh = Math.abs(ah - bh);
  if (dh > 180) dh = 360 - dh;
  const hNorm = dh / 180;
  const ds = as - bs;
  const dv = av - bv;
  // Weight value most heavily, then saturation, then hue.
  // Brightness is the most perceptually dominant factor at small tile sizes.
  return Math.sqrt(hNorm * hNorm + 2 * ds * ds + 4 * dv * dv);
}

/**
 * Compute tile width and height from natural image dimensions and a target area.
 * Preserves the image's aspect ratio while targeting the given area.
 */
export function computeTileDimensions(
  naturalWidth: number,
  naturalHeight: number,
  targetArea: number,
): { width: number; height: number } {
  const ratio = naturalWidth / naturalHeight;
  const width = Math.sqrt(targetArea * ratio);
  const height = Math.sqrt(targetArea / ratio);
  return { width, height };
}

/**
 * Extract the average color of an image by drawing to a 1×1 canvas.
 */
export function averageColor(img: HTMLImageElement): RGB {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

/**
 * Extract the dominant color of an image by histogramming into 4×4×4 RGB bins.
 */
export function dominantColor(img: HTMLImageElement): RGB {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  const bins = new Uint32Array(64);
  const binSize = 64;

  for (let i = 0; i < data.length; i += 4) {
    const ri = Math.min(3, Math.floor(data[i] / binSize));
    const gi = Math.min(3, Math.floor(data[i + 1] / binSize));
    const bi = Math.min(3, Math.floor(data[i + 2] / binSize));
    bins[ri * 16 + gi * 4 + bi]++;
  }

  let maxBin = 0;
  let maxCount = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] > maxCount) {
      maxCount = bins[i];
      maxBin = i;
    }
  }

  const ri = Math.floor(maxBin / 16);
  const gi = Math.floor((maxBin % 16) / 4);
  const bi = maxBin % 4;
  return [
    ri * binSize + binSize / 2,
    gi * binSize + binSize / 2,
    bi * binSize + binSize / 2,
  ];
}

/**
 * Sample the reference image at a world-space position using progressive mapping.
 * When tileWidth/tileHeight are provided, averages over the tile-sized region
 * instead of sampling a single pixel.
 */
export function sampleReferenceAt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  worldX: number,
  worldY: number,
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number },
  tileWidth?: number,
  tileHeight?: number,
): RGB {
  const worldW = worldBounds.maxX - worldBounds.minX;
  const worldH = worldBounds.maxY - worldBounds.minY;

  if (worldW <= 0 || worldH <= 0) return [0, 0, 0];

  const u = (worldX - worldBounds.minX) / worldW;
  const v = (worldY - worldBounds.minY) / worldH;

  const px = Math.floor(Math.min(Math.max(u * canvasWidth, 0), canvasWidth - 1));
  const py = Math.floor(Math.min(Math.max(v * canvasHeight, 0), canvasHeight - 1));

  // Tile-sized region sampling: average the mapped region
  if (tileWidth && tileHeight && worldW > 0 && worldH > 0) {
    const tw = Math.max(1, Math.round((tileWidth / worldW) * canvasWidth));
    const th = Math.max(1, Math.round((tileHeight / worldH) * canvasHeight));
    const sx = Math.min(px, canvasWidth - tw);
    const sy = Math.min(py, canvasHeight - th);
    const w = Math.min(tw, canvasWidth - sx);
    const h = Math.min(th, canvasHeight - sy);

    if (w > 0 && h > 0) {
      const data = ctx.getImageData(Math.max(0, sx), Math.max(0, sy), w, h).data;
      const pixels = data.length / 4;
      let rSum = 0, gSum = 0, bSum = 0;
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
      }
      return [Math.round(rSum / pixels), Math.round(gSum / pixels), Math.round(bSum / pixels)];
    }
  }

  const data = ctx.getImageData(px, py, 1, 1).data;
  return [data[0], data[1], data[2]];
}
