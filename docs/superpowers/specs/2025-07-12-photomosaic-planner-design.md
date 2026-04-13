# Photomosaic Planner Design

## Problem

The current photomosaic implementation selects images from a small buffer (default 5) and picks the best color match from that limited set. This produces poor results — the best match across all available images is almost never in a 5-image window. Meanwhile, we already have a color cache that pre-computes colors for every image. We should use it.

Additionally, the mosaic pattern conflates two distinct use cases: a decorative tile mosaic (no reference image, placement order doesn't matter) and a photomosaic (recreate a reference image using photo tiles, where the right image at the right position is critical). These should be cleanly separated.

## Design

### Two modes in MosaicPattern

**Regular mosaic** (no reference image configured): Uses `ImageBuffer` with shuffled URLs, buffer-based loading, `next()` to grab whatever's ready. No color matching. This is the existing code path with photomosaic logic removed.

**Photomosaic** (reference image configured + color cache available): Uses a new `PhotomosaicPlanner` that plans all tile placements upfront using the color cache, then streams in images one by one for rendering. `ImageBuffer` is not used.

**Fallback**: If photomosaic mode is configured but no color cache exists, fall back to the current `ImageBuffer` + `nextForPosition()` approach.

### PhotomosaicPlanner

New file: `src/patterns/photomosaic-planner.ts`

#### Inputs

- Color cache: `Map<url, { avgColor: RGB, domColor: RGB, width: number, height: number }>`
- Reference image canvas context, pixel dimensions
- Reference world bounds (fixed rectangle)
- Target tile area, tile margin
- Color match strategy ('average' | 'dominant' | 'hsv')
- Placement engine instance (shared with MosaicPattern)

#### Planning algorithm

Runs synchronously to completion before any image loading begins.

```
useCounts = Map<url, number>()
plan = []

while corner = engine.peekCorner():
  if corner (x, y) is outside referenceWorldBounds:
    engine.skipCorner()   // new method — pops corner without placing
    continue

  // Sample reference color at this position
  // Use square region with side = sqrt(targetArea) as estimate
  sampleSide = sqrt(targetArea)
  targetColor = sampleReferenceAt(ctx, ..., corner.x, corner.y, refBounds, sampleSide, sampleSide)

  // Search full cache for best match with reuse penalty
  bestUrl = null
  bestDist = Infinity
  for each (url, entry) in cache:
    color = strategy == 'dominant' ? entry.domColor : entry.avgColor
    baseDist = distFn(color, targetColor)
    penalty = (useCounts.get(url) ?? 0) * REUSE_PENALTY
    totalDist = baseDist + penalty
    if totalDist < bestDist:
      bestDist = totalDist
      bestUrl = url

  // Compute actual tile dimensions from cached width/height
  dims = computeTileDimensions(cache.get(bestUrl).width, cache.get(bestUrl).height, targetArea)

  // Place tile in engine with actual dimensions
  tile = engine.placeTile(dims.width + margin, dims.height + margin)
  if tile is null: break  // safety — shouldn't happen since we just peeked

  useCounts.set(bestUrl, (useCounts.get(bestUrl) ?? 0) + 1)
  plan.push({ tile, url: bestUrl, displayWidth: dims.width, displayHeight: dims.height, margin })

  if plan.length >= maxTiles: break  // safety cap
```

#### Reuse penalty

`REUSE_PENALTY ≈ 0.01 * MAX_COLOR_DIST` — approximately 1% of the color space per use. This allows duplicates when an image is genuinely the best match but discourages using the same image everywhere. The exact value will need tuning.

For `colorDistance` (weighted Euclidean with max ~765): `REUSE_PENALTY ≈ 7.65`
For `hsvDistance` (max ~4.0 with 3x hue weight): `REUSE_PENALTY ≈ 0.04`

#### Output

```typescript
interface PlannedTile {
  tile: PlacedTile;        // from placement engine
  url: string;             // image URL to load
  displayWidth: number;    // render dimensions (without margin)
  displayHeight: number;
  margin: number;
}
```

Array of `PlannedTile` in placement order.

### PlacementEngine: skipCorner()

Add to `PlacementEngine`:

```typescript
skipCorner(): void {
  if (this.freeCorners.length > 0) {
    this.freeCorners.splice(0, 1);
  }
}
```

Pops the highest-priority corner without placing a tile or generating new corners.

### End conditions

The plan phase ends when the corner queue is empty — all remaining corners are outside the reference bounds and have been skipped. `maxTiles` acts as a safety cap only.

During the render phase, the loop ends when the plan array is exhausted.

### MosaicPattern integration

```
startCycle():
  create tileContainer, engine (existing)

  if photomosaic mode:
    load color cache (existing, extended with width/height)
    load reference image (existing)

    if cache has entries with width/height:
      seed first tile (use square approx or pick first cache entry's dims)
      run PhotomosaicPlanner.plan() → PlannedTile[]
      start render loop: setInterval at placementSpeed
        each tick: shift one PlannedTile, load image, renderTile(), updateZoom()
        when plan empty: stopFilling()
    else:
      fall back to ImageBuffer + nextForPosition() (existing code)

  else:
    use ImageBuffer.next() (existing code, no color matching)
```

### Cache changes

#### ColorCacheEntry (types.ts)

Add `width` and `height` fields:

```typescript
export interface ColorCacheEntry {
    avgColor: string;
    domColor: string;
    mtime: number;
    size: number;
    width: number;     // natural pixel width
    height: number;    // natural pixel height
}
```

#### color-worker.ts

The worker already creates an `ImageBitmap` for each image. Add `bitmap.width` and `bitmap.height` to the result message:

```
Messages OUT:
  { type: 'result', rawPath, avgColor, domColor, width, height }
```

#### Cache compatibility

Old cache entries without width/height are treated as stale — they'll be re-computed on next bake. No cache version bump needed; the bake process already checks mtime/size and recomputes changed entries. Entries missing width/height can be detected and queued for re-computation.

### Zoom behavior

`updateZoom()` still runs each render tick. Even though the engine has all tiles placed from planning, zoom animates incrementally as tiles render so the user sees gradual reveal. The 0.5s CSS transition on the transform provides smooth zooming.

### File changes summary

| File | Change |
|------|--------|
| `src/patterns/photomosaic-planner.ts` | New file: `PhotomosaicPlanner` class |
| `src/patterns/placement-engine.ts` | Add `skipCorner()` method |
| `src/patterns/mosaic-pattern.ts` | Branch on cache availability: planner vs ImageBuffer; remove photomosaic logic from regular mosaic path |
| `src/configui/color-worker.ts` | Emit width/height in result messages |
| `src/types.ts` | Extend `ColorCacheEntry` with width/height |
| `src/configui/screensaver-settings.ts` | Store width/height when receiving worker results |
| `src/patterns/image-buffer.ts` | Unchanged (keeps existing behavior for regular mosaic + fallback) |

### Testing

- `PhotomosaicPlanner`: plan with known cache data, verify correct image selection, reuse penalty application, out-of-bounds corner skipping, end condition (queue empty)
- `PlacementEngine.skipCorner()`: verify corner is removed, no tile placed, no new corners generated
- Existing `ImageBuffer` and `PlacementEngine` tests unchanged
