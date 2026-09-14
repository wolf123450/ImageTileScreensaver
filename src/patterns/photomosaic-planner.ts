import { colorDistance, hsvDistance, sampleReferenceAt, computeTileDimensions } from './color-utils';
import type { RGB } from './color-utils';
import type { PlacementEngine, PlacedTile } from './placement-engine';

export interface PlannerCacheEntry {
  avgColor: RGB;
  domColor: RGB;
  width: number;
  height: number;
}

export interface PlannedTile {
  tile: PlacedTile;
  url: string;
  displayWidth: number;
  displayHeight: number;
  margin: number;
}

export interface PhotomosaicPlannerConfig {
  cache: Map<string, PlannerCacheEntry>;
  referenceCtx: CanvasRenderingContext2D;
  referenceWidth: number;
  referenceHeight: number;
  referenceWorldBounds: { minX: number; minY: number; maxX: number; maxY: number };
  targetArea: number;
  tileMargin: number;
  colorDistanceFn: 'rgb' | 'hsv';
  colorSource: 'average' | 'dominant';
  maxTiles: number;
}

// Reuse penalty: ~1% of max color distance per use
// colorDistance max ≈ sqrt(2*255² + 4*255² + 3*255²) ≈ 765
// hsvDistance max ≈ sqrt(4 + 2 + 1) ≈ 2.65
const REUSE_PENALTY_RGB = 7.65;
const REUSE_PENALTY_HSV = 0.027;

export class PhotomosaicPlanner {
  private config: PhotomosaicPlannerConfig;

  constructor(config: PhotomosaicPlannerConfig) {
    this.config = config;
  }

  plan(engine: PlacementEngine): PlannedTile[] {
    const {
      cache, referenceCtx, referenceWidth, referenceHeight,
      referenceWorldBounds, targetArea, tileMargin, colorDistanceFn, colorSource, maxTiles,
    } = this.config;

    const distFn = colorDistanceFn === 'hsv' ? hsvDistance : colorDistance;
    const reusePenalty = colorDistanceFn === 'hsv' ? REUSE_PENALTY_HSV : REUSE_PENALTY_RGB;
    const useColorKey = colorSource === 'average' ? 'avgColor' : 'domColor';

    // Pre-build array of entries for fast iteration
    const cacheEntries: Array<{ url: string; color: RGB; width: number; height: number }> = [];
    for (const [url, entry] of cache) {
      cacheEntries.push({ url, color: entry[useColorKey], width: entry.width, height: entry.height });
    }

    if (cacheEntries.length === 0) return [];

    const useCounts = new Map<string, number>();
    const result: PlannedTile[] = [];

    // Square sample side for reference color sampling
    const sampleSide = Math.sqrt(targetArea);

    // Shrink bounds by half a tile so placed tiles don't extend far beyond the reference edge.
    // Corners are attachment points — the tile rectangle extends outward from there.
    const halfTile = sampleSide / 2;
    const innerBounds = {
      minX: referenceWorldBounds.minX + halfTile,
      minY: referenceWorldBounds.minY + halfTile,
      maxX: referenceWorldBounds.maxX - halfTile,
      maxY: referenceWorldBounds.maxY - halfTile,
    };

    let skippedCorners = 0;

    while (result.length < maxTiles) {
      const corner = engine.peekCorner();
      if (!corner) break;

      // Check if corner is inside shrunk bounds
      if (
        corner.x < innerBounds.minX || corner.x > innerBounds.maxX ||
        corner.y < innerBounds.minY || corner.y > innerBounds.maxY
      ) {
        engine.skipCorner();
        skippedCorners++;
        continue;
      }

      // Sample reference color at this position
      const targetColor = sampleReferenceAt(
        referenceCtx, referenceWidth, referenceHeight,
        corner.x, corner.y, referenceWorldBounds,
        sampleSide, sampleSide,
      );

      // Find best match from full cache with reuse penalty
      let bestUrl = cacheEntries[0].url;
      let bestDist = Infinity;
      let bestWidth = cacheEntries[0].width;
      let bestHeight = cacheEntries[0].height;

      for (const entry of cacheEntries) {
        const baseDist = distFn(entry.color, targetColor);
        const penalty = (useCounts.get(entry.url) ?? 0) * reusePenalty;
        const totalDist = baseDist + penalty;
        if (totalDist < bestDist) {
          bestDist = totalDist;
          bestUrl = entry.url;
          bestWidth = entry.width;
          bestHeight = entry.height;
        }
      }

      // Compute actual tile dimensions from cached dimensions
      const dims = computeTileDimensions(bestWidth, bestHeight, targetArea);

      // Place tile in engine
      const tile = engine.placeTile(dims.width + tileMargin, dims.height + tileMargin);
      if (!tile) break;

      useCounts.set(bestUrl, (useCounts.get(bestUrl) ?? 0) + 1);
      result.push({
        tile,
        url: bestUrl,
        displayWidth: dims.width,
        displayHeight: dims.height,
        margin: tileMargin,
      });
    }

    console.log(`[Planner] Done: ${result.length} tiles planned, ${skippedCorners} corners skipped (out of bounds), cache: ${cacheEntries.length} images, refBounds: [${referenceWorldBounds.minX.toFixed(0)},${referenceWorldBounds.minY.toFixed(0)}]-[${referenceWorldBounds.maxX.toFixed(0)},${referenceWorldBounds.maxY.toFixed(0)}]`);
    return result;
  }
}
