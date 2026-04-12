import { averageColor, dominantColor, colorDistance, sampleReferenceAt } from './color-utils';
import type { RGB } from './color-utils';

export interface BufferedImage {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  avgColor: RGB;
}

export interface ImageBufferConfig {
  tileAreaPercent?: number;
  bufferSize?: number;
  colorMatchStrategy?: 'average' | 'dominant';
}

export class ImageBuffer {
  private allUrls: string[] = [];
  private availableUrls: string[] = [];
  private buffer: BufferedImage[] = [];
  private _bufferSize: number = 5;
  private colorStrategy: 'average' | 'dominant' = 'average';
  targetArea: number = 0;

  get bufferedCount(): number {
    return this.buffer.length;
  }

  init(
    imageUrls: string[],
    viewportWidth: number,
    viewportHeight: number,
    config: ImageBufferConfig,
  ): void {
    this.allUrls = [...imageUrls];
    this.availableUrls = this.shuffle([...imageUrls]);
    this._bufferSize = config.bufferSize ?? 5;
    this.colorStrategy = config.colorMatchStrategy ?? 'average';
    this.targetArea = viewportWidth * viewportHeight * ((config.tileAreaPercent ?? 7) / 100);
    this.buffer = [];
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

    const targetColor = sampleReferenceAt(
      referenceCtx, referenceWidth, referenceHeight,
      worldX, worldY, worldBounds,
    );

    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.buffer.length; i++) {
      const dist = colorDistance(this.buffer[i].avgColor, targetColor);
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

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        let color: RGB;
        try {
          color = this.colorStrategy === 'dominant'
            ? dominantColor(img)
            : averageColor(img);
        } catch {
          color = [0, 0, 0];
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
