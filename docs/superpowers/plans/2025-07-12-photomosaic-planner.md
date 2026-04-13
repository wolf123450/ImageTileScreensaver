# Photomosaic Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buffer-based photomosaic image selection with a full-cache planner that plans all tile placements upfront, then loads/renders images one at a time.

**Architecture:** New `PhotomosaicPlanner` class plans all placements using the color cache (with dimensions). `MosaicPattern.startCycle()` branches: if reference image + cache with dimensions → use planner, else if reference image → fallback to `ImageBuffer.nextForPosition()`, else → `ImageBuffer.next()`. Render phase walks the plan array, loading one image per tick.

**Tech Stack:** TypeScript, Vitest, Webpack

---

### Task 1: Add `skipCorner()` to PlacementEngine

**Files:**
- Modify: `src/patterns/placement-engine.ts`
- Modify: `src/patterns/placement-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/patterns/placement-engine.test.ts`:

```typescript
describe('skipCorner', () => {
  it('removes the top-priority corner without placing a tile', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    engine.seedFirstTile(100, 100, 'center', 800, 600);
    const cornersBefore = engine.cornerCount;
    const tilesBefore = engine.tileCount;
    engine.skipCorner();
    expect(engine.cornerCount).toBe(cornersBefore - 1);
    expect(engine.tileCount).toBe(tilesBefore);
  });

  it('is a no-op when corner queue is empty', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    engine.skipCorner(); // should not throw
    expect(engine.cornerCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/patterns/placement-engine.test.ts`
Expected: FAIL — `skipCorner` is not a function

- [ ] **Step 3: Implement `skipCorner()`**

Add to `PlacementEngine` class in `src/patterns/placement-engine.ts`, after `peekCorner()`:

```typescript
skipCorner(): void {
  if (this.freeCorners.length > 0) {
    this.freeCorners.splice(0, 1);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/patterns/placement-engine.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/patterns/placement-engine.ts src/patterns/placement-engine.test.ts
git commit -m "feat: add skipCorner() to PlacementEngine"
```

---

### Task 2: Add width/height to ColorCacheEntry and color-worker

**Files:**
- Modify: `src/types.ts`
- Modify: `src/configui/color-worker.ts`
- Modify: `src/configui/screensaver-settings.ts`

- [ ] **Step 1: Add width/height to ColorCacheEntry**

In `src/types.ts`, add two fields to `ColorCacheEntry`:

```typescript
export interface ColorCacheEntry {
    avgColor: string;   // hex e.g. "#4a6b3c"
    domColor: string;   // hex e.g. "#2d4f1e"
    mtime: number;      // file modification time in ms since epoch
    size: number;       // file size in bytes
    width?: number;     // natural pixel width (added in v1.1)
    height?: number;    // natural pixel height (added in v1.1)
}
```

Make them optional so old cache data without dimensions still parses.

- [ ] **Step 2: Emit width/height from color-worker**

In `src/configui/color-worker.ts`, update the result message to include `bitmap.width` and `bitmap.height`. Change the `self.postMessage` block inside the `try` block:

```typescript
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
```

Also update the JSDoc comment at the top:
```
 *   { type: 'result', rawPath: string, avgColor: string, domColor: string, width: number, height: number }
```

- [ ] **Step 3: Store width/height in screensaver-settings.ts bake handler**

In `src/configui/screensaver-settings.ts`, in the `worker.onmessage` handler where `msg.type === 'result'`, add width/height:

```typescript
if (msg.type === 'result') {
    const stat = statsMap.get(msg.rawPath);
    entries[msg.rawPath] = {
        avgColor: msg.avgColor,
        domColor: msg.domColor,
        mtime: stat?.mtime ?? 0,
        size: stat?.size ?? 0,
        width: msg.width,
        height: msg.height,
    };
}
```

- [ ] **Step 4: Run TSC to verify types are consistent**

Run: `npx tsc --noEmit`
Expected: Clean (no errors)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/configui/color-worker.ts src/configui/screensaver-settings.ts
git commit -m "feat: add width/height to color cache entries"
```

---

### Task 3: Create PhotomosaicPlanner

**Files:**
- Create: `src/patterns/photomosaic-planner.ts`
- Create: `src/patterns/photomosaic-planner.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/patterns/photomosaic-planner.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PhotomosaicPlanner } from './photomosaic-planner';
import type { PlannedTile, PlannerCacheEntry } from './photomosaic-planner';
import { PlacementEngine, createPriorityFn } from './placement-engine';
import type { RGB } from './color-utils';

// Helper: create a fake CanvasRenderingContext2D that returns a fixed color
function fakeCtx(color: RGB): CanvasRenderingContext2D {
  return {
    getImageData: () => ({
      data: new Uint8ClampedArray([color[0], color[1], color[2], 255]),
    }),
  } as unknown as CanvasRenderingContext2D;
}

function makeCache(entries: Array<{ url: string; color: RGB; w: number; h: number }>): Map<string, PlannerCacheEntry> {
  const map = new Map<string, PlannerCacheEntry>();
  for (const e of entries) {
    map.set(e.url, { avgColor: e.color, domColor: e.color, width: e.w, height: e.h });
  }
  return map;
}

describe('PhotomosaicPlanner', () => {
  it('produces a plan with tiles inside reference bounds', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 200, h: 200 },
      { url: 'b.jpg', color: [200, 50, 50], w: 200, h: 200 },
    ]);
    const refBounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorMatchStrategy: 'average',
      maxTiles: 50,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    expect(plan.length).toBeGreaterThan(0);
    // All tiles should be the one closest to [100,100,100] = 'a.jpg'
    expect(plan[0].url).toBe('a.jpg');
  });

  it('applies reuse penalty to diversify selections', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    // Two images with very similar colors
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 200, h: 200 },
      { url: 'b.jpg', color: [102, 100, 100], w: 200, h: 200 },
    ]);
    const refBounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorMatchStrategy: 'average',
      maxTiles: 20,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    // With reuse penalty, both images should appear (not just a.jpg every time)
    const urls = new Set(plan.map(p => p.url));
    expect(urls.size).toBe(2);
  });

  it('skips corners outside reference bounds', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    // Tiny reference bounds — most corners will be outside
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 100, h: 100 },
    ]);
    const refBounds = { minX: -60, minY: -60, maxX: 60, maxY: 60 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorMatchStrategy: 'average',
      maxTiles: 100,
    });

    engine.seedFirstTile(104, 104, 'center', 200, 200);
    const plan = planner.plan(engine);

    // Only the seed was inside bounds; subsequent corners are outside the 120x120 ref
    // Plan should be small (just tiles fitting inside refBounds)
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(engine.cornerCount).toBe(0); // all corners consumed
  });

  it('respects maxTiles cap', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 200, h: 200 },
    ]);
    const refBounds = { minX: -5000, minY: -5000, maxX: 5000, maxY: 5000 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorMatchStrategy: 'average',
      maxTiles: 5,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    expect(plan.length).toBe(5);
  });

  it('uses dominant color when strategy is dominant', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    const cache = new Map<string, PlannerCacheEntry>();
    // avgColor is far from target, domColor is close
    cache.set('a.jpg', { avgColor: [255, 0, 0], domColor: [100, 100, 100], width: 200, height: 200 });
    cache.set('b.jpg', { avgColor: [100, 100, 100], domColor: [255, 0, 0], width: 200, height: 200 });

    const refBounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorMatchStrategy: 'dominant',
      maxTiles: 1,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    // With dominant strategy, a.jpg's domColor [100,100,100] matches target
    expect(plan[0].url).toBe('a.jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/patterns/photomosaic-planner.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create PhotomosaicPlanner implementation**

Create `src/patterns/photomosaic-planner.ts`:

```typescript
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
  colorMatchStrategy: 'average' | 'dominant' | 'hsv';
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
      referenceWorldBounds, targetArea, tileMargin, colorMatchStrategy, maxTiles,
    } = this.config;

    const distFn = colorMatchStrategy === 'hsv' ? hsvDistance : colorDistance;
    const reusePenalty = colorMatchStrategy === 'hsv' ? REUSE_PENALTY_HSV : REUSE_PENALTY_RGB;
    const useColorKey = colorMatchStrategy === 'dominant' ? 'domColor' : 'avgColor';

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

    while (result.length < maxTiles) {
      const corner = engine.peekCorner();
      if (!corner) break;

      // Check if corner is inside reference bounds
      if (
        corner.x < referenceWorldBounds.minX || corner.x > referenceWorldBounds.maxX ||
        corner.y < referenceWorldBounds.minY || corner.y > referenceWorldBounds.maxY
      ) {
        engine.skipCorner();
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

    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/patterns/photomosaic-planner.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/patterns/photomosaic-planner.ts src/patterns/photomosaic-planner.test.ts
git commit -m "feat: add PhotomosaicPlanner with full-cache tile selection"
```

---

### Task 4: Integrate PhotomosaicPlanner into MosaicPattern

**Files:**
- Modify: `src/patterns/mosaic-pattern.ts`

- [ ] **Step 1: Add imports and new fields**

Add import at top of `src/patterns/mosaic-pattern.ts`:

```typescript
import { PhotomosaicPlanner } from './photomosaic-planner';
import type { PlannedTile, PlannerCacheEntry } from './photomosaic-planner';
```

Add new private field alongside the existing ones:

```typescript
private plannedTiles: PlannedTile[] = [];
```

- [ ] **Step 2: Update color cache loading to include width/height**

In `startCycle()`, change the color cache Map type and entry building to include width/height. The `colorCache` field type changes to `Map<string, { avgColor: RGB; domColor: RGB; width: number; height: number }>`. Update the cache-building block inside `startCycle()`:

```typescript
if (entry) {
  const w = entry.width;
  const h = entry.height;
  if (w && h) {
    this.colorCache.set(this.imageUrls[i], {
      avgColor: this.hexToRgb(entry.avgColor),
      domColor: this.hexToRgb(entry.domColor),
      width: w,
      height: h,
    });
  }
}
```

Update the `colorCache` field type declaration:

```typescript
private colorCache: Map<string, { avgColor: RGB; domColor: RGB; width: number; height: number }> | null = null;
```

- [ ] **Step 3: Branch startCycle() for planner vs buffer**

After loading the reference image and cache, add the planner branch. Replace the section from `this.stats.cycleCount++` through the end of `startCycle()` with:

```typescript
this.stats.cycleCount++;

const targetArea = this.viewportWidth * this.viewportHeight * (this.config.tileAreaPercent / 100);
const margin = this.config.tileMargin;

// Determine if we can use the full-cache planner
const useFullPlanner = this.referenceCtx && this.colorCache && this.colorCache.size > 0
  && this.referenceWorldBounds;

if (useFullPlanner) {
  // --- Photomosaic planner path ---
  // Seed first tile using square approximation
  const seedSide = Math.sqrt(targetArea);
  this.engine.seedFirstTile(
    seedSide + margin, seedSide + margin,
    this.config.startPosition,
    this.viewportWidth, this.viewportHeight,
  );

  const planner = new PhotomosaicPlanner({
    cache: this.colorCache!,
    referenceCtx: this.referenceCtx!,
    referenceWidth: this.referenceWidth,
    referenceHeight: this.referenceHeight,
    referenceWorldBounds: this.referenceWorldBounds!,
    targetArea,
    tileMargin: margin,
    colorMatchStrategy: this.config.colorMatchStrategy,
    maxTiles: this.config.maxTiles > 0 ? this.config.maxTiles : 10000,
  });

  this.plannedTiles = planner.plan(this.engine);

  // Render the seed tile (first planned tile)
  if (this.plannedTiles.length > 0) {
    const first = this.plannedTiles.shift()!;
    this.renderTile(first.tile, first.url, first.displayWidth, first.displayHeight, first.margin);
    this.tilesPlaced = 1;
  }

  // Start render loop
  this.placementTimer = window.setInterval(() => this.tickPlanned(), this.config.placementSpeed);
} else {
  // --- Buffer path (regular mosaic or fallback photomosaic) ---
  this.imageBuffer!.init(this.imageUrls, this.viewportWidth, this.viewportHeight, {
    tileAreaPercent: this.config.tileAreaPercent,
    bufferSize: this.config.bufferSize,
    colorMatchStrategy: this.config.colorMatchStrategy,
  }, this.colorCache as Map<string, { avgColor: RGB; domColor: RGB }> ?? undefined);

  await this.imageBuffer!.prefill();

  const firstImg = this.imageBuffer!.next();
  if (!firstImg) return;

  const dims = computeTileDimensions(
    firstImg.naturalWidth,
    firstImg.naturalHeight,
    this.imageBuffer!.targetArea,
  );
  const firstTile = this.engine.seedFirstTile(
    dims.width + margin, dims.height + margin,
    this.config.startPosition,
    this.viewportWidth, this.viewportHeight,
  );
  this.renderTile(firstTile, firstImg.url, dims.width, dims.height, margin);
  this.tilesPlaced = 1;

  this.placementTimer = window.setInterval(() => this.tick(), this.config.placementSpeed);
}
```

- [ ] **Step 4: Add `tickPlanned()` method**

Add new method to MosaicPattern, after the existing `tick()` method:

```typescript
private tickPlanned(): void {
  if (!this.engine || !this.tileContainer) return;

  const t0 = performance.now();
  this.stats.currentScale = this.currentScale;

  if (this.plannedTiles.length === 0) {
    this.stopFilling();
    return;
  }

  this.stats.state = 'placing';

  const planned = this.plannedTiles.shift()!;

  // Screen-space check
  const tileScreenWidth = planned.displayWidth * this.currentScale;
  this.stats.tileScreenPx = tileScreenWidth;
  if (tileScreenWidth < MIN_TILE_SCREEN_PX) {
    this.stopFilling();
    return;
  }

  // Load and render the image
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    this.renderTile(planned.tile, planned.url, planned.displayWidth, planned.displayHeight, planned.margin);
    this.tilesPlaced++;

    const elapsed = performance.now() - t0;
    this.stats.lastTickTime = elapsed;
    this.stats.totalTickTime += elapsed;
    this.stats.tickCount++;
    this.stats.tilesPlaced = this.tilesPlaced;

    if (this.config.zoomEnabled) {
      this.updateZoom();
    }
  };
  img.onerror = () => {
    // Skip failed loads, continue with next planned tile
    this.tilesPlaced++;
    this.stats.tilesPlaced = this.tilesPlaced;
  };
  img.src = planned.url;
}
```

- [ ] **Step 5: Update cleanup() and fadeOutAndRebuild()**

Add `this.plannedTiles = [];` to both `cleanup()` and `fadeOutAndRebuild()`.

- [ ] **Step 6: Move imageBuffer init before the branch**

The imageBuffer.init() currently happens before the branch. Move it inside the buffer path only. The `this.imageBuffer = new ImageBuffer();` stays before the cache loading, but `this.imageBuffer.init(...)` and `this.imageBuffer.prefill()` move inside the else branch.

- [ ] **Step 7: Run TSC and all tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: Clean TSC, all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/patterns/mosaic-pattern.ts
git commit -m "feat: integrate PhotomosaicPlanner into MosaicPattern"
```

---

### Task 5: Update debug panel for planner mode

**Files:**
- Modify: `src/renderer.ts`

- [ ] **Step 1: Update debug panel stats**

In `updateDebugPanel()` in `src/renderer.ts`, add planned tiles remaining to the display. After the buffer stats line, add a conditional:

```typescript
const mp = currentPattern as MosaicPattern;
const plannedRemaining = (mp as any).plannedTiles?.length ?? 0;
if (plannedRemaining > 0 || s.bufferCurrent === 0) {
  lines.push(`Plan: ${plannedRemaining} tiles remaining`);
} else {
  lines.push(`Buffer: ${s.bufferCurrent}/${s.bufferMax}  Avail: ${s.bufferAvailable}/${s.bufferTotal}`);
}
```

- [ ] **Step 2: Run TSC**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add src/renderer.ts
git commit -m "feat: show planner stats in debug panel"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (including new photomosaic-planner tests)

- [ ] **Step 2: Run TSC**

Run: `npx tsc --noEmit`
Expected: Clean

- [ ] **Step 3: Commit all remaining changes**

```bash
git add -A && git status
```

Verify no untracked files remain. If clean, done.
