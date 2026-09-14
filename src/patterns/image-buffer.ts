import { averageColor, dominantColor, colorDistance, hsvDistance, sampleReferenceAt, computeTileDimensions } from './color-utils';
import type { RGB } from './color-utils';

export type ColorDistanceFn = 'rgb' | 'hsv';
export type ColorSource = 'average' | 'dominant';

export interface BufferedImage {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  avgColor: RGB;
}

export interface ImageBufferConfig {
  tileAreaPercent?: number;
  bufferSize?: number;
  colorDistanceFn?: ColorDistanceFn;
  colorSource?: ColorSource;
}

export class ImageBuffer {
  private allUrls: string[] = [];
  private availableUrls: string[] = [];
  private buffer: BufferedImage[] = [];
  private _bufferSize: number = 5;
  private distanceFn: ColorDistanceFn = 'rgb';
  private colorSource: ColorSource = 'dominant';
  private colorCache: Map<string, { avgColor: RGB; domColor: RGB }> | null = null;
  targetArea: number = 0;

  get bufferedCount(): number {
    return this.buffer.length;
  }

  get availableCount(): number {
    return this.availableUrls.length;
  }

  get totalCount(): number {
    return this.allUrls.length;
  }

  get bufferSize(): number {
    return this._bufferSize;
  }

  init(
    imageUrls: string[],
    viewportWidth: number,
    viewportHeight: number,
    config: ImageBufferConfig,
    colorCache?: Map<string, { avgColor: RGB; domColor: RGB }>,
  ): void {
    this.allUrls = [...imageUrls];
    this.availableUrls = this.shuffle([...imageUrls]);
    this._bufferSize = config.bufferSize ?? 5;
    this.distanceFn = config.colorDistanceFn ?? 'rgb';
    this.colorSource = config.colorSource ?? 'dominant';
    this.targetArea = viewportWidth * viewportHeight * ((config.tileAreaPercent ?? 7) / 100);
    this.buffer = [];
    this.colorCache = colorCache ?? null;
  }

  async prefill(): Promise<void> {
    const toLoad = Math.min(this._bufferSize, this.availableUrls.length);
    const promises: Promise<void>[] = [];
    for (let i = 0; i < toLoad; i++) {
      promises.push(this.loadNext());
    }
    await Promise.all(promises);
  }

  next(): BufferedImage | null {
    if (this.buffer.length === 0) return null;
    const img = this.buffer.shift()!;
    this.triggerBackfill();
    return img;
  }

  nextForPosition(
    worldX: number,
    worldY: number,
    worldBounds: { minX: number; minY: number; maxX: number; maxY: number },
    referenceCtx: CanvasRenderingContext2D,
    referenceWidth: number,
    referenceHeight: number,
  ): BufferedImage | null {
    if (this.buffer.length === 0) return null;

    // Compute tile dimensions for region sampling
    const sampleImg = this.buffer[0];
    const dims = computeTileDimensions(sampleImg.naturalWidth, sampleImg.naturalHeight, this.targetArea);

    const targetColor = sampleReferenceAt(
      referenceCtx, referenceWidth, referenceHeight,
      worldX, worldY, worldBounds,
      dims.width, dims.height,
    );

    const distFn = this.distanceFn === 'hsv' ? hsvDistance : colorDistance;

    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.buffer.length; i++) {
      const dist = distFn(this.buffer[i].avgColor, targetColor);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }

    const [img] = this.buffer.splice(bestIndex, 1);
    this.triggerBackfill();
    return img;
  }

  hasMore(): boolean {
    return this.availableUrls.length > 0 || this.buffer.length > 0;
  }

  private triggerBackfill(): void {
    if (this.availableUrls.length === 0 && this.buffer.length === 0) {
      // Reshuffle all URLs for the next cycle
      this.availableUrls = this.shuffle([...this.allUrls]);
    }
    if (this.buffer.length < this._bufferSize && this.availableUrls.length > 0) {
      this.loadNext();
    }
  }

  private async loadNext(): Promise<void> {
    if (this.availableUrls.length === 0) return;

    const url = this.availableUrls.shift()!;

    // Check color cache first
    const cached = this.colorCache?.get(url);

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let color: RGB;
        if (cached) {
          color = this.colorSource === 'average' ? cached.avgColor : cached.domColor;
        } else {
          try {
            color = this.colorSource === 'average'
              ? averageColor(img)
              : dominantColor(img);
          } catch {
            color = [0, 0, 0];
          }
        }
        this.buffer.push({
          url,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          avgColor: color,
        });
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = url;
    });
  }

  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
