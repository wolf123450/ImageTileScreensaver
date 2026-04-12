export type RGB = [number, number, number];

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
 */
export function sampleReferenceAt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  worldX: number,
  worldY: number,
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number },
): RGB {
  const worldW = worldBounds.maxX - worldBounds.minX;
  const worldH = worldBounds.maxY - worldBounds.minY;

  if (worldW <= 0 || worldH <= 0) return [0, 0, 0];

  const u = (worldX - worldBounds.minX) / worldW;
  const v = (worldY - worldBounds.minY) / worldH;

  const px = Math.floor(Math.min(Math.max(u * canvasWidth, 0), canvasWidth - 1));
  const py = Math.floor(Math.min(Math.max(v * canvasHeight, 0), canvasHeight - 1));

  const data = ctx.getImageData(px, py, 1, 1).data;
  return [data[0], data[1], data[2]];
}
