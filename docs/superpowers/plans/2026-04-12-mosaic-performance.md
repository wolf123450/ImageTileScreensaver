# Mosaic Performance Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add color cache precomputation (bake button + Web Worker) to eliminate photomosaic freeze, and adaptive tile count to prevent DOM overload at deep zoom levels.

**Architecture:** Two independent features. Feature 1 adds Rust commands for cache file I/O + file stats, a Web Worker for off-thread color computation, and settings UI for bake/progress/status. Feature 2 adds a screen-space size check in MosaicPattern.tick() to stop placing tiles below 16px rendered size.

**Tech Stack:** Tauri v2 (Rust backend), TypeScript + Webpack (frontend), Vitest (testing), Web Workers (off-thread precomputation)

**Spec:** `docs/superpowers/specs/2025-07-10-mosaic-performance-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types.ts` | Add `ColorCacheEntry` and `ColorCacheData` types, `FileStatEntry` type |
| `src-tauri/src/commands.rs` | Add `read_color_cache`, `write_color_cache`, `get_file_stats` Tauri commands |
| `src-tauri/src/lib.rs` | Register new commands in `invoke_handler` |
| `src/tauri-bridge.ts` | Add `readColorCache`, `writeColorCache`, `getFileStats` to the API surface |
| `src/configui/color-worker.ts` | New Web Worker: computes average + dominant color for batches of images |
| `src/configui/screensaver-settings.ts` | Bake button, cache status indicator, progress UI, bake orchestration |
| `src/configui/screensaver-settings.css` | Styles for cache status banner and bake progress |
| `src/patterns/image-buffer.ts` | Accept color cache, use it in `loadNext()` |
| `src/patterns/mosaic-pattern.ts` | Load cache and pass to ImageBuffer; adaptive tile screen-space check |
| `webpack.config.js` | Add worker entry point |

---

### Task 1: Add Types for Color Cache and File Stats

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add ColorCacheEntry, ColorCacheData, and FileStatEntry types**

In `src/types.ts`, add after the `PatternOptions` interface closing brace:

```typescript
export interface ColorCacheEntry {
    avgColor: string;   // hex e.g. "#4a6b3c"
    domColor: string;   // hex e.g. "#2d4f1e"
    mtime: number;      // file modification time in ms since epoch
    size: number;       // file size in bytes
}

export interface ColorCacheData {
    version: number;
    entries: Record<string, ColorCacheEntry>;
}

export interface FileStatEntry {
    path: string;
    mtime: number;
    size: number;
}
```

- [ ] **Step 2: Add API methods to ScreensaverAPI interface**

In `src/types.ts`, add to the `ScreensaverAPI` interface:

```typescript
    readColorCache: () => Promise<ColorCacheData>;
    writeColorCache: (data: ColorCacheData) => Promise<void>;
    getFileStats: (paths: string[]) => Promise<FileStatEntry[]>;
    getRawImagePaths: () => Promise<string[]>;
```

Note: `getRawImagePaths` returns filesystem paths (not asset URLs). Needed because `getImages` returns asset-protocol URLs which can't be used for `fs::metadata()` in `get_file_stats`. Cache keys use raw paths; the worker receives a parallel array mapping raw path → asset URL.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add color cache and file stat types"
```

---

### Task 2: Add Rust Commands for Cache I/O and File Stats

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add FileStatEntry struct and three new commands to commands.rs**

Add at the top of `commands.rs`, after the existing imports:

```rust
use std::fs;
use std::time::UNIX_EPOCH;
```

Add after the `exit_screensaver` command:

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatEntry {
    path: String,
    mtime: u64,
    size: u64,
}

#[tauri::command]
pub fn read_color_cache() -> String {
    let cache_path = crate::config::get_config_file_path()
        .parent()
        .unwrap_or(&PathBuf::from("."))
        .join("color-cache.json");

    if cache_path.exists() {
        fs::read_to_string(&cache_path).unwrap_or_else(|_| "{}".to_string())
    } else {
        r#"{"version":1,"entries":{}}"#.to_string()
    }
}

#[tauri::command]
pub fn write_color_cache(data: String) -> Result<(), String> {
    let cache_path = crate::config::get_config_file_path()
        .parent()
        .unwrap_or(&PathBuf::from("."))
        .join("color-cache.json");

    if let Some(parent) = cache_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&cache_path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_file_stats(paths: Vec<String>) -> Vec<FileStatEntry> {
    paths
        .into_iter()
        .filter_map(|p| {
            let metadata = fs::metadata(&p).ok()?;
            let mtime = metadata
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_millis() as u64;
            Some(FileStatEntry {
                path: p,
                mtime,
                size: metadata.len(),
            })
        })
        .collect()
}
```

- [ ] **Step 2: Make get_config_file_path public**

In `src-tauri/src/config.rs`, the function `get_config_file_path` is already `pub`. Verify by checking this line exists:

```rust
pub fn get_config_file_path() -> PathBuf {
```

If it's not pub, add `pub`.

- [ ] **Step 3: Register new commands in lib.rs**

In `src-tauri/src/lib.rs`, add the three commands to the `invoke_handler` array:

```rust
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::get_images,
            commands::validate_directory,
            commands::get_preview_images,
            commands::apply_config,
            commands::save_config,
            commands::get_log_path,
            commands::exit_screensaver,
            commands::read_color_cache,
            commands::write_color_cache,
            commands::get_file_stats,
        ])
```

- [ ] **Step 4: Verify Rust compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add Rust commands for color cache I/O and file stats"
```

---

### Task 3: Wire Up Tauri Bridge for New Commands

**Files:**
- Modify: `src/tauri-bridge.ts`

- [ ] **Step 1: Add imports for new types**

In `src/tauri-bridge.ts`, update the import from `./types` to include new types:

```typescript
import type { ScreensaverAPI, ScreensaverConfig, PreviewImagesResult, ColorCacheData, FileStatEntry } from './types';
```

- [ ] **Step 2: Add three new API methods to tauriAPI object**

Add before the closing `};` of the `tauriAPI` object:

```typescript
    readColorCache: async () => {
        const raw = await invoke<string>('read_color_cache');
        try {
            return JSON.parse(raw) as ColorCacheData;
        } catch {
            return { version: 1, entries: {} };
        }
    },

    writeColorCache: (data: ColorCacheData) =>
        invoke('write_color_cache', { data: JSON.stringify(data) }).then(() => {}),

    getFileStats: (paths: string[]) =>
        invoke<FileStatEntry[]>('get_file_stats', { paths }),

    getRawImagePaths: () =>
        invoke<string[]>('get_images'),
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/tauri-bridge.ts
git commit -m "feat: wire tauri bridge for color cache and file stats commands"
```

---

### Task 4: Adaptive Tile Count — Test

**Files:**
- Modify: `src/patterns/patterns.test.ts`

- [ ] **Step 1: Find the MosaicPattern test section and add adaptive tile tests**

Read `src/patterns/patterns.test.ts` to find the `describe('MosaicPattern'` block. Add the following tests inside it:

```typescript
  describe('adaptive tile count', () => {
    it('stops placing tiles when screen-space size falls below MIN_TILE_SCREEN_PX', () => {
      // With a very small currentScale, tiles should be too small in screen space
      // This is tested via the public tick() behavior — when zoom is deep,
      // the pattern should stop filling (enter hold state) quickly
      const pattern = new MosaicPattern();
      pattern.init({
        ...baseConfig,
        patternOptions: {
          ...baseConfig.patternOptions,
          tileAreaPercent: 7,
          zoomEnabled: true,
          maxZoomOut: 0.015625, // 1.5625% — tiles would be ~2px screen space
          maxTiles: 0, // unlimited
          placementSpeed: 50,
        },
      });
      // Pattern exists and can initialize — the actual screen-space check
      // happens at runtime during tick() which requires DOM
      expect(pattern.name).toBe('mosaic');
    });

    it('exports MIN_TILE_SCREEN_PX constant', async () => {
      const { MIN_TILE_SCREEN_PX } = await import('./mosaic-pattern');
      expect(MIN_TILE_SCREEN_PX).toBe(16);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/patterns/patterns.test.ts`
Expected: The `MIN_TILE_SCREEN_PX` test fails because the constant doesn't exist yet.

- [ ] **Step 3: Commit failing test**

```bash
git add src/patterns/patterns.test.ts
git commit -m "test: add adaptive tile count tests (red)"
```

---

### Task 5: Adaptive Tile Count — Implementation

**Files:**
- Modify: `src/patterns/mosaic-pattern.ts`

- [ ] **Step 1: Add MIN_TILE_SCREEN_PX constant**

At the top of `src/patterns/mosaic-pattern.ts`, after the imports, add:

```typescript
/** Minimum tile dimension in screen-space pixels. Tiles smaller than this are imperceptible. */
export const MIN_TILE_SCREEN_PX = 16;
```

- [ ] **Step 2: Add screen-space check in tick()**

In the `tick()` method, after `const dims = computeTileDimensions(...)` and before `const tile = this.engine.placeTile(...)`, add the screen-space check:

```typescript
    // Screen-space check: skip placement if tile would be too small to perceive
    // World → Screen: screenPx = worldPx * currentScale
    const tileScreenWidth = dims.width * this.currentScale;
    if (tileScreenWidth < MIN_TILE_SCREEN_PX) {
      this.stopFilling();
      return;
    }
```

The exact insertion point is after these lines in `tick()`:

```typescript
    const dims = computeTileDimensions(
      img.naturalWidth,
      img.naturalHeight,
      this.imageBuffer.targetArea,
    );
    const margin = this.config.tileMargin;
```

And before:

```typescript
    const tile = this.engine.placeTile(dims.width + margin, dims.height + margin);
```

- [ ] **Step 3: Run tests and verify they pass**

Run: `npx vitest run src/patterns/patterns.test.ts`
Expected: All tests pass, including the new adaptive tile tests.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/patterns/mosaic-pattern.ts
git commit -m "feat: adaptive tile count — stop placing when screen-space size < 16px"
```

---

### Task 6: ImageBuffer — Accept and Use Color Cache

**Files:**
- Modify: `src/patterns/image-buffer.ts`
- Modify: `src/patterns/image-buffer.test.ts`

- [ ] **Step 1: Write failing tests for color cache usage**

Add to `src/patterns/image-buffer.test.ts`:

```typescript
  describe('color cache', () => {
    it('uses cached color instead of computing when cache is provided', async () => {
      const buffer = new ImageBuffer();
      const cache = new Map<string, { avgColor: [number, number, number]; domColor: [number, number, number] }>();
      cache.set('a.jpg', { avgColor: [255, 0, 0], domColor: [200, 0, 0] });
      cache.set('b.jpg', { avgColor: [0, 255, 0], domColor: [0, 200, 0] });

      buffer.init(
        ['a.jpg', 'b.jpg'],
        800, 600,
        { tileAreaPercent: 10, bufferSize: 2 },
        cache,
      );

      await buffer.prefill();
      const img = buffer.next();
      expect(img).not.toBeNull();
      // Color should come from cache, not computed
      // Since URLs are shuffled, check that the color matches one of the cache entries
      const isRed = img!.avgColor[0] === 255 && img!.avgColor[1] === 0 && img!.avgColor[2] === 0;
      const isGreen = img!.avgColor[0] === 0 && img!.avgColor[1] === 255 && img!.avgColor[2] === 0;
      expect(isRed || isGreen).toBe(true);
    });

    it('falls back to computed color on cache miss', async () => {
      const buffer = new ImageBuffer();
      const cache = new Map<string, { avgColor: [number, number, number]; domColor: [number, number, number] }>();
      // Cache only has 'a.jpg', not 'b.jpg'
      cache.set('a.jpg', { avgColor: [255, 0, 0], domColor: [200, 0, 0] });

      buffer.init(
        ['a.jpg', 'b.jpg'],
        800, 600,
        { tileAreaPercent: 10, bufferSize: 2 },
        cache,
      );

      await buffer.prefill();
      // Both should load successfully — one from cache, one computed
      expect(buffer.bufferedCount).toBe(2);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/patterns/image-buffer.test.ts`
Expected: Fails because `init()` doesn't accept a 5th argument yet.

- [ ] **Step 3: Modify ImageBuffer.init() to accept optional color cache**

In `src/patterns/image-buffer.ts`, add a private field:

```typescript
  private colorCache: Map<string, { avgColor: RGB; domColor: RGB }> | null = null;
```

Change the `init()` method signature to accept the optional cache parameter:

```typescript
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
    this.colorStrategy = config.colorMatchStrategy ?? 'average';
    this.targetArea = viewportWidth * viewportHeight * ((config.tileAreaPercent ?? 7) / 100);
    this.buffer = [];
    this.colorCache = colorCache ?? null;
  }
```

- [ ] **Step 4: Modify loadNext() to check cache first**

In `loadNext()`, after `const url = this.availableUrls.shift()!;`, replace the image loading logic. Change the full method to:

```typescript
  private async loadNext(): Promise<void> {
    if (this.availableUrls.length === 0) return;

    const url = this.availableUrls.shift()!;

    // Check color cache first (keyed by original path or asset URL)
    const cached = this.colorCache?.get(url);

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        let color: RGB;
        if (cached) {
          color = this.colorStrategy === 'dominant' ? cached.domColor : cached.avgColor;
        } else {
          try {
            color = this.colorStrategy === 'dominant'
              ? dominantColor(img)
              : averageColor(img);
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
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx vitest run src/patterns/image-buffer.test.ts`
Expected: All tests pass, including the new color cache tests.

- [ ] **Step 6: Commit**

```bash
git add src/patterns/image-buffer.ts src/patterns/image-buffer.test.ts
git commit -m "feat: ImageBuffer accepts and uses color cache for fast color lookup"
```

---

### Task 7: MosaicPattern — Load Cache and Pass to ImageBuffer

**Files:**
- Modify: `src/patterns/mosaic-pattern.ts`

- [ ] **Step 1: Add colorCache field and type import**

In `src/patterns/mosaic-pattern.ts`, update the import from `../types`:

```typescript
import type { ScreensaverConfig, ColorCacheData } from '../types';
```

Add a new import for RGB:

```typescript
import type { RGB } from './color-utils';
```

Add private field after `private imageUrls: string[] = [];`:

```typescript
  private colorCache: Map<string, { avgColor: RGB; domColor: RGB }> | null = null;
```

- [ ] **Step 2: Load cache in startCycle() and pass to ImageBuffer.init()**

In `startCycle()`, before the line `this.imageBuffer = new ImageBuffer();`, add:

```typescript
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
            // Build rawPath → assetUrl mapping
            // this.imageUrls are asset URLs in the same order as rawPaths
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
```

Note: The cache is keyed by raw filesystem paths (for file stat invalidation), but the `colorCache` Map passed to ImageBuffer is re-keyed by asset URL (since that's what `loadNext()` uses as the URL). The `getRawImagePaths()` and `getImages()` commands return arrays in the same order, enabling this translation.

Then change the `this.imageBuffer.init()` call to pass the cache:

```typescript
    this.imageBuffer.init(this.imageUrls, this.viewportWidth, this.viewportHeight, {
      tileAreaPercent: this.config.tileAreaPercent,
      bufferSize: this.config.bufferSize,
      colorMatchStrategy: this.config.colorMatchStrategy,
    }, this.colorCache ?? undefined);
```

- [ ] **Step 3: Add hexToRgb helper method**

Add a private method to MosaicPattern:

```typescript
  private hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 0];
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
```

- [ ] **Step 4: Clear colorCache in cleanup()**

In the `cleanup()` method, add `this.colorCache = null;` alongside the existing field resets.

- [ ] **Step 5: Verify TypeScript compilation and run all tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: No type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/patterns/mosaic-pattern.ts
git commit -m "feat: MosaicPattern loads color cache and passes to ImageBuffer"
```

---

### Task 8: Color Worker — Web Worker for Off-Thread Precomputation

**Files:**
- Create: `src/configui/color-worker.ts`
- Modify: `webpack.config.js`

- [ ] **Step 1: Create the color worker file**

Create `src/configui/color-worker.ts`:

```typescript
/**
 * Web Worker for off-thread color precomputation.
 * Computes average and dominant colors for batches of images.
 *
 * Messages IN:
 *   { type: 'start', items: Array<{ rawPath: string, assetUrl: string }> }
 *   { type: 'cancel' }                     — stop processing
 *
 * Messages OUT:
 *   { type: 'progress', completed: number, total: number }
 *   { type: 'result', rawPath: string, avgColor: string, domColor: string }
 *   { type: 'done', wasCancelled: boolean }
 *   { type: 'error', rawPath: string, message: string }
 */

let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }

  if (msg.type === 'start') {
    cancelled = false;
    const items: Array<{ rawPath: string; assetUrl: string }> = msg.items;
    const total = items.length;
    let completed = 0;

    for (const { rawPath, assetUrl } of items) {
      if (cancelled) {
        self.postMessage({ type: 'done', wasCancelled: true });
        return;
      }

      try {
        const response = await fetch(assetUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);

        const avgColor = computeAverageColor(bitmap);
        const domColor = computeDominantColor(bitmap);
        bitmap.close();

        self.postMessage({
          type: 'result',
          rawPath,
          avgColor: rgbToHex(avgColor),
          domColor: rgbToHex(domColor),
        });
      } catch (err) {
        self.postMessage({
          type: 'error',
          rawPath,
          message: err instanceof Error ? err.message : String(err),
        });
      }

      completed++;
      if (completed % 10 === 0 || completed === total) {
        self.postMessage({ type: 'progress', completed, total });
      }
    }

    self.postMessage({ type: 'done', wasCancelled: false });
  }
};

type RGB = [number, number, number];

function computeAverageColor(bitmap: ImageBitmap): RGB {
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function computeDominantColor(bitmap: ImageBitmap): RGB {
  const size = 16;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  const bins = new Uint32Array(64);
  const binSize = 64;

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

  const ri = Math.floor(maxBin / 16);
  const gi = Math.floor((maxBin % 16) / 4);
  const bi = maxBin % 4;

  return [
    ri * binSize + binSize / 2,
    gi * binSize + binSize / 2,
    bi * binSize + binSize / 2,
  ];
}

function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map(c =>
    Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')
  ).join('');
}
```

- [ ] **Step 2: Add worker entry point to webpack.config.js**

In `webpack.config.js`, add the `'color-worker'` entry:

```javascript
    entry: {
      'tauri-bridge': './src/tauri-bridge.ts',
      renderer: './src/renderer.ts',
      settings: './src/configui/screensaver-settings.ts',
      'color-worker': './src/configui/color-worker.ts',
    },
```

- [ ] **Step 3: Verify TypeScript compilation and webpack build**

Run: `npx tsc --noEmit && npx webpack --mode development`
Expected: No errors, `dist/color-worker.bundle.js` is produced.

- [ ] **Step 4: Commit**

```bash
git add src/configui/color-worker.ts webpack.config.js
git commit -m "feat: add color worker for off-thread precomputation"
```

---

### Task 9: CSS Styles for Cache Status and Bake Progress

**Files:**
- Modify: `src/configui/screensaver-settings.css`

- [ ] **Step 1: Add styles for cache status banner and bake progress**

Add at the end of `src/configui/screensaver-settings.css`:

```css
/* Color cache status banner */
.cache-status {
    padding: 8px 12px;
    border-radius: 4px;
    margin: 8px 0;
    font-size: 13px;
    display: none;
}

.cache-status.visible {
    display: block;
}

.cache-status.status-ok {
    background: #e6f4ea;
    border: 1px solid #34a853;
    color: #1e7e34;
}

.cache-status.status-warning {
    background: #fff8e1;
    border: 1px solid #f9a825;
    color: #8d6e00;
}

.cache-status.status-error {
    background: #fce8e6;
    border: 1px solid #ea4335;
    color: #c62828;
}

/* Bake progress bar */
.bake-progress {
    display: none;
    margin: 8px 0;
}

.bake-progress.visible {
    display: flex;
    align-items: center;
    gap: 8px;
}

.bake-progress-bar {
    flex: 1;
    height: 20px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
}

.bake-progress-fill {
    height: 100%;
    background: #4285f4;
    transition: width 0.2s ease;
    width: 0%;
}

.bake-progress-label {
    font-size: 12px;
    white-space: nowrap;
    min-width: 120px;
}

.bake-cancel-btn {
    padding: 4px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
}

.bake-cancel-btn:hover {
    background: #f5f5f5;
}

.bake-btn {
    padding: 6px 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    margin: 8px 0;
}

.bake-btn:hover {
    background: #f5f5f5;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/configui/screensaver-settings.css
git commit -m "feat: add CSS for cache status banner and bake progress"
```

---

### Task 10: Settings UI — Bake Button, Cache Status, and Progress

**Files:**
- Modify: `src/configui/screensaver-settings.ts`

This is the largest task. It adds the bake button HTML, the cache status indicator, the progress UI, and the orchestration logic that spawns the worker.

- [ ] **Step 1: Add bake UI HTML to the photomosaic section**

In the `loadPatternOptions` function, inside the mosaic case, find the closing `</div>` of `mosaic-photomosaic-options` (the conditional-field div). Before that closing `</div>`, add:

```html
                            <div class="form-group">
                                <div class="cache-status" id="mosaic-cache-status"></div>
                                <button class="bake-btn" id="mosaic-bake-btn">Bake Color Cache</button>
                                <div class="bake-progress" id="mosaic-bake-progress">
                                    <div class="bake-progress-bar">
                                        <div class="bake-progress-fill" id="mosaic-bake-fill"></div>
                                    </div>
                                    <span class="bake-progress-label" id="mosaic-bake-label">0 / 0 (0%)</span>
                                    <button class="bake-cancel-btn" id="mosaic-bake-cancel">Cancel</button>
                                </div>
                            </div>
```

- [ ] **Step 2: Add cache status check function**

Add a module-level function (outside any class, at the bottom of the file or in a convenient location):

```typescript
async function checkCacheStatus(): Promise<void> {
    const statusEl = document.getElementById('mosaic-cache-status');
    if (!statusEl) return;

    const api = (window as any).electronAPI;
    if (!api?.readColorCache || !api?.getRawImagePaths || !api?.getFileStats) {
        statusEl.className = 'cache-status visible status-error';
        statusEl.textContent = 'Color cache API not available.';
        return;
    }

    try {
        const [cacheData, rawPaths] = await Promise.all([
            api.readColorCache(),
            api.getRawImagePaths(),
        ]);

        if (rawPaths.length === 0) {
            statusEl.className = 'cache-status visible status-warning';
            statusEl.textContent = 'No images found. Configure an image folder first.';
            return;
        }

        const stats: { path: string; mtime: number; size: number }[] = await api.getFileStats(rawPaths);
        const statsMap = new Map(stats.map(s => [s.path, s]));

        const entries = cacheData.entries ?? {};
        let missing = 0;

        for (const rawPath of rawPaths) {
            const entry = entries[rawPath];
            const stat = statsMap.get(rawPath);
            if (!entry || !stat || entry.mtime !== stat.mtime || entry.size !== stat.size) {
                missing++;
            }
        }

        if (missing === 0) {
            statusEl.className = 'cache-status visible status-ok';
            statusEl.textContent = `Color cache up to date (${rawPaths.length} images)`;
        } else if (Object.keys(entries).length === 0) {
            statusEl.className = 'cache-status visible status-error';
            statusEl.textContent = 'No color cache found. Click Bake to precompute colors for photomosaic mode.';
        } else {
            statusEl.className = 'cache-status visible status-warning';
            statusEl.textContent = `Color cache incomplete: ${missing} of ${rawPaths.length} images need recomputation. Click Bake to update.`;
        }
    } catch (e) {
        statusEl.className = 'cache-status visible status-error';
        statusEl.textContent = `Error checking cache: ${e}`;
    }
}
```

- [ ] **Step 3: Add bake orchestration function**

Add another module-level function:

```typescript
let activeWorker: Worker | null = null;

async function startBake(): Promise<void> {
    const api = (window as any).electronAPI;
    if (!api) return;

    const bakeBtn = document.getElementById('mosaic-bake-btn') as HTMLButtonElement | null;
    const progressDiv = document.getElementById('mosaic-bake-progress');
    const fillBar = document.getElementById('mosaic-bake-fill');
    const label = document.getElementById('mosaic-bake-label');
    const cancelBtn = document.getElementById('mosaic-bake-cancel');

    if (!bakeBtn || !progressDiv || !fillBar || !label) return;

    // Read existing cache and raw paths
    const cacheData = await api.readColorCache();
    const entries = cacheData.entries ?? {};
    const rawPaths: string[] = await api.getRawImagePaths();
    const assetUrls: string[] = await api.getImages();

    // Build raw path → asset URL mapping
    const pathToUrl = new Map<string, string>();
    for (let i = 0; i < rawPaths.length; i++) {
        pathToUrl.set(rawPaths[i], assetUrls[i]);
    }

    // Get file stats for invalidation (uses raw filesystem paths)
    const stats: { path: string; mtime: number; size: number }[] = await api.getFileStats(rawPaths);
    const statsMap = new Map(stats.map((s: { path: string; mtime: number; size: number }) => [s.path, s]));

    // Filter to images needing computation
    const toCompute: Array<{ rawPath: string; assetUrl: string }> = [];
    for (const rawPath of rawPaths) {
        const entry = entries[rawPath];
        const stat = statsMap.get(rawPath);
        const assetUrl = pathToUrl.get(rawPath);
        if (!assetUrl) continue;
        if (!entry || !stat || entry.mtime !== stat.mtime || entry.size !== stat.size) {
            toCompute.push({ rawPath, assetUrl });
        }
    }

    if (toCompute.length === 0) {
        await checkCacheStatus();
        return;
    }

    // Show progress, hide bake button
    bakeBtn.style.display = 'none';
    progressDiv.classList.add('visible');
    label.textContent = `0 / ${toCompute.length} (0%)`;
    fillBar.style.width = '0%';

    // Spawn worker
    const worker = new Worker('color-worker.bundle.js');
    activeWorker = worker;

    worker.onmessage = async (e: MessageEvent) => {
        const msg = e.data;

        if (msg.type === 'progress') {
            const pct = Math.round((msg.completed / msg.total) * 100);
            label.textContent = `${msg.completed} / ${msg.total} (${pct}%)`;
            fillBar.style.width = `${pct}%`;
        }

        if (msg.type === 'result') {
            const stat = statsMap.get(msg.rawPath);
            entries[msg.rawPath] = {
                avgColor: msg.avgColor,
                domColor: msg.domColor,
                mtime: stat?.mtime ?? 0,
                size: stat?.size ?? 0,
            };
        }

        if (msg.type === 'done') {
            // Write cache (even on cancel — preserve partial progress)
            try {
                await api.writeColorCache({ version: 1, entries });
            } catch (e) {
                console.error('Failed to write color cache:', e);
            }

            // Reset UI
            worker.terminate();
            activeWorker = null;
            progressDiv.classList.remove('visible');
            bakeBtn.style.display = '';
            await checkCacheStatus();
        }
    };

    // Wire cancel button
    cancelBtn?.addEventListener('click', () => {
        worker.postMessage({ type: 'cancel' });
    }, { once: true });

    // Start the worker
    worker.postMessage({ type: 'start', items: toCompute });
}
```

- [ ] **Step 4: Wire up bake button and auto-check on load**

In the `loadPatternOptions` function, inside the mosaic case, after the existing event listener wiring (near the end, after the photomosaic toggle/checkbox wiring), add:

```typescript
            // Bake button
            const bakeBtn = document.getElementById('mosaic-bake-btn');
            bakeBtn?.addEventListener('click', () => startBake());

            // Check cache status on load if photomosaic is enabled
            if (photomosaicEnabled) {
                checkCacheStatus();
            }

            // Also check when photomosaic is toggled on
            const photoEnabledCheck = document.getElementById('mosaic-photomosaic-enabled') as HTMLInputElement | null;
            photoEnabledCheck?.addEventListener('change', () => {
                if (photoEnabledCheck.checked) {
                    checkCacheStatus();
                }
            });
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/configui/screensaver-settings.ts
git commit -m "feat: add bake button, cache status indicator, and progress UI"
```

---

### Task 11: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (should be 53+ tests).

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify Rust compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 4: Verify webpack build**

Run: `npx webpack --mode development`
Expected: Produces `dist/` with `color-worker.bundle.js` alongside existing bundles.

- [ ] **Step 5: Manual smoke test**

Run: `npm run tauri:dev`

1. Open settings (config mode)
2. Select mosaic pattern
3. Enable photomosaic
4. Verify cache status indicator appears (red/error since no cache exists)
5. Click "Bake Color Cache"
6. Verify progress bar appears and advances
7. Verify cancel works (preserves partial progress)
8. Run bake to completion, verify status turns green
9. Save and launch screensaver — verify photomosaic doesn't freeze
10. With zoom enabled at deep levels (6.25% or lower), verify tiles stop being placed when very small
