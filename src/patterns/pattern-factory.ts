import { Pattern } from './index';
import { SimplePattern } from './simple-pattern';
import { GridPattern } from './grid-pattern';
import { MosaicPattern } from './mosaic-pattern';
import { RandomPattern } from './random-pattern';
import { SlidingPattern } from './sliding-pattern';

const patternConstructors: Record<string, () => Pattern> = {
  simple: () => new SimplePattern(),
  grid: () => new GridPattern(),
  mosaic: () => new MosaicPattern(),
  random: () => new RandomPattern(),
  sliding: () => new SlidingPattern(),
};

export class PatternFactory {
  static getPattern(name: string): Pattern {
    const create = patternConstructors[name];
    if (!create) {
      console.warn(`Pattern "${name}" not found, falling back to "simple"`);
      return new SimplePattern();
    }
    return create();
  }
}
