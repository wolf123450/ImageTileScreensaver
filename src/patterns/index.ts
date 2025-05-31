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

// Export available patterns
export const patterns: Record<string, Pattern> = {
  simple: simplePattern
};