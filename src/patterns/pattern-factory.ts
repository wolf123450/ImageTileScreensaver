import { Pattern, patterns } from './index';
import { SimplePattern } from './simple-pattern';
import { GridPattern } from './grid-pattern';
import { MosaicPattern } from './mosaic-pattern';

/**
 * Factory for creating pattern instances
 */
export class PatternFactory {
  /**
   * Get a pattern by name
   * @param name The name of the pattern to get
   * @returns A new instance of the requested pattern
   */
  static getPattern(name: string): Pattern {
    if (!patterns[name]) {
      console.warn(`Pattern ${name} not found, falling back to 'simple'`);
      return new SimplePattern();
    }
    
    // Create a new instance of the pattern to avoid shared state
    if (name === 'simple') return new SimplePattern();
    if (name === 'grid') return new GridPattern();
    if (name === 'mosaic') return new MosaicPattern();
    
    // Fallback
    return new SimplePattern();
  }
}
