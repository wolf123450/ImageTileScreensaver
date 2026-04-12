# Mosaic Performance Optimizations Design

**Date:** 2025-07-10  
**Status:** Approved  
**Scope:** Two independent performance improvements for the mosaic screensaver pattern

## Problem Statement

1. **Photomosaic freeze:** When photomosaic mode is enabled with thousands of images (~4760), computing `averageColor`/`dominantColor` per image during `ImageBuffer.loadNext()` blocks the rendering loop, freezing the screensaver after the first tile.
2. **Deep zoom DOM overload:** At deep zoom-out levels (e.g., 1.5625%), the grid has far more cells than needed. Placing thousands of tiles that render at <2px wastes DOM resources.

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

**Trigger:** User clicks Save in settings with photomosaic enabled.

**Flow:**
1. Settings UI intercepts the save action
2. Reads existing cache via `read_color_cache` Tauri command
3. Gets image list from existing `list_images` command
4. Gets file stats via `get_file_stats` for all images
5. Filters to images needing (re)computation (missing or stale cache entries)
6. If no images need computation, proceeds directly to save
7. Spawns Web Worker (`src/configui/color-worker.ts`) with the filtered image list
8. Worker processes images in batches (~50 at a time):
   - Fetches image via `fetch()`, creates `ImageBitmap` via `createImageBitmap()`
   - Draws to `OffscreenCanvas`, samples pixels for average + dominant color
   - Posts `{ path, avgColor, domColor }` per image + batch progress
9. Settings UI shows progress: `"Computing colors: 1234 / 4760 (26%)"`
10. On completion, merges new entries with existing cache, writes via `write_color_cache`
11. Proceeds with normal config save

**Cancel behavior:** If cancelled, saves config without updating the cache. Screensaver falls back to on-the-fly computation (existing behavior).

**Error handling:** If an image fails to load (corrupt, unsupported format), skip it and continue. Log to console.

### Worker File

**Path:** `src/configui/color-worker.ts`

Dedicated Web Worker that:
- Receives list of image paths to process
- For each image: fetches via `fetch()`, creates `ImageBitmap` via `createImageBitmap()`, draws to `OffscreenCanvas` (1×1 for average, 16×16 for dominant)
- Uses the same color algorithms as `src/patterns/color-utils.ts` (duplicated for worker context — workers cannot import DOM-dependent modules)
- Posts progress messages: `{ type: 'progress', completed: number, total: number }`
- Posts result messages: `{ type: 'result', path: string, avgColor: string, domColor: string }`
- Posts completion message: `{ type: 'done' }`

### Progress UI

When precomputation is active:
- Save button is replaced with a progress bar + Cancel button
- Progress text: `"Computing colors: N / Total (X%)"`
- On cancel or completion, Save button reappears

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

**Constant:** `MIN_TILE_PIXELS = 16` — minimum rendered tile dimension in pixels (internal, not user-configurable).

**Check location:** `MosaicPattern.tick()`, after computing `currentScale` but before calling `engine.next()`.

**Logic:**
```typescript
const renderedTileSize = tilePixelSize * this.currentScale;
if (renderedTileSize < MIN_TILE_PIXELS) {
  // Treat mosaic as full — stop placing tiles, proceed to hold/zoom
  this.startHold();
  return;
}
```

### Behavior by Zoom Level

Example with 7% tile area on 1920×1080 (tile ≈ 134px):

| Zoom Level | Rendered Size | Tiles Placed | Effect |
|---|---|---|---|
| 100% | 134px | Normal | No change |
| 50% | 67px | Normal | No change |
| 25% | 33px | Normal | No change |
| 12.5% | 17px | Normal | Just above threshold |
| 6.25% | 8px | Stops early | Below 16px |
| 3.125% | 4px | Very few | Well below |
| 1.5625% | 2px | Almost none | Tiles invisible |

### Impact

- No new settings or UI changes
- Fully automatic — users see the same visual result, the screensaver just avoids creating tiles too small to perceive
- Reduces DOM element count at deep zoom from potentially thousands to a reasonable number
- Preserves placement order — the engine still picks tile positions by priority, it just stops earlier

## Testing

### Color Cache
- Unit test: cache invalidation logic (mtime/size mismatch triggers recompute)
- Unit test: ImageBuffer uses cache when available, falls back on miss
- Manual test: settings save with photomosaic enabled shows progress and creates cache file

### Adaptive Tiles
- Unit test: MosaicPattern stops placing tiles when rendered size < MIN_TILE_PIXELS
- Unit test: at 100% zoom, behavior unchanged (renderedTileSize above threshold)

## File Changes Summary

| File | Change |
|---|---|
| `src-tauri/src/commands.rs` | Add `read_color_cache`, `write_color_cache`, `get_file_stats` commands |
| `src-tauri/src/lib.rs` | Register new commands |
| `src/configui/color-worker.ts` | New file — Web Worker for color precomputation |
| `src/configui/screensaver-settings.ts` | Precompute flow on save, progress UI |
| `src/patterns/image-buffer.ts` | Accept and use color cache |
| `src/patterns/mosaic-pattern.ts` | Pass cache to ImageBuffer, adaptive tile stop |
| `src/types.ts` | ColorCache type definition |
| `webpack.config.js` | Bundle the worker file |
