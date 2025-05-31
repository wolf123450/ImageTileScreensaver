# Image Tile Screensaver

## Overview
The Image Tile Screensaver is an Electron-based application that displays a dynamic screensaver by tiling images across multiple screens in various patterns. This project aims to provide a visually appealing and customizable screensaver experience.

## Features
- Tiling of images across multiple displays
- Various customizable patterns for image arrangement
- Easy configuration for image sources and display settings

## Project Structure
```
imageTileScreensaver
├── src
│   ├── main.ts        # Main Electron process
│   ├── renderer.ts    # Renderer process for the screensaver visuals
│   ├── display.ts     # Display management logic
│   ├── patterns
│   │   └── index.ts   # Pattern generation algorithms
│   └── config.ts      # Configuration handling
├── assets
│   └── icons          # App icons
├── package.json       # npm configuration file
├── tsconfig.json      # TypeScript configuration file
├── electron-builder.json  # Packaging configuration for Windows executable
└── README.md          # Project documentation
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd image-tile-screensaver
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage
To run the screensaver, use the following command:
```
npm start
```

## Building
To package the application as a Windows executable, run:
```
npm run build
```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.