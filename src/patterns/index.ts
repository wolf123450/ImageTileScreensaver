// Basic pattern generator for the screensaver

import { DisplayInfo } from '../display';

// Pattern interface for generating image layouts
export interface Pattern {
  name: string;
  generateLayout(displays: DisplayInfo[], imageUrls: string[]): ImageLayout[];
}

// Describes how an image should be positioned
export interface ImageLayout {
  imageUrl: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Grid pattern configuration
export interface GridPatternConfig {
  rows: number;
  cols: number;
  spacing?: number; // Optional spacing between grid cells in pixels
}

// Simple pattern that just places one image centered on each display
export const simplePattern: Pattern = {
  name: 'simple',
  generateLayout(displays: DisplayInfo[], imageUrls: string[]): ImageLayout[] {
    const layouts: ImageLayout[] = [];
    
    displays.forEach((display, index) => {
      // Use modulo to cycle through available images if there are fewer images than displays
      const imageIndex = index % imageUrls.length;
      
      layouts.push({
        imageUrl: imageUrls[imageIndex],
        position: {
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height
        }
      });
    });
    
    return layouts;
  }
};

// Grid pattern that arranges images in a grid layout
export const gridPattern: Pattern = {
  name: 'grid',
  generateLayout(displays: DisplayInfo[], imageUrls: string[], config?: GridPatternConfig): ImageLayout[] {
    const layouts: ImageLayout[] = [];
    
    // Default grid configuration if not provided
    const gridConfig: GridPatternConfig = config || { rows: 2, cols: 3, spacing: 10 };
    
    displays.forEach((display) => {
      const { x, y, width, height } = display.bounds;
      
      // Calculate cell dimensions
      const cellSpacing = gridConfig.spacing || 0;
      const cellWidth = (width - (cellSpacing * (gridConfig.cols - 1))) / gridConfig.cols;
      const cellHeight = (height - (cellSpacing * (gridConfig.rows - 1))) / gridConfig.rows;
      
      // Generate grid cells
      for (let row = 0; row < gridConfig.rows; row++) {
        for (let col = 0; col < gridConfig.cols; col++) {
          // Calculate image index, cycling through available images
          const cellIndex = row * gridConfig.cols + col;
          const imageIndex = cellIndex % imageUrls.length;
          
          // Calculate cell position
          const cellX = x + col * (cellWidth + cellSpacing);
          const cellY = y + row * (cellHeight + cellSpacing);
          
          // Add to layouts
          layouts.push({
            imageUrl: imageUrls[imageIndex],
            position: {
              x: cellX,
              y: cellY,
              width: cellWidth,
              height: cellHeight
            }
          });
        }
      }
    });
    
    return layouts;
  }
};

// Export available patterns
export const patterns: Record<string, Pattern> = {
  simple: simplePattern,
  grid: gridPattern
};