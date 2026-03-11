# Image Tile Screensaver - TODO List

> Last reviewed: 2026-03-10

This document tracks planned features, improvements, and technical debt. Items marked ✅ are complete, ⬜ are pending. Priority tiers indicate suggested implementation order.

---

## Milestone 1: Core MVP Polish

These items are needed to make the current Electron build production-ready.

### 1.1 Configuration & Persistence
- [x] Configuration dialog via `/c` argument (UI, window management, IPC, persistence, directory browser)
- [x] JSON config file read/write (`config.ts` with `loadConfig`/`saveConfig`)
- [ ] **CF-1:** Recursive/subdirectory image scanning (config flag exists but `getImageFiles` only reads top-level)
- [ ] **CF-2:** Proper error handling for missing/invalid image directories (user-facing toast notifications instead of `alert()`)
- [ ] **CF-3:** Validate and migrate saved config on schema changes (version field + merge strategy)

### 1.2 Screensaver Integration (Windows)
- [ ] **SCR-1:** Implement preview mode (`/p <HWND>`) — render into the Windows preview thumbnail
- [x] `.scr` file generation script (`create-screensaver.js`)
- [ ] **SCR-2:** Test config dialog when launched from Windows Screen Saver Settings panel
- [ ] **SCR-3:** Installer that copies screensaver files + registers `.scr` (NSIS or similar)

### 1.3 Patterns
- [x] Simple pattern (single image, timed rotation)
- [x] Grid pattern (configurable rows × cols, staggered refresh)
- [x] Mosaic pattern (density-based variable-size cells)
- [ ] **PAT-1:** Random pattern — images at random positions/sizes with optional overlap
- [ ] **PAT-2:** Sliding/carousel pattern — images that scroll across the screen
- [x] Pattern-specific options in config UI (grid size, mosaic density)

### 1.4 Settings UI
- [x] Tabbed config UI (General, Images, Patterns, Advanced)
- [x] Dark/light theme toggle with CSS custom properties
- [x] Image preview with pagination
- [x] Pattern visual selectors
- [ ] **UI-1:** Replace `alert()` messages with inline toast/snackbar notifications
- [ ] **UI-2:** Add "Reset to Defaults" button

---

## Milestone 2: Quality & Performance

### 2.1 Image Pipeline
- [ ] **IMG-1:** Image preloading — load next N images in background for smoother transitions
- [ ] **IMG-2:** Image caching layer (in-memory LRU cache to avoid re-reading disk)
- [ ] **IMG-3:** Lazy loading / virtual collection for directories with 10k+ images
- [ ] **IMG-4:** Image filtering (by date, type, size, aspect ratio)

### 2.2 Transitions
- [ ] **TR-1:** Fade transition (CSS opacity — partially implemented in patterns, needs formal API)
- [ ] **TR-2:** Slide transition
- [ ] **TR-3:** Zoom/Ken Burns transition
- [ ] **TR-4:** Configurable per-pattern transition settings

### 2.3 Performance
- [ ] **PERF-1:** Background image processing (Web Worker or offscreen canvas) to avoid UI thread blocking
- [ ] **PERF-2:** Memory profiling & optimization for large collections (release image DOM nodes aggressively)
- [ ] **PERF-3:** GPU-accelerated transitions via CSS `will-change` / `transform`

### 2.4 Multi-Monitor
- [ ] **MM-1:** Per-monitor pattern/settings configuration
- [ ] **MM-2:** Synchronized display mode across monitors
- [ ] **MM-3:** Monitor-spanning images (single image stretched across 2+ displays)
- [ ] **MM-4:** Dynamic monitor hotplug handling
- [ ] **MM-5:** Multi-monitor configuration UI (visual monitor layout editor)

---

## Milestone 3: Technical Debt & Code Quality

### 3.1 Architecture Fixes
- [ ] **TD-1:** Remove dead code in `display.ts` (unused `createWindow`, hardcoded `getAllDisplays` placeholder)
- [ ] **TD-2:** Unify config types — `ScreensaverConfig` (config.ts) vs `Config` (pattern-config.ts) vs `ConfigValues` (screensaver-settings.ts) should be one shared type
- [ ] **TD-3:** Fix webpack targets — main entry should use `electron-main`, preload should use `electron-preload` (currently all use `electron-renderer`)
- [ ] **TD-4:** Replace deprecated `url.format()` with `new URL()` / `pathToFileURL()`
- [ ] **TD-5:** Replace `promisify(fs.readdir/stat)` with `fs.promises` (already used elsewhere in same file)
- [ ] **TD-6:** Extract shared image-replacement logic from GridPattern and MosaicPattern into a base class or utility
- [ ] **TD-6b:** Clean up PatternFactory — remove unused `patterns` registry in `index.ts` (factory ignores it and creates instances via if/else); use the registry or replace with a simple map-based lookup

### 3.2 Security
- [ ] **SEC-1:** Remove `nodeIntegration: true` from screensaver BrowserWindow (use preload + contextIsolation like config window)
- [ ] **SEC-2:** Eliminate `any` types in IPC API (`getConfig`, `applyConfig`, `saveConfig` in preload.ts) — use shared `ScreensaverConfig` type

### 3.3 Typing & Linting
- [ ] **TD-7:** Add/restore `.eslintrc` config (lint script exists but config file is missing)
- [ ] **TD-8:** Replace all `any` types with proper interfaces throughout codebase
- [ ] **TD-9:** Move inline styles in patterns/renderer to CSS classes

### 3.4 Testing
- [ ] **TEST-1:** Unit tests for config load/save/merge
- [ ] **TEST-2:** Unit tests for pattern layout algorithms (especially mosaic cell placement)
- [ ] **TEST-3:** Integration test for screensaver command-line argument parsing
- [ ] **TEST-4:** E2E test for config dialog save → screensaver reads new config

### 3.5 Dependencies
- [ ] **DEP-1:** Update Electron from v26 to current LTS (v33+)
- [ ] **DEP-2:** Remove duplicate `dotenv` from both `dependencies` and `devDependencies`
- [x] Logging system implemented (Winston with file rotation)

---

## Milestone 4: Tauri Migration (Exploratory)

Switching from Electron to Tauri would significantly reduce binary size (~150MB → ~10MB) and memory footprint — both critical for a screensaver that runs in the background.

### Feasibility Assessment
- **Frontend**: HTML/CSS/JS can be reused almost entirely (Tauri uses system webview)
- **Backend**: All Node.js main-process code (main.ts, config.ts, logger.ts, image scanning) must be rewritten in Rust
- **IPC**: Electron IPC → Tauri commands/events (different API, same concept)
- **Preload**: Eliminated — Tauri uses `@tauri-apps/api` invoke from frontend
- **Multi-window**: Tauri supports multi-window; per-monitor fullscreen windows are possible
- **Screensaver .scr**: Tauri produces a single `.exe` — rename-to-`.scr` approach should work identically
- **Risk**: WebView2 runtime required on Windows (pre-installed on Win 10 21H2+ and Win 11; installer can bundle it)
- **Effort estimate**: Medium-large. ~60% of the codebase needs rewriting (all backend). Frontend is ~90% reusable.

### Migration Steps (if pursued)
- [ ] **TAURI-1:** Create Tauri project scaffold, verify multi-window + fullscreen on multiple monitors
- [ ] **TAURI-2:** Port config read/write to Rust (serde + JSON file)
- [ ] **TAURI-3:** Port image directory scanning to Rust (walkdir crate for recursive scanning)
- [ ] **TAURI-4:** Port IPC commands (get-images, get-config, save-config, browse-directory, etc.)
- [ ] **TAURI-5:** Port screensaver argument handling (`/s`, `/c`, `/p`) in Rust main
- [ ] **TAURI-6:** Port logging to Rust (tracing crate)
- [ ] **TAURI-7:** Adapt frontend JS to use `@tauri-apps/api` instead of `window.electronAPI`
- [ ] **TAURI-8:** Test `.scr` rename + Windows screensaver integration
- [ ] **TAURI-9:** Binary size and memory benchmarking vs Electron build

---

## Milestone 5: Nice-to-Have / Future

- [ ] **MISC-1:** EXIF metadata display overlay
- [ ] **MISC-2:** Online image sources (URLs, cloud storage)
- [ ] **MISC-3:** Slideshow mode with captions
- [ ] **MISC-4:** Screen blanking / energy saving timer
- [ ] **MISC-5:** Keyboard shortcuts for manual image navigation (in non-screensaver mode)
- [ ] **MISC-6:** Cross-platform screensaver packaging (macOS, Linux)
- [ ] **MISC-7:** Localization / i18n support
- [ ] **MISC-8:** Plugin system for custom patterns and transitions
- [ ] **MISC-9:** Auto-update mechanism
- [ ] **MISC-10:** End-user documentation / help pages
