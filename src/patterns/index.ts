import { SimplePattern } from './simple-pattern';
import { GridPattern } from './grid-pattern';
import { MosaicPattern } from './mosaic-pattern';

// Core pattern interface
export interface Pattern {
  name: string;
  
  /**
   * Initialize the pattern with configuration settings
   */
  init(config: any): void;
  
  /**
   * Apply the pattern to a container element using the provided images
   */
  apply(container: HTMLElement, imageUrls: string[]): void;
  
  /**
   * Clean up any resources or timers used by the pattern
   */
  cleanup(): void;
}

// Export pattern implementations
export { SimplePattern } from './simple-pattern';
export { GridPattern } from './grid-pattern';
export { MosaicPattern } from './mosaic-pattern';