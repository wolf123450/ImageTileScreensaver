/**
 * Web Worker for off-thread color precomputation.
 * Computes average and dominant colors for batches of images.
 *
 * Messages IN:
 *   { type: 'start', items: Array<{ rawPath: string, assetUrl: string }> }
 *   { type: 'cancel' }                     — stop processing
 *
 * Messages OUT:
 *   { type: 'progress', completed: number, total: number }
 *   { type: 'result', rawPath: string, avgColor: string, domColor: string, width: number, height: number }
 *   { type: 'done', wasCancelled: boolean }
 *   { type: 'error', rawPath: string, message: string }
 */

let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }

  if (msg.type === 'start') {
    cancelled = false;
    const items: Array<{ rawPath: string; assetUrl: string }> = msg.items;
    const total = items.length;
    let completed = 0;

    for (const { rawPath, assetUrl } of items) {
      if (cancelled) {
        self.postMessage({ type: 'done', wasCancelled: true });
        return;
      }

      try {
        const response = await fetch(assetUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);

        const avgColor = computeAverageColor(bitmap);
        const domColor = computeDominantColor(bitmap);
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();

        self.postMessage({
          type: 'result',
          rawPath,
          avgColor: rgbToHex(avgColor),
          domColor: rgbToHex(domColor),
          width,
          height,
        });
      } catch (err) {
        self.postMessage({
          type: 'error',
          rawPath,
          message: err instanceof Error ? err.message : String(err),
        });
      }

      completed++;
      if (completed % 10 === 0 || completed === total) {
        self.postMessage({ type: 'progress', completed, total });
      }
    }

    self.postMessage({ type: 'done', wasCancelled: false });
  }
};

type RGB = [number, number, number];

function computeAverageColor(bitmap: ImageBitmap): RGB {
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function computeDominantColor(bitmap: ImageBitmap): RGB {
  const size = 16;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, size, size);
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

function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map(c =>
    Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')
  ).join('');
}
