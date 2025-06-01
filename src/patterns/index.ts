import { DisplayInfo } from '../display';
import { SimplePattern } from './simple-pattern';
import { GridPattern } from './grid-pattern';

// Core pattern interface
export interface Pattern {
  name: string;
  
  /**
   * Initialize the pattern with configuration settings
   * @param config Configuration object for the pattern
   */
  init(config: any): void;
  
  /**
   * Apply the pattern to a container element using the provided images
   * @param container The DOM element to apply the pattern to
   * @param imageUrls Array of image URLs to use
   * @param displayInfo Optional display information
   */
  apply(container: HTMLElement, imageUrls: string[], displayInfo?: DisplayInfo): void;
  
  /**
   * Clean up any resources or timers used by the pattern
   */
  cleanup(): void;
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

// Export pattern implementations
export { SimplePattern } from './simple-pattern';
export { GridPattern } from './grid-pattern';

// Create a registry of available patterns
export const patterns: Record<string, Pattern> = {
  simple: new SimplePattern(),
  grid: new GridPattern()
};