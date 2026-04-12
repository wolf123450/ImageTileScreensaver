# Mosaic Placement Engine — Design Spec

**Date:** 2026-04-12
**Status:** Draft — awaiting review

## Overview

Rework the mosaic pattern from a CSS Grid layout to a corner-based placement algorithm that incrementally builds a collage of images, optionally forming a photomosaic of a reference image. Images are placed one at a time using a priority queue of free corners, with configurable placement order, zoom-out behavior, and color matching.

## Architecture

Three-layer design with clear separation of concerns:

| Layer | File | Responsibility | DOM? |
|-------|------|---------------|------|
| 1. Placement Engine | `placement-engine.ts` | Pure rectangle packing: priority queue, collision detection, corner management | No |
| 2. Image Buffer | `image-buffer.ts` | Async image pre-loading, tile dimension computation, color analysis | Minimal (Image objects) |
| 3. Mosaic Renderer | `mosaic-pattern.ts` | DOM rendering, CSS zoom, cycle lifecycle, `Pattern` interface | Yes |
| Utility | `color-utils.ts` | Color distance, average/dominant color, reference image sampling | Minimal (OffscreenCanvas) |

## Data Types

```ts
// World-space rectangle (origin at center of world)
interface PlacedTile {
  x: number;      // left edge in world coords
  y: number;      // top edge in world coords
  width: number;
  height: number;
}

// A corner exposed by a placed tile, candidate for next placement
interface FreeCorner {
  x: number;
  y: number;
  priority: number;  // computed by priority function, lower = higher priority
}

// Image with pre-loaded metadata
interface BufferedImage {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  avgColor: [number, number, number];  // RGB
}

// Priority function signature
type PriorityFn = (corner: { x: number; y: number }) => number;
```

## Configuration

New fields added to `PatternOptions` in `types.ts`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `placementSpeed` | number (ms) | 200 | Delay between placing tiles |
| `tileAreaPercent` | number (1-20) | 7 | Target tile area as % of viewport area |
| `tileMargin` | number (0-100 px) | 4 | Gap between tiles in world space |
| `priorityFunction` | enum | `"center-out"` | `"center-out"`, `"spiral-cw"`, `"spiral-ccw"`, `"random"`, `"directional"` |
| `directionAngle` | number (0-360) | 0 | Angle for directional priority |
| `startPosition` | enum | `"center"` | `"center"` or `"random"` |
| `maxTiles` | number | 200 | Stop criterion (0 = unlimited) |
| `holdDuration` | number (ms) | 5000 | How long to display completed mosaic |
| `zoomEnabled` | boolean | true | Whether to zoom out for off-screen tiles |
| `maxZoomOut` | number (0.1-1.0) | 0.3 | Minimum scale factor |
| `bufferSize` | number | 5 | Number of images to pre-load ahead |
| `referenceImage` | string | `""` | Path to reference image (empty = disabled) |
| `referenceImageDir` | string | `""` | Directory to pick random reference from |
| `colorMatchStrategy` | enum | `"average"` | `"average"` or `"dominant"` |

## Layer 1: Placement Engine (`placement-engine.ts`)

### Class: `PlacementEngine`

Pure math, no DOM, no margin concept. Receives inflated dimensions from the caller.

#### State

- `placedTiles: PlacedTile[]` — all tiles placed so far
- `freeCorners: FreeCorner[]` — sorted by priority (ascending = best first)
- `priorityFn: PriorityFn` — determines corner ordering

#### Constructor

```ts
constructor(priorityFn: PriorityFn)
```

#### Methods

**`seedFirstTile(width, height, position: 'center' | 'random', viewportWidth, viewportHeight): PlacedTile`**

Places the first tile with no collision check.
- `'center'`: tile centered at world origin → `x = -width/2, y = -height/2`
- `'random'`: random position within viewport bounds
- Adds tile's 4 corners to `freeCorners`, sorted by priority.
- Returns the placed tile.

**`placeTile(width, height): PlacedTile | null`**

Core placement algorithm:

1. If no `freeCorners`, return `null`.
2. For each corner in `freeCorners` (best priority first):
   a. Try 4 orientations — place the new tile's corner at the queue corner:
      - top-left at corner: tile occupies `(cx, cy)` to `(cx+w, cy+h)`
      - top-right at corner: tile occupies `(cx-w, cy)` to `(cx, cy+h)`
      - bottom-left at corner: tile occupies `(cx, cy-h)` to `(cx+w, cy)`
      - bottom-right at corner: tile occupies `(cx-w, cy-h)` to `(cx, cy)`
   b. For each orientation, check AABB collision with all placed tiles.
   c. First non-colliding orientation → place the tile.
   d. If all 4 orientations collide → remove this corner from queue, try next.
3. If placed:
   a. Add to `placedTiles`.
   b. Add the new tile's 4 corners to `freeCorners`.
   c. Re-sort by priority function.
   d. Return the `PlacedTile`.
4. If no valid placement found, return `null`.

**No corner deduplication.** Duplicates are rare (only when tile edge lengths match) and dead corners are culled naturally during placement.

**`getWorldBounds(): { minX, minY, maxX, maxY }`**

Bounding box of all placed tiles.

**`reset(): void`**

Clears `placedTiles` and `freeCorners`.

#### Collision check

Pure AABB, no margin (margin is baked into dimensions by the caller):

```
a.x < b.x + b.width  AND  a.x + a.width > b.x  AND
a.y < b.y + b.height AND  a.y + a.height > b.y
```

#### Built-in priority functions

| Name | Formula | Effect |
|------|---------|--------|
| `center-out` | `√(x² + y²)` | Concentric rings from center |
| `spiral-cw` | `√(x² + y²) + 0.1 · atan2(y, x)` | Clockwise spiral outward |
| `spiral-ccw` | `√(x² + y²) - 0.1 · atan2(y, x)` | Counter-clockwise spiral outward |
| `directional` | `x·cos(θ) + y·sin(θ)` | Fills along a direction |
| `random` | `Math.random()` | Random placement order |

The spiral coefficient (0.1) is an internal constant, not configurable.

## Layer 2: Image Buffer (`image-buffer.ts`)

### Class: `ImageBuffer`

#### State

- `allUrls: string[]` — full image URL list
- `availableUrls: string[]` — shuffled pool, reshuffled when exhausted
- `buffer: BufferedImage[]` — pre-loaded images ready for placement
- `targetArea: number` — target tile area in world-space px²
- `bufferSize: number` — how many to keep loaded ahead
- `loading: boolean` — whether background load is in progress

#### Methods

**`init(imageUrls, viewportWidth, viewportHeight, config): void`**

Shuffles URLs, computes `targetArea = viewportWidth * viewportHeight * (tileAreaPercent / 100)`, triggers initial pre-load.

**`prefill(): Promise<void>`**

Loads `bufferSize` images. Resolves when buffer is full. Called once at startup before placement begins.

**`next(): BufferedImage | null`**

Pops the next image from the buffer. Triggers background loading to refill. Returns `null` if buffer is empty.

**`nextForPosition(worldX, worldY, worldBounds, referenceCanvas): BufferedImage | null`**

Photomosaic mode: scans all buffered images, picks the one with minimum `colorDistance` to the reference color at the given world position. Removes selected image from buffer and triggers backfill.

**`computeTileDimensions(img: BufferedImage): { width: number; height: number }`**

Given target area `A` and aspect ratio `r = naturalWidth / naturalHeight`:
- `width = √(A · r)`
- `height = √(A / r)`

**`private loadNext(): Promise<void>`**

Creates `Image()`, waits for `onload`, computes average color via `color-utils`, pushes to buffer.

## Color Utils (`color-utils.ts`)

**`averageColor(img: HTMLImageElement): [number, number, number]`**

Draw image to a 1×1 offscreen canvas, read the single pixel. Returns RGB tuple.

**`dominantColor(img: HTMLImageElement): [number, number, number]`**

Draw to a 16×16 canvas, histogram all pixels into 4×4×4 = 64 RGB bins, return center of the most populated bin.

**`colorDistance(a: [r,g,b], b: [r,g,b]): number`**

Weighted Euclidean: `√(2·ΔR² + 4·ΔG² + 3·ΔB²)`

**`sampleReferenceAt(canvas: OffscreenCanvas, worldX, worldY, worldBounds): [number, number, number]`**

Maps world coordinates to reference image pixel coordinates using progressive mapping (world bounds define what portion of the reference is visible). Reads pixel at the mapped position.

## Layer 3: Mosaic Renderer (`mosaic-pattern.ts`)

### Class: `MosaicPattern` implements `Pattern`

#### DOM Structure

```html
<div id="image-container" style="overflow: hidden">
  <div class="mosaic-world" style="position: absolute; left: 50%; top: 50%;
       transform-origin: 0 0; transform: translate(-50%, -50%) scale(S)">
    <img style="position: absolute; left: Xpx; top: Ypx; width: Wpx; height: Hpx" />
    ...
  </div>
</div>
```

World-space origin `(0, 0)` maps to the center of the viewport. CSS transform handles zoom.

#### State

- `engine: PlacementEngine`
- `imageBuffer: ImageBuffer`
- `container: HTMLElement` — outer container
- `tileContainer: HTMLDivElement` — inner div with CSS transform
- `referenceCanvas: OffscreenCanvas | null`
- `tilesPlaced: number`
- `currentScale: number`
- `placementTimer: number | null`
- `holdTimer: number | null`
- `fadeTimer: number | null`

#### `init(config: ScreensaverConfig): void`

Reads all config from `ScreensaverConfig` + `PatternOptions`.

#### `apply(container: HTMLElement, imageUrls: string[]): void`

1. Create inner `tileContainer` div, append to `container`.
2. Initialize `ImageBuffer` with URLs, viewport size, config.
3. If photomosaic mode: load reference image (from path, directory, or random from image list), draw to `OffscreenCanvas`.
4. Initialize `PlacementEngine` with the configured priority function.
5. Call `imageBuffer.prefill()` (await).
6. Start placement loop.

#### Placement tick

1. Get next image from buffer:
   - Photomosaic: peek at best corner, call `nextForPosition(corner.x, corner.y, worldBounds, referenceCanvas)`.
   - Normal: call `next()`.
   - If `null` but more URLs remain to load: skip this tick (wait for buffer to refill).
   - If `null` and no more URLs: stop.
2. Compute tile dimensions from aspect ratio + target area.
3. Inflate by margin: `(width + tileMargin, height + tileMargin)`.
4. Call `engine.placeTile(inflatedW, inflatedH)`.
   - If `null`: all corners exhausted → enter hold phase.
5. Create `<img>` element:
   - `position: absolute`
   - `left: tile.x + margin/2` px
   - `top: tile.y + margin/2` px
   - `width: tile.width - margin` px
   - `height: tile.height - margin` px
   - `opacity: 0`, `transition: opacity 0.3s`
   - Append to `tileContainer`, `requestAnimationFrame` → `opacity: 1`
6. Update zoom (if enabled):
   - `worldBounds = engine.getWorldBounds()`
   - `scaleX = viewportWidth / (maxX - minX)`
   - `scaleY = viewportHeight / (maxY - minY)`
   - `targetScale = min(scaleX, scaleY, 1.0)`
   - Clamp to `maxZoomOut`
   - Apply `transform: translate(-50%, -50%) scale(S)` with CSS transition
7. Check stop criteria:
   - `tilesPlaced >= maxTiles` → stop
   - `targetScale <= maxZoomOut` → stop
8. Schedule next tick after `placementSpeed` ms.

#### Cycle lifecycle

```
FILLING → tick() loop runs
  ↓ (stop criterion met)
HOLDING → wait holdDuration ms
  ↓
CLEARING → fade all images to opacity 0 (0.5s CSS transition)
  ↓ (600ms timer)
REBUILDING → engine.reset(), clear tileContainer innerHTML,
             optionally pick new reference image, restart filling
```

#### `cleanup(): void`

Clears all timers (`placementTimer`, `holdTimer`, `fadeTimer`), removes `tileContainer`.

## Testing Strategy

**`placement-engine.test.ts`** — pure unit tests, no DOM:
- Seed tile placement at center/random
- Verify tiles don't overlap
- Verify corners are generated after placement
- Verify dead corners are culled
- Verify priority ordering (center-out, spiral, etc.)
- Verify `getWorldBounds()` accuracy
- Verify `placeTile` returns null when no space available

**`image-buffer.test.ts`** — mock `Image` loading:
- Buffer pre-fill loads correct number
- `next()` returns images and triggers backfill
- `computeTileDimensions` math is correct
- `nextForPosition` picks best color match

**`color-utils.test.ts`** — mock canvas:
- `averageColor` returns correct RGB
- `colorDistance` math is correct

**Existing mosaic tests** in `patterns.test.ts` will be updated to match the new behavior.

## Files Changed

| File | Action |
|------|--------|
| `src/patterns/placement-engine.ts` | New |
| `src/patterns/image-buffer.ts` | New |
| `src/patterns/color-utils.ts` | New |
| `src/patterns/mosaic-pattern.ts` | Rewrite |
| `src/patterns/placement-engine.test.ts` | New |
| `src/patterns/image-buffer.test.ts` | New |
| `src/patterns/color-utils.test.ts` | New |
| `src/patterns/patterns.test.ts` | Update mosaic tests |
| `src/types.ts` | Add new `PatternOptions` fields |
| `src/configui/screensaver-settings.ts` | Replace mosaic case in `loadPatternOptions()` and `getPatternOptionsFromUI()` |
| `src/configui/screensaver-settings.css` | Add collapsible section and conditional visibility styles |

## Settings UI

All mosaic options are rendered dynamically in `#pattern-options-container` when the mosaic pattern is selected —  no new tabs or HTML changes needed. The existing `loadPatternOptions('mosaic')` case is replaced entirely.

### Group 1: Placement Settings (always visible)

| Control | Type | Range | Default | ID |
|---------|------|-------|---------|-----|
| Tile Size | range slider | 1-20% | 7% | `mosaic-tile-area` |
| Tile Margin | range slider | 0-100 px | 4 px | `mosaic-tile-margin` |
| Placement Speed | range slider | 50-1000 ms | 200 ms | `mosaic-placement-speed` |
| Max Tiles | number input | 0-1000 (0=unlimited) | 200 | `mosaic-max-tiles` |
| Start Position | radio | Center / Random | Center | `mosaic-start-position` |
| Placement Order | dropdown | Center Out / Spiral CW / Spiral CCW / Directional / Random | Center Out | `mosaic-priority-function` |
| Direction Angle | range slider | 0-360° | 0° | `mosaic-direction-angle` |

- Direction Angle is only visible when Placement Order is "Directional".

### Group 2: Display Settings (always visible)

| Control | Type | Range | Default | ID |
|---------|------|-------|---------|-----|
| Hold Duration | number input | 1-60 seconds | 5 s | `mosaic-hold-duration` |
| Zoom Out | checkbox | — | checked | `mosaic-zoom-enabled` |
| Max Zoom Out | range slider | 10-100% | 30% | `mosaic-max-zoom-out` |

- Max Zoom Out slider is disabled when Zoom Out checkbox is unchecked.

### Group 3: Photomosaic (collapsible, collapsed by default)

| Control | Type | Options | Default | ID |
|---------|------|---------|---------|-----|
| Enable Photomosaic | checkbox | — | unchecked | `mosaic-photomosaic-enabled` |
| Reference Source | radio | Single Image / Directory / Random from Image Folder | Random | `mosaic-reference-source` |
| Reference Image | text + Browse button | file path | (empty) | `mosaic-reference-image` |
| Reference Directory | text + Browse button | directory path | (empty) | `mosaic-reference-dir` |
| Color Match | dropdown | Average Color / Dominant Color | Average | `mosaic-color-match` |

- Sub-options only appear when Enable Photomosaic is checked.
- Reference Image field only visible when Reference Source is "Single Image".
- Reference Directory field only visible when Reference Source is "Directory".
- When Reference Source is "Random from Image Folder", no additional path field is shown.

### Conditional Visibility Logic

- `mosaic-direction-angle`: shown when `mosaic-priority-function` value is `"directional"`.
- `mosaic-max-zoom-out`: enabled when `mosaic-zoom-enabled` is checked.
- Photomosaic sub-group contents: shown when `mosaic-photomosaic-enabled` is checked.
- `mosaic-reference-image` row: shown when reference source radio is `"single"`.
- `mosaic-reference-dir` row: shown when reference source radio is `"directory"`.

### CSS Additions

- `.collapsible-section` — header with toggle arrow, click to expand/collapse content.
- `.conditional-field` — `display: none` by default, shown via `.conditional-field.visible`.
- Collapsible and conditional styles follow existing theme variables.

### TypeScript Changes

**`loadPatternOptions('mosaic')`** — replace the current density-only HTML with the full three-group layout. Attach event listeners for conditional visibility toggles.

**`getPatternOptionsFromUI()` mosaic case** — read all new fields and return them in `PatternOptions`.

**`updateUIFromConfig()`** — existing flow already calls `selectPattern(config.pattern)` which calls `loadPatternOptions()`, so initial values are populated via the existing config object. No additional wiring needed.

## Out of Scope

- Canvas rendering backend (future pivot if needed)
- Spatial indexing optimization (not needed at <500 tiles)
- Rust-side config schema migration (separate task)
