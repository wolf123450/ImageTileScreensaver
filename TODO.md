# Image Tile Screensaver - TODO List

> Last reviewed: 2026-04-11

This document tracks planned features, improvements, and technical debt. Items marked ✅ are complete, ⬜ are pending. Priority tiers indicate suggested implementation order.

---

## Milestone 1: Core MVP Polish

These items are needed to make the Tauri build production-ready.

### 1.1 Configuration & Persistence
- [x] Configuration dialog via `/c` argument (UI, window management, IPC, persistence, directory browser)
- [x] JSON config file read/write (`config.ts` with `loadConfig`/`saveConfig`)
- [x] **CF-1:** Recursive/subdirectory image scanning (implemented in Rust via `walkdir` crate)
- [x] **CF-2:** Proper error handling for missing/invalid image directories (user-facing toast notifications replace `alert()`)
- [x] **CF-3:** Validate and migrate saved config on schema changes (version field + merge strategy)

### 1.2 Screensaver Integration (Windows)
- [ ] **SCR-1:** Implement preview mode (`/p <HWND>`) — render into the Windows preview thumbnail
- [x] `.scr` file generation script (`create-screensaver.js`)
- [ ] **SCR-2:** Test config dialog when launched from Windows Screen Saver Settings panel
- [ ] **SCR-3:** Installer that copies screensaver files + registers `.scr` (NSIS or similar)

### 1.3 Patterns
- [x] Simple pattern (single image, timed rotation)
- [x] Grid pattern (configurable rows × cols, staggered refresh)
- [x] Mosaic pattern (density-based variable-size cells)
- [x] **PAT-1:** Random pattern — images at random positions/sizes with optional overlap
- [x] **PAT-2:** Sliding/carousel pattern — images that scroll across the screen
- [x] Pattern-specific options in config UI (grid size, mosaic density)

### 1.4 Settings UI
- [x] Tabbed config UI (General, Images, Patterns, Advanced)
- [x] Dark/light theme toggle with CSS custom properties
- [x] Image preview with pagination
- [x] Pattern visual selectors
- [x] **UI-1:** Replace `alert()` messages with inline toast/snackbar notifications
- [x] **UI-2:** Add "Reset to Defaults" button

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
- [x] **TD-1:** ~~Remove dead code in `display.ts`~~ — removed with Electron code during Tauri migration
- [x] **TD-2:** Unify config types — settings UI now uses shared `ScreensaverConfig` directly
- [x] **TD-3:** ~~Fix webpack targets~~ — now targets `web` for Tauri
- [x] **TD-4:** ~~Replace deprecated `url.format()`~~ — removed with Electron code
- [x] **TD-5:** ~~Replace `promisify(fs.readdir/stat)`~~ — removed with Electron code (Rust handles file I/O)
- [x] **TD-6:** Extract shared image-replacement logic — implemented in `image-utils.ts`
- [x] **TD-6b:** Clean up PatternFactory — now uses clean map-based registry lookup

### 3.2 Security
- [x] **SEC-1:** Remove `nodeIntegration: true` from screensaver BrowserWindow (use preload + contextIsolation like config window)
- [x] **SEC-2:** ~~Eliminate `any` types in IPC API~~ — Tauri bridge (`tauri-bridge.ts`) uses typed `ScreensaverAPI` interface

### 3.3 Typing & Linting
- [ ] **TD-7:** Add/restore `.eslintrc` config (lint script exists but config file is missing)
- [ ] **TD-8:** Replace all `any` types with proper interfaces throughout codebase
- [ ] **TD-9:** Move inline styles in patterns/renderer to CSS classes

### 3.4 Testing
- [ ] **TEST-1:** Unit tests for config load/save/merge
- [x] **TEST-2:** Unit tests for pattern layout algorithms (including expanded mosaic + random/sliding coverage)
- [x] **TEST-3:** Integration test for screensaver command-line argument parsing
- [x] **TEST-4:** E2E test added for config dialog save → renderer consumes saved config (Playwright spec in `e2e/`)

### 3.5 Dependencies
- [x] **DEP-1:** ~~Update Electron~~ — N/A, migrated to Tauri
- [x] **DEP-2:** ~~Remove duplicate `dotenv`~~ — removed during Tauri migration (no longer needed)
- [x] Logging system implemented (Winston with file rotation)

---

## Milestone 4: Tauri Migration

Binary size reduction confirmed: **158 MB (Electron exe) → 10 MB (Tauri exe)**, installer **240 MB → 2.4 MB**.

### Completed
- [x] **TAURI-1:** Tauri v2 project scaffolded with multi-window + fullscreen support
- [x] **TAURI-2:** Config read/write ported to Rust (serde + JSON, `dirs` crate for app data path)
- [x] **TAURI-3:** Image directory scanning ported to Rust (`walkdir` crate, supports recursive)
- [x] **TAURI-4:** All IPC commands ported (get-images, get-config, save-config, validate-directory, browse-directory, get-preview-images, get-log-path)
- [x] **TAURI-5:** Screensaver argument handling (`/s`, `/c`, `/p`) ported to Rust main
- [x] **TAURI-6:** Logging ported to Rust (tauri-plugin-log)
- [x] **TAURI-7:** Frontend adapter (`tauri-bridge.ts`) shims `window.electronAPI` via Tauri invoke — existing renderer/settings code works unchanged
- [x] **TAURI-9:** Binary size benchmarked — 10 MB exe, 2.4 MB installer

### Remaining
- [ ] **TAURI-8:** Test `.scr` rename + Windows screensaver integration
- [x] **TAURI-10:** Image file paths converted to Tauri asset protocol URLs via `convertFileSrc()` in `tauri-bridge.ts`
- [x] **TAURI-11:** Electron-specific code removed (main.ts, preload.ts, display.ts, electron-builder.json all deleted)

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
