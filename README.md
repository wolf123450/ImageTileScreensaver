# Image Tile Screensaver

A customizable screensaver application that displays images in a tile pattern.

## Features

- Display images from a specified directory
- Support for multiple display configurations
- Configurable image transition timings
- Various tiling patterns

## Development

### Prerequisites

- Node.js (v14+)
- npm

### Setup

1. Clone this repository
2. Install dependencies:

   ```
   npm install
   ```

3. Run the development version:

   ```
   npm start
   ```

### Building

To create an executable:

```
npm run dist
```

## Configuration

The screensaver can be configured by editing the config file or through the configuration UI (coming soon).

## Command Line Options

- `--dir [path]`: Specify the directory containing images
- `/s`: Run the screensaver (Windows compatibility)
- `/c`: Show the configuration dialog (Windows compatibility)
- `/p`: Preview mode (Windows compatibility)