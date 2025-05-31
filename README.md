# Image Tile Screensaver

A customizable screensaver application built with Electron and TypeScript that displays images across multiple monitors. It functions both as a standard Windows screensaver and as a cross-platform application.

## Features

- Display images from local directories across multiple monitors
- Support for various display patterns and layouts
- Smooth transitions between images with configurable intervals
- Proper Windows screensaver integration with command-line argument support
- Configuration UI with tabs for general settings, image selection, patterns, and advanced options
- Low CPU and memory footprint for efficient background operation
- Support for various image formats (JPG, PNG, WebP, GIF, BMP)
- Multiple monitor support with independent or synchronized displays
- Cross-platform support (primary focus on Windows for screensaver functionality)

## Development

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- Electron knowledge for screensaver development

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

3. Start the development server

   ```bash
   npm start
   ```

### Project Structure

- `src/` - Core application code including main and renderer processes
- `src/patterns/` - Image layout pattern generators
- `src/config.ts` - Configuration management
- `src/display.ts` - Display and monitor management
- `src/main.ts` - Electron main process
- `src/preload.ts` - Preload script for secure renderer/main process communication
- `src/renderer.ts` - Renderer process for the UI
- `src/configui/` - Configuration UI components and logic

### Building

To build the application:

```bash
npm run build
```

For Windows screensaver deployment:

```bash
npm run build:screensaver
```

This will generate an `.scr` file in the `dist` directory that can be installed as a Windows screensaver.

## Configuration

The screensaver can be configured through:

- Command line arguments for specifying image directories
- Configuration dialog (accessible through screensaver settings in Windows)
- Configuration file for advanced settings

### Settings Options

- Image source directories
- Change interval for images
- Display pattern selection
- Transition effects and timing
- Per-monitor display settings

## Windows Screensaver Integration

This application supports standard Windows screensaver command line arguments:

- `/s` - Run as screensaver
- `/c` - Show configuration dialog
- `/p <HWND>` - Preview mode (to be implemented)

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