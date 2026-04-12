# Mosaic Performance Optimizations Design

**Date:** 2025-07-10  
**Status:** Approved  
**Scope:** Two independent performance improvements for the mosaic screensaver pattern

## Coordinate Spaces

The mosaic system uses four coordinate spaces. All use pixel units but represent different things:

| Space | Origin | Units | Used By |
|---|---|---|---|
| **Screen space** | Top-left of viewport | Physical screen pixels | Viewport dimensions, final rendered output |
| **World space** | Center (0, 0) | Logical pixels (= screen pixels at 100% zoom) | PlacementEngine tile positions, tile dimensions from `computeTileDimensions()` |
| **Subimage space** | Top-left of source image | Source image pixels | `img.naturalWidth`, `img.naturalHeight` |
| **Reference image space** | Top-left of reference image | Reference image pixels | Photomosaic color sampling via `referenceCtx` |

**Key relationships:**
- World → Screen: `screenPx = worldPx * currentScale` (where `currentScale` ∈ [maxZoomOut, 1.0])
- `targetArea` is computed from screen-space viewport area but produces world-space tile dimensions (equivalent at 100% zoom since world space is initialized from viewport dimensions)
- `computeTileDimensions()` returns world-space width/height
- PlacementEngine operates entirely in world space

## Problem Statement

1. **Photomosaic freeze:** When photomosaic mode is enabled with thousands of images (~4760), computing `averageColor`/`dominantColor` per image during `ImageBuffer.loadNext()` blocks the rendering loop, freezing the screensaver after the first tile.
2. **Deep zoom DOM overload:** At deep zoom-out levels (e.g., 1.5625%), the grid has far more cells than needed. Placing thousands of tiles that render at <2px **screen space** wastes DOM resources.

## Feature 1: Color Cache & Precomputation

### Overview

Precompute average and dominant colors for all images when the user saves settings with photomosaic enabled. Store results in a persistent JSON cache. During screensaver playback, `ImageBuffer` reads from the cache instead of computing colors on the fly.

### Cache File

**Location:** `{AppData}/ImageTileScreensaver/color-cache.json`

**Schema:**
```json
{
  "version": 1,
  "entries": {
    "C:/Photos/img001.jpg": {
      "avgColor": "#4a6b3c",
      "domColor": "#2d4f1e",
      "mtime": 1718300000000,
      "size": 2048576
    }
  }
}
```

**Invalidation:** An entry is valid when both `mtime` and `size` match the current file stats. Stale entries are recomputed.

### Rust Commands

Three new Tauri commands in `src-tauri/src/commands.rs`:

- `read_color_cache() -> String` — reads `color-cache.json` from the app data directory, returns contents or `"{}"` if missing
- `write_color_cache(data: String)` — writes `color-cache.json` to the app data directory
- `get_file_stats(paths: Vec<String>) -> Vec<FileStatEntry>` — returns `{ path, mtime, size }` for each path, skipping files that don't exist

### Web Worker Precomputation

**Trigger:** User clicks a dedicated "Bake Color Cache" button in the photomosaic settings section.

This is separate from Save. The user can bake at any time; saving does **not** trigger precomputation.

**Flow:**
1. User clicks "Bake Color Cache" button
2. Reads existing cache via `read_color_cache` Tauri command
3. Gets image list from existing `list_images` command
4. Gets file stats via `get_file_stats` for all images
5. Filters to images needing (re)computation (missing or stale cache entries)
6. If no images need computation, shows "Cache is up to date" and returns
7. Spawns Web Worker (`src/configui/color-worker.ts`) with the filtered image list
8. Worker processes images in batches (~50 at a time):
   - Fetches image via `fetch()`, creates `ImageBitmap` via `createImageBitmap()`
   - Draws to `OffscreenCanvas`, samples pixels for average + dominant color
   - Posts `{ path, avgColor, domColor }` per image + batch progress
9. Bake button is replaced with progress bar + Cancel button: `"Computing colors: 1234 / 4760 (26%)"`
10. On completion, merges new entries with existing cache, writes via `write_color_cache`
11. Updates cache status indicator to "all clear"

**Cancel behavior:** If cancelled, writes whatever has been computed so far to the cache (partial progress is preserved). Status indicator updates to reflect remaining uncomputed count.

**Error handling:** If an image fails to load (corrupt, unsupported format), skip it and continue. Log to console.

### Cache Status Indicator

A status banner in the photomosaic settings section that shows cache health:

- **All clear** (green): All images in the configured directory have valid cache entries. `"Color cache up to date (4760 images)"`
- **Warning** (yellow): Some images are missing or stale. `"Color cache incomplete: 234 of 4760 images need recomputation. Click Bake to update."`
- **Error** (red): No cache exists yet. `"No color cache found. Click Bake to precompute colors for photomosaic mode."`

**When checked:** On page load (when photomosaic is enabled) and after bake completes. The check reads the cache file and compares against the current image list + file stats.

**On save:** If photomosaic is enabled and cache is incomplete, save proceeds normally but the status indicator remains visible as a warning. The screensaver will fall back to on-the-fly computation for uncached images.

### Worker File

**Path:** `src/configui/color-worker.ts`

Dedicated Web Worker that:
- Receives list of image paths to process
- For each image: fetches via `fetch()`, creates `ImageBitmap` via `createImageBitmap()`, draws to `OffscreenCanvas` (1×1 for average, 16×16 for dominant)
- Uses the same color algorithms as `src/patterns/color-utils.ts` (duplicated for worker context — workers cannot import DOM-dependent modules)
- Posts progress messages: `{ type: 'progress', completed: number, total: number }`
- Posts result messages: `{ type: 'result', path: string, avgColor: string, domColor: string }`
- Posts completion message: `{ type: 'done' }`

### Bake UI

In the photomosaic settings section, below the color match strategy dropdown:

1. **Cache status indicator** — always visible when photomosaic is enabled (green/yellow/red as described above)
2. **"Bake Color Cache" button** — triggers the precomputation flow
3. **During bake:** button is replaced with progress bar + Cancel button showing `"Computing colors: N / Total (X%)"`
4. **After bake (or cancel):** button reappears, status indicator updates

### ImageBuffer Changes

- Constructor accepts an optional `colorCache: Map<string, { avgColor: string, domColor: string }>`
- `loadNext()` looks up the cache first. On cache hit, skips `averageColor()`/`dominantColor()` computation
- On cache miss (shouldn't normally happen with precomputation), falls back to computing on the fly

### MosaicPattern Changes

- Passes the color cache through to `ImageBuffer` during construction
- Loads the cache from `read_color_cache` during `start()` before creating the `ImageBuffer`

## Feature 2: Adaptive Tile Count

### Overview

Automatically stop placing tiles when they would render below a perceivable size. This prevents DOM overload at deep zoom levels without requiring user configuration.

### Mechanism

**Constant:** `MIN_TILE_SCREEN_PX = 16` — minimum rendered tile dimension in **screen-space** pixels (internal, not user-configurable).

**Check location:** `MosaicPattern.tick()`, after computing `currentScale` but before calling `engine.next()`.

**Logic:**
```typescript
// tileWorldWidth is in world-space pixels (from computeTileDimensions)
// currentScale converts world → screen: screenPx = worldPx * currentScale
const tileScreenWidth = tileWorldWidth * this.currentScale;
if (tileScreenWidth < MIN_TILE_SCREEN_PX) {
  // Tile would be too small to perceive in screen space — stop placing
  this.startHold();
  return;
}
```

Note: `tileWorldWidth` comes from `computeTileDimensions()`, which computes world-space dimensions from `targetArea` (itself derived from screen-space viewport area × tileAreaPercent). At 100% zoom, world pixels equal screen pixels. At deeper zoom levels, `currentScale < 1.0` shrinks tiles on screen.

### Behavior by Zoom Level

Example with 7% tile area on 1920×1080 (world-space tile ≈ 134px):

| Zoom Level | currentScale | Screen-Space Size | Effect |
|---|---|---|---|
| 100% | 1.0 | 134px | No change |
| 50% | 0.5 | 67px | No change |
| 25% | 0.25 | 33px | No change |
| 12.5% | 0.125 | 17px | Just above threshold |
| 6.25% | 0.0625 | 8px | Below 16px — stops early |
| 3.125% | 0.03125 | 4px | Well below |
| 1.5625% | 0.015625 | 2px | Tiles invisible |

### Impact

- No new settings or UI changes
- Fully automatic — users see the same visual result, the screensaver just avoids creating tiles too small to perceive on screen
- Reduces DOM element count at deep zoom from potentially thousands to a reasonable number
- Preserves placement order — the engine still picks world-space tile positions by priority, it just stops when the next tile would be imperceptible in screen space

## Testing

### Color Cache
- Unit test: cache invalidation logic (mtime/size mismatch triggers recompute)
- Unit test: ImageBuffer uses cache when available, falls back on miss
- Manual test: bake button triggers precomputation with progress bar, creates cache file
- Manual test: cache status indicator shows correct state (all clear / warning / error)

### Adaptive Tiles
- Unit test: MosaicPattern stops placing tiles when screen-space rendered size < MIN_TILE_SCREEN_PX
- Unit test: at 100% zoom (currentScale=1.0), behavior unchanged (screen-space tile size above threshold)

## File Changes Summary

| File | Change |
|---|---|
| `src-tauri/src/commands.rs` | Add `read_color_cache`, `write_color_cache`, `get_file_stats` commands |
| `src-tauri/src/lib.rs` | Register new commands |
| `src/configui/color-worker.ts` | New file — Web Worker for color precomputation |
| `src/configui/screensaver-settings.ts` | Bake button, cache status indicator, progress UI |
| `src/patterns/image-buffer.ts` | Accept and use color cache |
| `src/patterns/mosaic-pattern.ts` | Pass cache to ImageBuffer, adaptive tile stop |
| `src/types.ts` | ColorCache type definition |
| `webpack.config.js` | Bundle the worker file |
