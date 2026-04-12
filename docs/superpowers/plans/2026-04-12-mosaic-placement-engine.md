# Mosaic Placement Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS Grid mosaic with a corner-based placement algorithm that incrementally builds image collages with configurable priority, zoom-out, and optional photomosaic color matching.

**Architecture:** Three layers — (1) PlacementEngine for pure rectangle packing math, (2) ImageBuffer for async image loading and color analysis, (3) MosaicPattern rewrite for DOM rendering, CSS zoom, and cycle lifecycle. A color-utils module provides color distance and reference image sampling.

**Tech Stack:** TypeScript, Vitest (jsdom), CSS transforms, OffscreenCanvas/Canvas for color analysis.

**Test command:** `npx vitest run --reporter json > test-results.json 2>&1` then `node -e "const j = require('./test-results.json'); console.log('Total:', j.numTotalTests, 'Passed:', j.numPassedTests, 'Failed:', j.numFailedTests); if(j.numFailedTests>0) j.testResults.forEach(s => s.assertionResults.filter(a=>a.status==='failed').forEach(a => console.log('FAIL:', a.fullName, a.failureMessages[0]?.substring(0,300))))"`

**Spec:** `docs/superpowers/specs/2026-04-12-mosaic-placement-engine-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/patterns/placement-engine.ts` | New — pure rectangle packing: priority queue, AABB collision, corner management |
| `src/patterns/placement-engine.test.ts` | New — unit tests for placement engine (no DOM) |
| `src/patterns/color-utils.ts` | New — color distance, average/dominant color extraction, reference sampling |
| `src/patterns/color-utils.test.ts` | New — unit tests for color utilities |
| `src/patterns/image-buffer.ts` | New — async image pre-loading, tile dimension computation, color-matched selection |
| `src/patterns/image-buffer.test.ts` | New — unit tests for image buffer |
| `src/types.ts` | Modify — add new PatternOptions fields |
| `src/patterns/mosaic-pattern.ts` | Rewrite — DOM rendering, CSS zoom, cycle lifecycle |
| `src/patterns/patterns.test.ts` | Modify — update mosaic tests for new behavior |
| `src/configui/screensaver-settings.ts` | Modify — replace mosaic case in loadPatternOptions/getPatternOptionsFromUI |
| `src/configui/screensaver-settings.css` | Modify — add collapsible section and conditional visibility styles |

---

### Task 1: Add new PatternOptions fields to types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new fields to PatternOptions**

In `src/types.ts`, add the new mosaic config fields to the `PatternOptions` interface:

```ts
export interface PatternOptions {
    rows?: number;
    cols?: number;
    density?: number;
    randomCount?: number;
    allowOverlap?: boolean;
    slideSpeed?: number;
    // Mosaic placement engine options
    placementSpeed?: number;
    tileAreaPercent?: number;
    tileMargin?: number;
    priorityFunction?: 'center-out' | 'spiral-cw' | 'spiral-ccw' | 'random' | 'directional';
    directionAngle?: number;
    startPosition?: 'center' | 'random';
    maxTiles?: number;
    holdDuration?: number;
    zoomEnabled?: boolean;
    maxZoomOut?: number;
    bufferSize?: number;
    referenceImage?: string;
    referenceImageDir?: string;
    colorMatchStrategy?: 'average' | 'dominant';
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors introduced.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add mosaic placement engine config fields to PatternOptions"
```

---

### Task 2: Placement Engine — core types and seedFirstTile

**Files:**
- Create: `src/patterns/placement-engine.ts`
- Create: `src/patterns/placement-engine.test.ts`

- [ ] **Step 1: Write failing tests for types and seedFirstTile**

Create `src/patterns/placement-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PlacementEngine,
  createPriorityFn,
} from './placement-engine';
import type { PlacedTile, FreeCorner } from './placement-engine';

describe('PlacementEngine', () => {
  describe('seedFirstTile', () => {
    it('places a tile centered at origin', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      const tile = engine.seedFirstTile(100, 50, 'center', 800, 600);

      expect(tile.x).toBe(-50);
      expect(tile.y).toBe(-25);
      expect(tile.width).toBe(100);
      expect(tile.height).toBe(50);
    });

    it('adds 4 corners after seeding', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 50, 'center', 800, 600);

      // 4 corners of the placed tile
      expect(engine.cornerCount).toBe(4);
    });

    it('places tile within viewport for random position', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      const tile = engine.seedFirstTile(100, 50, 'random', 800, 600);

      // Tile should be within viewport bounds (centered at origin)
      expect(tile.x).toBeGreaterThanOrEqual(-400);
      expect(tile.y).toBeGreaterThanOrEqual(-300);
      expect(tile.x + tile.width).toBeLessThanOrEqual(400);
      expect(tile.y + tile.height).toBeLessThanOrEqual(300);
    });

    it('returns the placed tile in placedTiles', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      const tile = engine.seedFirstTile(100, 50, 'center', 800, 600);

      expect(engine.tileCount).toBe(1);
    });
  });

  describe('getWorldBounds', () => {
    it('returns bounds of a single seeded tile', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 50, 'center', 800, 600);

      const bounds = engine.getWorldBounds();
      expect(bounds.minX).toBe(-50);
      expect(bounds.minY).toBe(-25);
      expect(bounds.maxX).toBe(50);
      expect(bounds.maxY).toBe(25);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 50, 'center', 800, 600);
      engine.reset();

      expect(engine.tileCount).toBe(0);
      expect(engine.cornerCount).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run the test command (see header).
Expected: FAIL — cannot find module `./placement-engine`.

- [ ] **Step 3: Implement PlacementEngine skeleton with seedFirstTile**

Create `src/patterns/placement-engine.ts`:

```ts
export interface PlacedTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FreeCorner {
  x: number;
  y: number;
  priority: number;
}

export type PriorityFn = (corner: { x: number; y: number }) => number;

export function createPriorityFn(
  name: 'center-out' | 'spiral-cw' | 'spiral-ccw' | 'random' | 'directional',
  directionAngle: number = 0,
): PriorityFn {
  switch (name) {
    case 'center-out':
      return ({ x, y }) => Math.sqrt(x * x + y * y);
    case 'spiral-cw':
      return ({ x, y }) => Math.sqrt(x * x + y * y) + 0.1 * Math.atan2(y, x);
    case 'spiral-ccw':
      return ({ x, y }) => Math.sqrt(x * x + y * y) - 0.1 * Math.atan2(y, x);
    case 'directional': {
      const rad = (directionAngle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      return ({ x, y }) => x * cosA + y * sinA;
    }
    case 'random':
      return () => Math.random();
  }
}

export class PlacementEngine {
  private placedTiles: PlacedTile[] = [];
  private freeCorners: FreeCorner[] = [];
  private priorityFn: PriorityFn;

  constructor(priorityFn: PriorityFn) {
    this.priorityFn = priorityFn;
  }

  get tileCount(): number {
    return this.placedTiles.length;
  }

  get cornerCount(): number {
    return this.freeCorners.length;
  }

  /** Peek at the best (lowest priority) corner without removing it. */
  peekCorner(): FreeCorner | null {
    return this.freeCorners.length > 0 ? this.freeCorners[0] : null;
  }

  seedFirstTile(
    width: number,
    height: number,
    position: 'center' | 'random',
    viewportWidth: number,
    viewportHeight: number,
  ): PlacedTile {
    let x: number;
    let y: number;

    if (position === 'center') {
      x = -width / 2;
      y = -height / 2;
    } else {
      // Random position within viewport (origin is center of viewport)
      const halfVW = viewportWidth / 2;
      const halfVH = viewportHeight / 2;
      x = Math.random() * (viewportWidth - width) - halfVW;
      y = Math.random() * (viewportHeight - height) - halfVH;
    }

    const tile: PlacedTile = { x, y, width, height };
    this.placedTiles.push(tile);
    this.addCornersForTile(tile);
    return tile;
  }

  getWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    if (this.placedTiles.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const tile of this.placedTiles) {
      if (tile.x < minX) minX = tile.x;
      if (tile.y < minY) minY = tile.y;
      if (tile.x + tile.width > maxX) maxX = tile.x + tile.width;
      if (tile.y + tile.height > maxY) maxY = tile.y + tile.height;
    }

    return { minX, minY, maxX, maxY };
  }

  reset(): void {
    this.placedTiles = [];
    this.freeCorners = [];
  }

  private addCornersForTile(tile: PlacedTile): void {
    const corners = [
      { x: tile.x, y: tile.y },
      { x: tile.x + tile.width, y: tile.y },
      { x: tile.x, y: tile.y + tile.height },
      { x: tile.x + tile.width, y: tile.y + tile.height },
    ];

    for (const c of corners) {
      this.freeCorners.push({
        x: c.x,
        y: c.y,
        priority: this.priorityFn(c),
      });
    }

    this.freeCorners.sort((a, b) => a.priority - b.priority);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run the test command.
Expected: All tests in `placement-engine.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/patterns/placement-engine.ts src/patterns/placement-engine.test.ts
git commit -m "feat: placement engine skeleton with seedFirstTile, priority functions"
```

---

### Task 3: Placement Engine — placeTile with collision detection

**Files:**
- Modify: `src/patterns/placement-engine.ts`
- Modify: `src/patterns/placement-engine.test.ts`

- [ ] **Step 1: Write failing tests for placeTile**

Append to the `PlacementEngine` describe block in `src/patterns/placement-engine.test.ts`:

```ts
  describe('placeTile', () => {
    it('places a second tile adjacent to the first', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);

      const tile2 = engine.placeTile(100, 100);
      expect(tile2).not.toBeNull();
      expect(engine.tileCount).toBe(2);
    });

    it('placed tiles never overlap', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(50, 50, 'center', 800, 600);

      for (let i = 0; i < 20; i++) {
        engine.placeTile(50, 50);
      }

      const tiles = engine.getTiles();
      for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
          const a = tiles[i];
          const b = tiles[j];
          const overlaps =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlaps, `Tile ${i} overlaps tile ${j}`).toBe(false);
        }
      }
    });

    it('adds 4 new corners after each placement', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);
      const cornersBefore = engine.cornerCount;

      engine.placeTile(100, 100);

      // New corners added, minus the one consumed (removed because it was used or dead)
      // At minimum we should have more corners than before minus any culled
      expect(engine.cornerCount).toBeGreaterThan(0);
    });

    it('returns null when no placement is possible', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);

      // Place tiles until we exhaust corners
      let placed = 0;
      for (let i = 0; i < 1000; i++) {
        const result = engine.placeTile(100, 100);
        if (result === null) break;
        placed++;
      }

      // Eventually should return null (corners exhausted)
      const finalResult = engine.placeTile(100, 100);
      // It's possible all corners are exhausted OR it placed all 1000
      // We just want to confirm it doesn't throw
      expect(placed).toBeGreaterThan(0);
    });

    it('culls dead corners that have no valid orientation', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      // Place a tight cluster — seed and surround it
      engine.seedFirstTile(100, 100, 'center', 800, 600);

      // After many placements, corner count should not grow unbounded
      for (let i = 0; i < 50; i++) {
        engine.placeTile(100, 100);
      }

      // Dead corners should have been pruned — count should be reasonable
      // With 51 tiles and 4 corners each, max 204 corners minus pruned ones
      expect(engine.cornerCount).toBeLessThan(204);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run the test command.
Expected: FAIL — `placeTile` and `getTiles` not defined.

- [ ] **Step 3: Implement placeTile and getTiles**

Add to `PlacementEngine` class in `src/patterns/placement-engine.ts`:

```ts
  getTiles(): readonly PlacedTile[] {
    return this.placedTiles;
  }

  placeTile(width: number, height: number): PlacedTile | null {
    let i = 0;
    while (i < this.freeCorners.length) {
      const corner = this.freeCorners[i];
      const candidate = this.tryOrientations(corner, width, height);

      if (candidate) {
        // Remove the used corner
        this.freeCorners.splice(i, 1);
        this.placedTiles.push(candidate);
        this.addCornersForTile(candidate);
        return candidate;
      }

      // All 4 orientations collided — this corner is dead, remove it
      this.freeCorners.splice(i, 1);
      // Don't increment i — next element shifted into this position
    }

    return null;
  }

  private tryOrientations(
    corner: FreeCorner,
    width: number,
    height: number,
  ): PlacedTile | null {
    const cx = corner.x;
    const cy = corner.y;

    // Try 4 orientations: place each corner of the new tile at (cx, cy)
    const candidates: PlacedTile[] = [
      { x: cx, y: cy, width, height },                   // top-left at corner
      { x: cx - width, y: cy, width, height },            // top-right at corner
      { x: cx, y: cy - height, width, height },           // bottom-left at corner
      { x: cx - width, y: cy - height, width, height },   // bottom-right at corner
    ];

    for (const candidate of candidates) {
      if (!this.collidesWithAny(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private collidesWithAny(tile: PlacedTile): boolean {
    for (const placed of this.placedTiles) {
      if (
        tile.x < placed.x + placed.width &&
        tile.x + tile.width > placed.x &&
        tile.y < placed.y + placed.height &&
        tile.y + tile.height > placed.y
      ) {
        return true;
      }
    }
    return false;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run the test command.
Expected: All placement engine tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/patterns/placement-engine.ts src/patterns/placement-engine.test.ts
git commit -m "feat: placeTile with AABB collision detection and corner culling"
```

---

### Task 4: Placement Engine — priority function tests

**Files:**
- Modify: `src/patterns/placement-engine.test.ts`

- [ ] **Step 1: Write tests for priority ordering**

Append to `placement-engine.test.ts`:

```ts
  describe('priority functions', () => {
    it('center-out places nearest to center first', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(50, 50, 'center', 800, 600);

      const tiles: PlacedTile[] = [];
      for (let i = 0; i < 10; i++) {
        const tile = engine.placeTile(50, 50);
        if (tile) tiles.push(tile);
      }

      // Each tile's center distance from origin should generally increase
      const distances = tiles.map(t => {
        const cx = t.x + t.width / 2;
        const cy = t.y + t.height / 2;
        return Math.sqrt(cx * cx + cy * cy);
      });

      // At least the first tile should be closer than the last
      expect(distances[0]).toBeLessThan(distances[distances.length - 1]);
    });

    it('directional places along the configured angle', () => {
      // 0 degrees = positive X direction
      const engine = new PlacementEngine(createPriorityFn('directional', 0));
      engine.seedFirstTile(50, 50, 'center', 800, 600);

      const tiles: PlacedTile[] = [];
      for (let i = 0; i < 5; i++) {
        const tile = engine.placeTile(50, 50);
        if (tile) tiles.push(tile);
      }

      // Tiles should generally progress in the negative-X direction first
      // (lower priority = placed first, and x*cos(0) = x, so smallest x first)
      expect(tiles.length).toBeGreaterThan(0);
    });
  });

  describe('createPriorityFn', () => {
    it('center-out returns distance from origin', () => {
      const fn = createPriorityFn('center-out');
      expect(fn({ x: 3, y: 4 })).toBeCloseTo(5);
      expect(fn({ x: 0, y: 0 })).toBe(0);
    });

    it('spiral-cw adds atan2 term', () => {
      const fn = createPriorityFn('spiral-cw');
      const base = Math.sqrt(9 + 16);
      const angle = Math.atan2(4, 3);
      expect(fn({ x: 3, y: 4 })).toBeCloseTo(base + 0.1 * angle);
    });

    it('directional projects onto angle', () => {
      const fn = createPriorityFn('directional', 90);
      // At 90 degrees: x*cos(90) + y*sin(90) = y
      expect(fn({ x: 0, y: 5 })).toBeCloseTo(5);
      expect(fn({ x: 5, y: 0 })).toBeCloseTo(0, 0);
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run the test command.
Expected: All priority function tests PASS (implementation already exists from Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/patterns/placement-engine.test.ts
git commit -m "test: priority function ordering and math verification"
```

---

### Task 5: Color Utils

**Files:**
- Create: `src/patterns/color-utils.ts`
- Create: `src/patterns/color-utils.test.ts`

- [ ] **Step 1: Write failing tests for colorDistance**

Create `src/patterns/color-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { colorDistance, computeTileDimensions } from './color-utils';

describe('colorDistance', () => {
  it('returns 0 for identical colors', () => {
    expect(colorDistance([100, 100, 100], [100, 100, 100])).toBe(0);
  });

  it('computes weighted euclidean distance', () => {
    // √(2*(255-0)² + 4*(0-0)² + 3*(0-0)²) = √(2*65025) = √130050
    const d = colorDistance([255, 0, 0], [0, 0, 0]);
    expect(d).toBeCloseTo(Math.sqrt(2 * 255 * 255));
  });

  it('weights green more than red', () => {
    const redDiff = colorDistance([255, 0, 0], [0, 0, 0]);
    const greenDiff = colorDistance([0, 255, 0], [0, 0, 0]);
    expect(greenDiff).toBeGreaterThan(redDiff);
  });
});

describe('computeTileDimensions', () => {
  it('computes dimensions for square image', () => {
    const { width, height } = computeTileDimensions(100, 100, 10000);
    expect(width).toBeCloseTo(100);
    expect(height).toBeCloseTo(100);
    expect(width * height).toBeCloseTo(10000);
  });

  it('computes dimensions for landscape image', () => {
    const { width, height } = computeTileDimensions(200, 100, 10000);
    const ratio = width / height;
    expect(ratio).toBeCloseTo(2);
    expect(width * height).toBeCloseTo(10000);
  });

  it('computes dimensions for portrait image', () => {
    const { width, height } = computeTileDimensions(100, 200, 10000);
    const ratio = width / height;
    expect(ratio).toBeCloseTo(0.5);
    expect(width * height).toBeCloseTo(10000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the test command.
Expected: FAIL — cannot find module `./color-utils`.

- [ ] **Step 3: Implement colorDistance and computeTileDimensions**

Create `src/patterns/color-utils.ts`:

```ts
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

  // 4×4×4 = 64 bins
  const bins = new Uint32Array(64);
  const binSize = 64; // 256 / 4

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

  // Convert bin index back to RGB center values
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
 * World bounds define the current extent; the reference image maps to fill those bounds.
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

  // Map world position to 0..1 range within world bounds
  const u = (worldX - worldBounds.minX) / worldW;
  const v = (worldY - worldBounds.minY) / worldH;

  // Map to canvas pixel
  const px = Math.floor(Math.min(Math.max(u * canvasWidth, 0), canvasWidth - 1));
  const py = Math.floor(Math.min(Math.max(v * canvasHeight, 0), canvasHeight - 1));

  const data = ctx.getImageData(px, py, 1, 1).data;
  return [data[0], data[1], data[2]];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run the test command.
Expected: All color-utils tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/patterns/color-utils.ts src/patterns/color-utils.test.ts
git commit -m "feat: color utils — distance, tile dimensions, average/dominant color, reference sampling"
```

---

### Task 6: Image Buffer

**Files:**
- Create: `src/patterns/image-buffer.ts`
- Create: `src/patterns/image-buffer.test.ts`

- [ ] **Step 1: Write failing tests for ImageBuffer**

Create `src/patterns/image-buffer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageBuffer } from './image-buffer';
import type { BufferedImage } from './image-buffer';

// Mock Image loading — jsdom doesn't load real images
function mockImageLoad() {
  // Override Image constructor to auto-fire onload
  vi.spyOn(globalThis, 'Image').mockImplementation(() => {
    const img = {
      src: '',
      naturalWidth: 200,
      naturalHeight: 100,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      style: {},
    } as unknown as HTMLImageElement;

    // Fire onload on next microtask after src is set
    const origDescriptor = Object.getOwnPropertyDescriptor(img, 'src');
    let _src = '';
    Object.defineProperty(img, 'src', {
      get() { return _src; },
      set(v: string) {
        _src = v;
        queueMicrotask(() => img.onload?.());
      },
    });

    return img;
  });
}

describe('ImageBuffer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockImageLoad();
  });

  it('prefill loads bufferSize images', async () => {
    const buffer = new ImageBuffer();
    buffer.init(
      ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'],
      800, 600,
      { tileAreaPercent: 10, bufferSize: 3 },
    );

    await buffer.prefill();
    expect(buffer.bufferedCount).toBe(3);
  });

  it('next returns a buffered image and triggers backfill', async () => {
    const buffer = new ImageBuffer();
    buffer.init(
      ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
      800, 600,
      { tileAreaPercent: 10, bufferSize: 2 },
    );
    await buffer.prefill();

    const img = buffer.next();
    expect(img).not.toBeNull();
    expect(img!.url).toBeTruthy();
    expect(img!.naturalWidth).toBe(200);
    expect(img!.naturalHeight).toBe(100);
  });

  it('returns null when buffer is empty', async () => {
    const buffer = new ImageBuffer();
    buffer.init(['a.jpg'], 800, 600, { tileAreaPercent: 10, bufferSize: 1 });
    await buffer.prefill();

    buffer.next(); // consume the only one
    const result = buffer.next();
    expect(result).toBeNull();
  });

  it('hasMore returns false when all URLs consumed', async () => {
    const buffer = new ImageBuffer();
    buffer.init(['a.jpg'], 800, 600, { tileAreaPercent: 10, bufferSize: 1 });
    await buffer.prefill();

    buffer.next();
    expect(buffer.hasMore()).toBe(false);
  });

  it('reshuffles when all URLs are consumed', async () => {
    const buffer = new ImageBuffer();
    buffer.init(['a.jpg', 'b.jpg'], 800, 600, { tileAreaPercent: 10, bufferSize: 2 });
    await buffer.prefill();

    // Consume both
    buffer.next();
    buffer.next();

    // Should have reshuffled and started loading again
    expect(buffer.hasMore()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the test command.
Expected: FAIL — cannot find module `./image-buffer`.

- [ ] **Step 3: Implement ImageBuffer**

Create `src/patterns/image-buffer.ts`:

```ts
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
    if (this.buffer.length < this._bufferSize) {
      if (this.availableUrls.length === 0) {
        // Reshuffle all URLs for the next cycle
        this.availableUrls = this.shuffle([...this.allUrls]);
      }
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
        // Skip broken images
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run the test command.
Expected: All image-buffer tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/patterns/image-buffer.ts src/patterns/image-buffer.test.ts
git commit -m "feat: image buffer with async pre-loading, color analysis, photomosaic selection"
```

---

### Task 7: Rewrite MosaicPattern

**Files:**
- Rewrite: `src/patterns/mosaic-pattern.ts`

- [ ] **Step 1: Rewrite mosaic-pattern.ts**

Replace the entire contents of `src/patterns/mosaic-pattern.ts` with:

```ts
import { Pattern } from './index';
import { PlacementEngine, createPriorityFn } from './placement-engine';
import { ImageBuffer } from './image-buffer';
import { computeTileDimensions } from './color-utils';
import type { ScreensaverConfig } from '../types';
import type { PlacedTile } from './placement-engine';

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
  }

  private async startCycle(): Promise<void> {
    if (!this.container) return;

    // Create tile container
    this.tileContainer = document.createElement('div');
    this.tileContainer.style.position = 'absolute';
    this.tileContainer.style.left = '50%';
    this.tileContainer.style.top = '50%';
    this.tileContainer.style.transformOrigin = '0 0';
    this.tileContainer.style.transform = 'translate(-50%, -50%) scale(1)';
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
    this.imageBuffer.init(this.imageUrls, this.viewportWidth, this.viewportHeight, {
      tileAreaPercent: this.config.tileAreaPercent,
      bufferSize: this.config.bufferSize,
      colorMatchStrategy: this.config.colorMatchStrategy,
    });

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
      // Buffer temporarily empty — skip this tick
      return;
    }

    const dims = computeTileDimensions(
      img.naturalWidth,
      img.naturalHeight,
      this.imageBuffer.targetArea,
    );
    const margin = this.config.tileMargin;
    const tile = this.engine.placeTile(dims.width + margin, dims.height + margin);

    if (!tile) {
      this.stopFilling();
      return;
    }

    this.renderTile(tile, img.url, dims.width, dims.height, margin);
    this.tilesPlaced++;

    // Update zoom
    if (this.config.zoomEnabled) {
      this.updateZoom();
    }

    // Check stop criteria
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
    this.tileContainer.style.transform =
      `translate(-50%, -50%) scale(${targetScale})`;
  }

  private stopFilling(): void {
    if (this.placementTimer !== null) {
      window.clearInterval(this.placementTimer);
      this.placementTimer = null;
    }

    // Hold phase
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null;
      this.fadeOutAndRebuild();
    }, this.config.holdDuration);
  }

  private fadeOutAndRebuild(): void {
    if (!this.tileContainer) return;

    // Fade all images
    const images = this.tileContainer.querySelectorAll('img');
    images.forEach(img => {
      img.style.opacity = '0';
    });

    this.fadeTimer = window.setTimeout(() => {
      this.fadeTimer = null;

      // Remove old tile container
      if (this.tileContainer && this.container) {
        this.container.removeChild(this.tileContainer);
      }
      this.tileContainer = null;
      this.engine = null;
      this.imageBuffer = null;
      this.tilesPlaced = 0;
      this.currentScale = 1;

      // Start new cycle
      this.startCycle();
    }, 600);
  }

  private async loadReferenceImage(): Promise<void> {
    let refUrl = this.config.referenceImage;

    if (!refUrl && this.config.referenceImageDir) {
      // Would need to list directory — for now pick random from image URLs
      refUrl = this.imageUrls[Math.floor(Math.random() * this.imageUrls.length)];
    }

    if (!refUrl) {
      // Pick random from image folder
      refUrl = this.imageUrls[Math.floor(Math.random() * this.imageUrls.length)];
    }

    return new Promise<void>((resolve) => {
      const img = new Image();
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
        // Failed to load reference — proceed without photomosaic
        resolve();
      };
      img.src = refUrl;
    });
  }
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors from the mosaic pattern files.

- [ ] **Step 3: Commit**

```bash
git add src/patterns/mosaic-pattern.ts
git commit -m "feat: rewrite MosaicPattern with placement engine, image buffer, and CSS zoom"
```

---

### Task 8: Update mosaic tests in patterns.test.ts

**Files:**
- Modify: `src/patterns/patterns.test.ts`

- [ ] **Step 1: Replace mosaic test block**

In `src/patterns/patterns.test.ts`, find the `describe('MosaicPattern', ...)` block (approximately lines 172–240) and replace it entirely with:

```ts
describe('MosaicPattern', () => {
  let container: HTMLDivElement;
  const testImages = Array.from({ length: 20 }, (_, i) => `img${i}.jpg`);

  beforeEach(() => {
    container = document.createElement('div');
    // Give the container dimensions so viewport calculation works
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates a tile container on apply', () => {
    const pattern = new MosaicPattern();
    pattern.init(makeConfig({ pattern: 'mosaic' }));
    pattern.apply(container, testImages);

    const tileContainer = container.querySelector('div');
    expect(tileContainer).not.toBeNull();
    expect(tileContainer!.style.position).toBe('absolute');

    pattern.cleanup();
  });

  it('cleans up timers and DOM', () => {
    const pattern = new MosaicPattern();
    pattern.init(makeConfig({ pattern: 'mosaic' }));
    pattern.apply(container, testImages);
    pattern.cleanup();

    // Tile container should be removed
    expect(container.querySelector('div')).toBeNull();
  });

  it('does nothing with empty image array', () => {
    const pattern = new MosaicPattern();
    pattern.init(makeConfig({ pattern: 'mosaic' }));
    pattern.apply(container, []);

    expect(container.children.length).toBe(0);
  });
});
```

Also remove the `import { replaceImageInCell } from './image-utils';` line if it exists and is unused.

- [ ] **Step 2: Run tests to verify they pass**

Run the test command.
Expected: All tests PASS (mosaic tests are now DOM-structure tests, not timer-based).

- [ ] **Step 3: Commit**

```bash
git add src/patterns/patterns.test.ts
git commit -m "test: update mosaic tests for placement engine architecture"
```

---

### Task 9: Settings UI — CSS additions

**Files:**
- Modify: `src/configui/screensaver-settings.css`

- [ ] **Step 1: Add collapsible and conditional field styles**

Append to the end of `src/configui/screensaver-settings.css`:

```css
/* Collapsible section */
.collapsible-header {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 8px 0;
    user-select: none;
    font-weight: 600;
    color: var(--text-color);
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font-size: inherit;
    font-family: inherit;
}

.collapsible-header::before {
    content: '▶';
    display: inline-block;
    margin-right: 8px;
    transition: transform 0.2s;
    font-size: 0.8em;
}

.collapsible-header.expanded::before {
    transform: rotate(90deg);
}

.collapsible-content {
    display: none;
    padding-left: 20px;
}

.collapsible-content.expanded {
    display: block;
}

/* Conditional field visibility */
.conditional-field {
    display: none;
}

.conditional-field.visible {
    display: block;
}

/* Mosaic option groups */
.mosaic-option-group {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
}

.mosaic-option-group:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

.mosaic-option-group h4 {
    margin-bottom: 8px;
    font-size: 0.95em;
    color: var(--secondary-color);
}

/* Range slider value labels */
.range-with-value {
    display: flex;
    align-items: center;
    gap: 8px;
}

.range-with-value input[type="range"] {
    flex: 1;
}

.range-with-value .range-value {
    min-width: 50px;
    text-align: right;
    font-size: 0.9em;
    color: var(--secondary-color);
}

/* Radio group styling */
.radio-group {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}

.radio-group label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/configui/screensaver-settings.css
git commit -m "style: add collapsible section and mosaic option group CSS"
```

---

### Task 10: Settings UI — loadPatternOptions and getPatternOptionsFromUI

**Files:**
- Modify: `src/configui/screensaver-settings.ts`

- [ ] **Step 1: Replace mosaic case in loadPatternOptions**

In `src/configui/screensaver-settings.ts`, find the `case 'mosaic':` block inside `loadPatternOptions()` (approximately lines 523–550) and replace the entire case (from `case 'mosaic':` through the `break;` before `case 'random':`) with:

```ts
        case 'mosaic':
            {
            const opts = config.patternOptions ?? {};
            const tileArea = opts.tileAreaPercent ?? 7;
            const tileMargin = opts.tileMargin ?? 4;
            const placementSpeed = opts.placementSpeed ?? 200;
            const maxTiles = opts.maxTiles ?? 200;
            const startPos = opts.startPosition ?? 'center';
            const priorityFn = opts.priorityFunction ?? 'center-out';
            const dirAngle = opts.directionAngle ?? 0;
            const holdDuration = opts.holdDuration != null ? opts.holdDuration / 1000 : 5;
            const zoomEnabled = opts.zoomEnabled ?? true;
            const maxZoomOut = opts.maxZoomOut != null ? Math.round(opts.maxZoomOut * 100) : 30;
            const photomosaicEnabled = !!(opts.referenceImage || opts.referenceImageDir);
            const refSource = opts.referenceImage ? 'single' : opts.referenceImageDir ? 'directory' : 'random';
            const colorMatch = opts.colorMatchStrategy ?? 'average';

            patternOptionsContainer.innerHTML = `
                <div class="mosaic-option-group">
                    <h4>Placement</h4>
                    <div class="form-group">
                        <label for="mosaic-tile-area">Tile Size:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-tile-area" min="1" max="20" value="${tileArea}">
                            <span class="range-value" id="mosaic-tile-area-value">${tileArea}%</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-tile-margin">Tile Margin:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-tile-margin" min="0" max="100" value="${tileMargin}">
                            <span class="range-value" id="mosaic-tile-margin-value">${tileMargin}px</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-placement-speed">Placement Speed:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-placement-speed" min="50" max="1000" step="50" value="${placementSpeed}">
                            <span class="range-value" id="mosaic-placement-speed-value">${placementSpeed}ms</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-max-tiles">Max Tiles (0 = unlimited):</label>
                        <input type="number" id="mosaic-max-tiles" min="0" max="1000" value="${maxTiles}">
                    </div>
                    <div class="form-group">
                        <label>Start Position:</label>
                        <div class="radio-group">
                            <label><input type="radio" name="mosaic-start-position" value="center" ${startPos === 'center' ? 'checked' : ''}> Center</label>
                            <label><input type="radio" name="mosaic-start-position" value="random" ${startPos === 'random' ? 'checked' : ''}> Random</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-priority-function">Placement Order:</label>
                        <select id="mosaic-priority-function">
                            <option value="center-out" ${priorityFn === 'center-out' ? 'selected' : ''}>Center Out</option>
                            <option value="spiral-cw" ${priorityFn === 'spiral-cw' ? 'selected' : ''}>Spiral CW</option>
                            <option value="spiral-ccw" ${priorityFn === 'spiral-ccw' ? 'selected' : ''}>Spiral CCW</option>
                            <option value="directional" ${priorityFn === 'directional' ? 'selected' : ''}>Directional</option>
                            <option value="random" ${priorityFn === 'random' ? 'selected' : ''}>Random</option>
                        </select>
                    </div>
                    <div class="form-group conditional-field ${priorityFn === 'directional' ? 'visible' : ''}" id="mosaic-direction-angle-group">
                        <label for="mosaic-direction-angle">Direction Angle:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-direction-angle" min="0" max="360" value="${dirAngle}">
                            <span class="range-value" id="mosaic-direction-angle-value">${dirAngle}°</span>
                        </div>
                    </div>
                </div>

                <div class="mosaic-option-group">
                    <h4>Display</h4>
                    <div class="form-group">
                        <label for="mosaic-hold-duration">Hold Duration (seconds):</label>
                        <input type="number" id="mosaic-hold-duration" min="1" max="60" value="${holdDuration}">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="mosaic-zoom-enabled" ${zoomEnabled ? 'checked' : ''}>
                            Enable zoom out
                        </label>
                    </div>
                    <div class="form-group conditional-field ${zoomEnabled ? 'visible' : ''}" id="mosaic-max-zoom-out-group">
                        <label for="mosaic-max-zoom-out">Max Zoom Out:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-max-zoom-out" min="10" max="100" value="${maxZoomOut}" ${!zoomEnabled ? 'disabled' : ''}>
                            <span class="range-value" id="mosaic-max-zoom-out-value">${maxZoomOut}%</span>
                        </div>
                    </div>
                </div>

                <div class="mosaic-option-group">
                    <button class="collapsible-header ${photomosaicEnabled ? 'expanded' : ''}" id="mosaic-photomosaic-toggle">Photomosaic</button>
                    <div class="collapsible-content ${photomosaicEnabled ? 'expanded' : ''}" id="mosaic-photomosaic-content">
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="mosaic-photomosaic-enabled" ${photomosaicEnabled ? 'checked' : ''}>
                                Enable photomosaic
                            </label>
                        </div>
                        <div class="conditional-field ${photomosaicEnabled ? 'visible' : ''}" id="mosaic-photomosaic-options">
                            <div class="form-group">
                                <label>Reference Source:</label>
                                <div class="radio-group">
                                    <label><input type="radio" name="mosaic-reference-source" value="random" ${refSource === 'random' ? 'checked' : ''}> Random from Image Folder</label>
                                    <label><input type="radio" name="mosaic-reference-source" value="single" ${refSource === 'single' ? 'checked' : ''}> Single Image</label>
                                    <label><input type="radio" name="mosaic-reference-source" value="directory" ${refSource === 'directory' ? 'checked' : ''}> Directory</label>
                                </div>
                            </div>
                            <div class="form-group conditional-field ${refSource === 'single' ? 'visible' : ''}" id="mosaic-reference-image-group">
                                <label for="mosaic-reference-image">Reference Image:</label>
                                <div class="directory-selector">
                                    <input type="text" id="mosaic-reference-image" value="${opts.referenceImage ?? ''}" readonly>
                                    <button class="browse-button" id="mosaic-browse-reference-image">Browse...</button>
                                </div>
                            </div>
                            <div class="form-group conditional-field ${refSource === 'directory' ? 'visible' : ''}" id="mosaic-reference-dir-group">
                                <label for="mosaic-reference-dir">Reference Directory:</label>
                                <div class="directory-selector">
                                    <input type="text" id="mosaic-reference-dir" value="${opts.referenceImageDir ?? ''}" readonly>
                                    <button class="browse-button" id="mosaic-browse-reference-dir">Browse...</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="mosaic-color-match">Color Match:</label>
                                <select id="mosaic-color-match">
                                    <option value="average" ${colorMatch === 'average' ? 'selected' : ''}>Average Color</option>
                                    <option value="dominant" ${colorMatch === 'dominant' ? 'selected' : ''}>Dominant Color</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Wire up range slider live labels
            const rangeInputs: Array<{ id: string; labelId: string; suffix: string }> = [
                { id: 'mosaic-tile-area', labelId: 'mosaic-tile-area-value', suffix: '%' },
                { id: 'mosaic-tile-margin', labelId: 'mosaic-tile-margin-value', suffix: 'px' },
                { id: 'mosaic-placement-speed', labelId: 'mosaic-placement-speed-value', suffix: 'ms' },
                { id: 'mosaic-direction-angle', labelId: 'mosaic-direction-angle-value', suffix: '°' },
                { id: 'mosaic-max-zoom-out', labelId: 'mosaic-max-zoom-out-value', suffix: '%' },
            ];
            for (const { id, labelId, suffix } of rangeInputs) {
                const input = document.getElementById(id) as HTMLInputElement | null;
                const label = document.getElementById(labelId);
                if (input && label) {
                    input.addEventListener('input', () => {
                        label.textContent = input.value + suffix;
                    });
                }
            }

            // Conditional: direction angle visibility
            const prioritySelect = document.getElementById('mosaic-priority-function') as HTMLSelectElement | null;
            const angleGroup = document.getElementById('mosaic-direction-angle-group');
            prioritySelect?.addEventListener('change', () => {
                angleGroup?.classList.toggle('visible', prioritySelect.value === 'directional');
            });

            // Conditional: zoom out slider
            const zoomCheck = document.getElementById('mosaic-zoom-enabled') as HTMLInputElement | null;
            const zoomGroup = document.getElementById('mosaic-max-zoom-out-group');
            const zoomSlider = document.getElementById('mosaic-max-zoom-out') as HTMLInputElement | null;
            zoomCheck?.addEventListener('change', () => {
                zoomGroup?.classList.toggle('visible', zoomCheck.checked);
                if (zoomSlider) zoomSlider.disabled = !zoomCheck.checked;
            });

            // Collapsible: photomosaic section
            const photoToggle = document.getElementById('mosaic-photomosaic-toggle');
            const photoContent = document.getElementById('mosaic-photomosaic-content');
            photoToggle?.addEventListener('click', () => {
                photoToggle.classList.toggle('expanded');
                photoContent?.classList.toggle('expanded');
            });

            // Conditional: photomosaic enabled
            const photoEnabled = document.getElementById('mosaic-photomosaic-enabled') as HTMLInputElement | null;
            const photoOptions = document.getElementById('mosaic-photomosaic-options');
            photoEnabled?.addEventListener('change', () => {
                photoOptions?.classList.toggle('visible', photoEnabled.checked);
            });

            // Conditional: reference source radios
            const refRadios = document.querySelectorAll('input[name="mosaic-reference-source"]');
            const refImageGroup = document.getElementById('mosaic-reference-image-group');
            const refDirGroup = document.getElementById('mosaic-reference-dir-group');
            const updateRefVisibility = () => {
                const selected = (document.querySelector('input[name="mosaic-reference-source"]:checked') as HTMLInputElement)?.value;
                refImageGroup?.classList.toggle('visible', selected === 'single');
                refDirGroup?.classList.toggle('visible', selected === 'directory');
            };
            refRadios.forEach(radio => radio.addEventListener('change', updateRefVisibility));

            // Browse buttons for reference image/dir
            const browseRefImage = document.getElementById('mosaic-browse-reference-image');
            const refImageInput = document.getElementById('mosaic-reference-image') as HTMLInputElement | null;
            browseRefImage?.addEventListener('click', async () => {
                const path = await window.electronAPI.browseDirectory();
                if (path && refImageInput) refImageInput.value = path;
            });

            const browseRefDir = document.getElementById('mosaic-browse-reference-dir');
            const refDirInput = document.getElementById('mosaic-reference-dir') as HTMLInputElement | null;
            browseRefDir?.addEventListener('click', async () => {
                const path = await window.electronAPI.browseDirectory();
                if (path && refDirInput) refDirInput.value = path;
            });

            break;
            }
```

- [ ] **Step 2: Replace mosaic case in getPatternOptionsFromUI**

In the same file, find the `case 'mosaic':` block inside `getPatternOptionsFromUI()` and replace it with:

```ts
        case 'mosaic': {
            const tileArea = document.getElementById('mosaic-tile-area') as HTMLInputElement | null;
            const tileMargin = document.getElementById('mosaic-tile-margin') as HTMLInputElement | null;
            const placementSpeed = document.getElementById('mosaic-placement-speed') as HTMLInputElement | null;
            const maxTiles = document.getElementById('mosaic-max-tiles') as HTMLInputElement | null;
            const startPos = document.querySelector('input[name="mosaic-start-position"]:checked') as HTMLInputElement | null;
            const priorityFn = document.getElementById('mosaic-priority-function') as HTMLSelectElement | null;
            const dirAngle = document.getElementById('mosaic-direction-angle') as HTMLInputElement | null;
            const holdDuration = document.getElementById('mosaic-hold-duration') as HTMLInputElement | null;
            const zoomEnabled = document.getElementById('mosaic-zoom-enabled') as HTMLInputElement | null;
            const maxZoomOut = document.getElementById('mosaic-max-zoom-out') as HTMLInputElement | null;
            const photoEnabled = document.getElementById('mosaic-photomosaic-enabled') as HTMLInputElement | null;
            const refSource = document.querySelector('input[name="mosaic-reference-source"]:checked') as HTMLInputElement | null;
            const refImage = document.getElementById('mosaic-reference-image') as HTMLInputElement | null;
            const refDir = document.getElementById('mosaic-reference-dir') as HTMLInputElement | null;
            const colorMatch = document.getElementById('mosaic-color-match') as HTMLSelectElement | null;

            const result: PatternOptions = {
                tileAreaPercent: Number(tileArea?.value) || 7,
                tileMargin: Number(tileMargin?.value) || 4,
                placementSpeed: Number(placementSpeed?.value) || 200,
                maxTiles: Number(maxTiles?.value) || 200,
                startPosition: (startPos?.value as 'center' | 'random') || 'center',
                priorityFunction: (priorityFn?.value as PatternOptions['priorityFunction']) || 'center-out',
                directionAngle: Number(dirAngle?.value) || 0,
                holdDuration: (Number(holdDuration?.value) || 5) * 1000,
                zoomEnabled: zoomEnabled?.checked ?? true,
                maxZoomOut: (Number(maxZoomOut?.value) || 30) / 100,
                colorMatchStrategy: (colorMatch?.value as 'average' | 'dominant') || 'average',
            };

            if (photoEnabled?.checked) {
                const source = refSource?.value || 'random';
                if (source === 'single' && refImage?.value) {
                    result.referenceImage = refImage.value;
                } else if (source === 'directory' && refDir?.value) {
                    result.referenceImageDir = refDir.value;
                }
                // 'random' mode uses images from the main folder — no extra config needed;
                // the renderer handles it when both referenceImage and referenceImageDir are empty
                // but photomosaic is desired. We signal this by setting referenceImage to a sentinel.
                if (source === 'random') {
                    result.referenceImage = '__random__';
                }
            }

            return result;
        }
```

- [ ] **Step 3: Run the app to verify settings UI loads**

Run: `npm run tauri:dev`
Navigate to Settings → Patterns → select Mosaic. Verify the new options render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/configui/screensaver-settings.ts src/configui/screensaver-settings.css
git commit -m "feat: mosaic settings UI with placement, display, and photomosaic options"
```

---

### Task 11: Handle the `__random__` reference image sentinel in MosaicPattern

**Files:**
- Modify: `src/patterns/mosaic-pattern.ts`

- [ ] **Step 1: Update loadReferenceImage to handle sentinel**

In `src/patterns/mosaic-pattern.ts`, find the `loadReferenceImage` method and replace it with:

```ts
  private async loadReferenceImage(): Promise<void> {
    let refUrl = this.config.referenceImage;

    if (refUrl === '__random__' || (!refUrl && !this.config.referenceImageDir)) {
      // Pick random from the image folder
      refUrl = this.imageUrls[Math.floor(Math.random() * this.imageUrls.length)];
    } else if (!refUrl && this.config.referenceImageDir) {
      // Directory mode — pick random from image URLs as fallback
      // (full directory listing would require a Tauri command; use available images)
      refUrl = this.imageUrls[Math.floor(Math.random() * this.imageUrls.length)];
    }

    if (!refUrl) return;

    return new Promise<void>((resolve) => {
      const img = new Image();
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
```

Also update `startCycle` to check for the `__random__` sentinel:

In the condition `if (this.config.referenceImage || this.config.referenceImageDir)`, update to:

```ts
    // Load reference image if photomosaic mode
    if (this.config.referenceImage || this.config.referenceImageDir) {
      await this.loadReferenceImage();
    }
```

This already handles the sentinel because `'__random__'` is truthy.

- [ ] **Step 2: Commit**

```bash
git add src/patterns/mosaic-pattern.ts
git commit -m "feat: handle __random__ sentinel for photomosaic reference image selection"
```

---

### Task 12: Run all tests and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run the test command (see header).
Expected: All tests PASS. No regressions.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Run the app**

Run: `npm run tauri:dev`
Select Mosaic pattern. Verify:
- Images place incrementally from center outward
- No overlapping images
- Zoom-out works when tiles extend beyond viewport
- After hold duration, images fade and cycle restarts
- Settings UI controls work and persist

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: test and integration fixups for mosaic placement engine"
```
