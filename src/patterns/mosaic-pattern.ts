import { Pattern } from './index';
import { PlacementEngine, createPriorityFn } from './placement-engine';
import { ImageBuffer } from './image-buffer';
import { computeTileDimensions } from './color-utils';
import type { ScreensaverConfig, ColorCacheData } from '../types';
import type { PlacedTile } from './placement-engine';
import type { RGB } from './color-utils';

/** Minimum tile dimension in screen-space pixels. Tiles smaller than this are imperceptible. */
export const MIN_TILE_SCREEN_PX = 16;

interface MosaicConfig {
  placementSpeed: number;
  tileAreaPercent: number;
  tileMargin: number;
  priorityFunction: 'center-out' | 'spiral-cw' | 'spiral-ccw' | 'random' | 'directional';
  directionAngle: number;
  startPosition: 'center' | 'random';
  maxTiles: number;
  holdDuration: number;
  zoomEnabled: boolean;
  maxZoomOut: number;
  bufferSize: number;
  imageFitStyle: string;
  referenceImage: string;
  referenceImageDir: string;
  colorMatchStrategy: 'average' | 'dominant';
}

export class MosaicPattern implements Pattern {
  name: string = 'mosaic';

  private config: MosaicConfig = {
    placementSpeed: 200,
    tileAreaPercent: 7,
    tileMargin: 4,
    priorityFunction: 'center-out',
    directionAngle: 0,
    startPosition: 'center',
    maxTiles: 200,
    holdDuration: 5000,
    zoomEnabled: true,
    maxZoomOut: 0.3,
    bufferSize: 5,
    imageFitStyle: 'cover',
    referenceImage: '',
    referenceImageDir: '',
    colorMatchStrategy: 'average',
  };

  private engine: PlacementEngine | null = null;
  private imageBuffer: ImageBuffer | null = null;
  private container: HTMLElement | null = null;
  private tileContainer: HTMLDivElement | null = null;
  private referenceCtx: CanvasRenderingContext2D | null = null;
  private referenceWidth: number = 0;
  private referenceHeight: number = 0;
  private tilesPlaced: number = 0;
  private currentScale: number = 1;
  private placementTimer: number | null = null;
  private holdTimer: number | null = null;
  private fadeTimer: number | null = null;
  private imageUrls: string[] = [];
  private colorCache: Map<string, { avgColor: RGB; domColor: RGB; }> | null = null;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;

  init(config: ScreensaverConfig): void {
    const opts = config.patternOptions ?? {};
    this.config = {
      ...this.config,
      imageFitStyle: config.imageFitStyle || 'cover',
      placementSpeed: opts.placementSpeed ?? this.config.placementSpeed,
      tileAreaPercent: opts.tileAreaPercent ?? this.config.tileAreaPercent,
      tileMargin: opts.tileMargin ?? this.config.tileMargin,
      priorityFunction: opts.priorityFunction ?? this.config.priorityFunction,
      directionAngle: opts.directionAngle ?? this.config.directionAngle,
      startPosition: opts.startPosition ?? this.config.startPosition,
      maxTiles: opts.maxTiles ?? this.config.maxTiles,
      holdDuration: opts.holdDuration ?? this.config.holdDuration,
      zoomEnabled: opts.zoomEnabled ?? this.config.zoomEnabled,
      maxZoomOut: opts.maxZoomOut ?? this.config.maxZoomOut,
      bufferSize: opts.bufferSize ?? this.config.bufferSize,
      referenceImage: opts.referenceImage ?? this.config.referenceImage,
      referenceImageDir: opts.referenceImageDir ?? this.config.referenceImageDir,
      colorMatchStrategy: opts.colorMatchStrategy ?? this.config.colorMatchStrategy,
    };
  }

  apply(container: HTMLElement, imageUrls: string[]): void {
    if (!imageUrls.length) return;

    this.cleanup();
    this.container = container;
    this.imageUrls = imageUrls;
    this.viewportWidth = container.clientWidth || 800;
    this.viewportHeight = container.clientHeight || 600;

    this.startCycle();
  }

  cleanup(): void {
    if (this.placementTimer !== null) {
      window.clearInterval(this.placementTimer);
      this.placementTimer = null;
    }
    if (this.holdTimer !== null) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.tileContainer && this.container) {
      this.container.removeChild(this.tileContainer);
    }
    this.tileContainer = null;
    this.engine = null;
    this.imageBuffer = null;
    this.referenceCtx = null;
    this.tilesPlaced = 0;
    this.currentScale = 1;
    this.colorCache = null;
  }

  private async startCycle(): Promise<void> {
    if (!this.container) return;

    // Create tile container
    this.tileContainer = document.createElement('div');
    this.tileContainer.style.position = 'absolute';
    this.tileContainer.style.left = '0';
    this.tileContainer.style.top = '0';
    this.tileContainer.style.transformOrigin = '0 0';
    // Center world origin (0,0) in the viewport
    this.tileContainer.style.transform =
      `translate(${this.viewportWidth / 2}px, ${this.viewportHeight / 2}px) scale(1)`;
    this.tileContainer.style.transition = 'transform 0.5s ease-out';
    this.container.style.overflow = 'hidden';
    this.container.style.position = 'relative';
    this.container.appendChild(this.tileContainer);

    // Init engine
    const priorityFn = createPriorityFn(
      this.config.priorityFunction,
      this.config.directionAngle,
    );
    this.engine = new PlacementEngine(priorityFn);

    // Init image buffer
    this.imageBuffer = new ImageBuffer();

    // Load color cache if photomosaic mode is active
    // Cache is keyed by raw filesystem paths, but ImageBuffer uses asset URLs.
    // We need both raw paths and asset URLs to build the lookup.
    if (this.config.referenceImage || this.config.referenceImageDir) {
      try {
        const api = (window as any).electronAPI;
        if (api?.readColorCache && api?.getRawImagePaths) {
          const [cacheData, rawPaths]: [ColorCacheData, string[]] = await Promise.all([
            api.readColorCache(),
            api.getRawImagePaths(),
          ]);
          if (cacheData.entries && Object.keys(cacheData.entries).length > 0) {
            this.colorCache = new Map();
            for (let i = 0; i < rawPaths.length && i < this.imageUrls.length; i++) {
              const entry = cacheData.entries[rawPaths[i]];
              if (entry) {
                this.colorCache.set(this.imageUrls[i], {
                  avgColor: this.hexToRgb(entry.avgColor),
                  domColor: this.hexToRgb(entry.domColor),
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load color cache, falling back to on-the-fly computation', e);
      }
    }

    this.imageBuffer.init(this.imageUrls, this.viewportWidth, this.viewportHeight, {
      tileAreaPercent: this.config.tileAreaPercent,
      bufferSize: this.config.bufferSize,
      colorMatchStrategy: this.config.colorMatchStrategy,
    }, this.colorCache ?? undefined);

    // Load reference image if photomosaic mode
    if (this.config.referenceImage || this.config.referenceImageDir) {
      await this.loadReferenceImage();
    }

    // Pre-fill buffer
    await this.imageBuffer.prefill();

    // Seed first tile
    const firstImg = this.imageBuffer.next();
    if (!firstImg) return;

    const dims = computeTileDimensions(
      firstImg.naturalWidth,
      firstImg.naturalHeight,
      this.imageBuffer.targetArea,
    );
    const margin = this.config.tileMargin;
    const firstTile = this.engine.seedFirstTile(
      dims.width + margin,
      dims.height + margin,
      this.config.startPosition,
      this.viewportWidth,
      this.viewportHeight,
    );
    this.renderTile(firstTile, firstImg.url, dims.width, dims.height, margin);
    this.tilesPlaced = 1;

    // Start placement loop
    this.placementTimer = window.setInterval(() => this.tick(), this.config.placementSpeed);
  }

  private tick(): void {
    if (!this.engine || !this.imageBuffer || !this.tileContainer) return;

    // Get next image
    let img;
    if (this.referenceCtx) {
      const corner = this.engine.peekCorner();
      if (!corner) {
        this.stopFilling();
        return;
      }
      img = this.imageBuffer.nextForPosition(
        corner.x, corner.y,
        this.engine.getWorldBounds(),
        this.referenceCtx,
        this.referenceWidth,
        this.referenceHeight,
      );
    } else {
      img = this.imageBuffer.next();
    }

    if (!img) {
      if (!this.imageBuffer.hasMore()) {
        this.stopFilling();
      }
      return;
    }

    const dims = computeTileDimensions(
      img.naturalWidth,
      img.naturalHeight,
      this.imageBuffer.targetArea,
    );
    const margin = this.config.tileMargin;

    // Screen-space check: skip placement if tile would be too small to perceive
    // World → Screen: screenPx = worldPx * currentScale
    const tileScreenWidth = dims.width * this.currentScale;
    if (tileScreenWidth < MIN_TILE_SCREEN_PX) {
      this.stopFilling();
      return;
    }

    const tile = this.engine.placeTile(dims.width + margin, dims.height + margin);

    if (!tile) {
      this.stopFilling();
      return;
    }

    this.renderTile(tile, img.url, dims.width, dims.height, margin);
    this.tilesPlaced++;

    if (this.config.zoomEnabled) {
      this.updateZoom();
    }

    if (this.config.maxTiles > 0 && this.tilesPlaced >= this.config.maxTiles) {
      this.stopFilling();
      return;
    }

    if (this.config.zoomEnabled && this.currentScale <= this.config.maxZoomOut) {
      this.stopFilling();
      return;
    }
  }

  private renderTile(
    tile: PlacedTile,
    url: string,
    displayWidth: number,
    displayHeight: number,
    margin: number,
  ): void {
    if (!this.tileContainer) return;

    const img = document.createElement('img');
    img.src = url;
    img.style.position = 'absolute';
    img.style.left = `${tile.x + margin / 2}px`;
    img.style.top = `${tile.y + margin / 2}px`;
    img.style.width = `${displayWidth}px`;
    img.style.height = `${displayHeight}px`;
    img.style.objectFit = this.config.imageFitStyle;
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s ease-in-out';

    this.tileContainer.appendChild(img);
    requestAnimationFrame(() => {
      img.style.opacity = '1';
    });
  }

  private updateZoom(): void {
    if (!this.engine || !this.tileContainer) return;

    const bounds = this.engine.getWorldBounds();
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;

    if (worldW <= 0 || worldH <= 0) return;

    const scaleX = this.viewportWidth / worldW;
    const scaleY = this.viewportHeight / worldH;
    let targetScale = Math.min(scaleX, scaleY, 1.0);
    targetScale = Math.max(targetScale, this.config.maxZoomOut);

    this.currentScale = targetScale;

    // Center the bounding box midpoint in the viewport
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const tx = this.viewportWidth / 2 - cx * targetScale;
    const ty = this.viewportHeight / 2 - cy * targetScale;

    this.tileContainer.style.transform =
      `translate(${tx}px, ${ty}px) scale(${targetScale})`;
  }

  private stopFilling(): void {
    if (this.placementTimer !== null) {
      window.clearInterval(this.placementTimer);
      this.placementTimer = null;
    }

    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null;
      this.fadeOutAndRebuild();
    }, this.config.holdDuration);
  }

  private fadeOutAndRebuild(): void {
    if (!this.tileContainer) return;

    const images = this.tileContainer.querySelectorAll('img');
    images.forEach(img => {
      img.style.opacity = '0';
    });

    this.fadeTimer = window.setTimeout(() => {
      this.fadeTimer = null;

      if (this.tileContainer && this.container) {
        this.container.removeChild(this.tileContainer);
      }
      this.tileContainer = null;
      this.engine = null;
      this.imageBuffer = null;
      this.tilesPlaced = 0;
      this.currentScale = 1;

      this.startCycle();
    }, 600);
  }

  private async loadReferenceImage(): Promise<void> {
    let refUrl = this.config.referenceImage;

    if (refUrl === '__random__' || (!refUrl && !this.config.referenceImageDir)) {
      refUrl = this.imageUrls[Math.floor(Math.random() * this.imageUrls.length)];
    } else if (!refUrl && this.config.referenceImageDir) {
      refUrl = this.imageUrls[Math.floor(Math.random() * this.imageUrls.length)];
    }

    if (!refUrl) return;

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        this.referenceCtx = ctx;
        this.referenceWidth = canvas.width;
        this.referenceHeight = canvas.height;
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = refUrl;
    });
  }

  private hexToRgb(hex: string): RGB {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
}
