# Image Tile Screensaver

A customizable Windows screensaver built with Tauri v2 and TypeScript that displays images across multiple monitors. Binary size: ~10 MB (exe), ~2.4 MB (installer).

## Features

- Display images from local directories across multiple monitors
- Support for various display patterns: Simple, Grid, Mosaic, Random, Sliding
- Smooth transitions between images with configurable intervals
- Windows screensaver integration with command-line argument support (`/s`, `/c`, `/p`)
- Configuration UI with tabs for general settings, image selection, patterns, and advanced options
- Low CPU and memory footprint for efficient background operation
- Support for various image formats (JPG, PNG, WebP, GIF, BMP)
- Multiple monitor support with independent or synchronized displays
- Recursive image directory scanning
- Light/dark theme configuration

## Development

### Prerequisites

- Node.js (v18+)
- Rust toolchain (for Tauri backend)
- npm

### Setup

1. Clone the repository

   ```bash
   git clone https://github.com/yourusername/ImageTileScreensaver.git
   cd ImageTileScreensaver
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Start the Tauri development server

   ```bash
   npm run tauri:dev
   ```

4. Open config dialog in development

   ```bash
   npm run tauri:dev:config
   ```

### Project Structure

- `src/` - Frontend TypeScript code
  - `src/renderer.ts` - Main screensaver display rendering
  - `src/tauri-bridge.ts` - IPC adapter (Tauri invoke → `window.electronAPI` shim)
  - `src/types.ts` - Shared TypeScript type definitions
  - `src/patterns/` - Image layout pattern implementations
  - `src/configui/` - Configuration UI (settings dialog)
- `src-tauri/` - Tauri backend (Rust)
  - `src-tauri/src/lib.rs` - App builder, multi-window screensaver setup
  - `src-tauri/src/config.rs` - Config struct, JSON persistence
  - `src-tauri/src/images.rs` - Image directory scanning
  - `src-tauri/src/commands.rs` - IPC command handlers

### Building

Development build (webpack):

```bash
npm run build
```

Production Tauri build:

```bash
npm run tauri:build
```

### Testing

```bash
npm test              # Run unit tests (vitest)
npm run test:watch    # Watch mode
```

## Configuration

The screensaver can be configured through:

- Configuration dialog (via `/c` argument or Windows Screen Saver Settings)
- JSON config file at `~/.config/ImageTileScreensaver/config.json`

### Settings Options

- Image source directories (with recursive subdirectory support)
- Change interval for images
- Display pattern selection (Simple, Grid, Mosaic, Random, Sliding)
- Image fit style (cover, contain, fill)
- Transition effects and timing
- Multi-monitor sync mode
- Light/dark theme

## Windows Screensaver Integration

This application supports standard Windows screensaver command line arguments:

- `/s` - Run as screensaver (fullscreen on all monitors)
- `/c` - Show configuration dialog
- `/p <HWND>` - Preview mode (render into Windows preview thumbnail)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- Additional pattern generators for more dynamic displays
- Transition effects library
- Performance optimizations for large image collections
- Remote image source support