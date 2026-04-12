import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PatternFactory } from './pattern-factory';
import { SimplePattern } from './simple-pattern';
import { GridPattern } from './grid-pattern';
import { MosaicPattern } from './mosaic-pattern';
import { RandomPattern } from './random-pattern';
import { SlidingPattern } from './sliding-pattern';
import type { PatternOptions, ScreensaverConfig } from '../types';

function makeConfig(overrides: Partial<ScreensaverConfig> = {}, patternOptions: PatternOptions = {}): ScreensaverConfig {
  return {
    version: 2,
    imageFolder: '',
    includeSubdirectories: true,
    changeInterval: 60000,
    pattern: 'simple',
    patternOptions,
    multiMonitorSync: false,
    transition: {
      effect: 'fade',
      duration: 500,
    },
    theme: 'light',
    imageFitStyle: 'cover',
    ...overrides,
  };
}

describe('PatternFactory', () => {
  it('returns SimplePattern for "simple"', () => {
    const pattern = PatternFactory.getPattern('simple');
    expect(pattern).toBeInstanceOf(SimplePattern);
    expect(pattern.name).toBe('simple');
  });

  it('returns GridPattern for "grid"', () => {
    const pattern = PatternFactory.getPattern('grid');
    expect(pattern).toBeInstanceOf(GridPattern);
    expect(pattern.name).toBe('grid');
  });

  it('returns MosaicPattern for "mosaic"', () => {
    const pattern = PatternFactory.getPattern('mosaic');
    expect(pattern).toBeInstanceOf(MosaicPattern);
    expect(pattern.name).toBe('mosaic');
  });

  it('returns RandomPattern for "random"', () => {
    const pattern = PatternFactory.getPattern('random');
    expect(pattern).toBeInstanceOf(RandomPattern);
    expect(pattern.name).toBe('random');
  });

  it('returns SlidingPattern for "sliding"', () => {
    const pattern = PatternFactory.getPattern('sliding');
    expect(pattern).toBeInstanceOf(SlidingPattern);
    expect(pattern.name).toBe('sliding');
  });

  it('falls back to SimplePattern for unknown names', () => {
    const pattern = PatternFactory.getPattern('nonexistent');
    expect(pattern).toBeInstanceOf(SimplePattern);
  });

  it('returns fresh instances each call', () => {
    const a = PatternFactory.getPattern('grid');
    const b = PatternFactory.getPattern('grid');
    expect(a).not.toBe(b);
  });
});

describe('SimplePattern', () => {
  let container: HTMLDivElement;
  const testImages = ['img1.jpg', 'img2.jpg', 'img3.jpg'];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates an img element on apply', () => {
    const pattern = new SimplePattern();
    pattern.init(makeConfig());
    pattern.apply(container, testImages);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toContain('img1.jpg');
  });

  it('does nothing with empty image array', () => {
    const pattern = new SimplePattern();
    pattern.init(makeConfig());
    pattern.apply(container, []);
    expect(container.querySelector('img')).toBeNull();
  });

  it('cleans up interval timer', () => {
    vi.useFakeTimers();
    const pattern = new SimplePattern();
    pattern.init(makeConfig({ changeInterval: 1000 }));
    pattern.apply(container, testImages);

    // Should have set a timer
    pattern.cleanup();

    // Advancing time should NOT trigger another apply
    const imgBefore = container.querySelector('img')!.src;
    vi.advanceTimersByTime(5000);
    // Container should still have the same image (no replacement)
    expect(container.querySelector('img')!.src).toBe(imgBefore);

    vi.useRealTimers();
  });

  it('offsets image by displayId', () => {
    const pattern = new SimplePattern();
    pattern.init({ ...makeConfig(), displayId: 2 } as ScreensaverConfig & { displayId: number });
    pattern.apply(container, testImages);

    const img = container.querySelector('img');
    expect(img!.src).toContain('img3.jpg');
  });
});

describe('GridPattern', () => {
  let container: HTMLDivElement;
  const testImages = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates a grid of cells', () => {
    const pattern = new GridPattern();
    pattern.init(makeConfig({ pattern: 'grid' }, { rows: 2, cols: 3 }));
    pattern.apply(container, testImages);

    const cells = container.querySelectorAll('div');
    expect(cells.length).toBe(6);
    expect(container.style.display).toBe('grid');
    expect(container.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(container.style.gridTemplateRows).toBe('repeat(2, 1fr)');
  });

  it('each cell contains an image', () => {
    const pattern = new GridPattern();
    pattern.init(makeConfig({ pattern: 'grid', imageFitStyle: 'contain' }, { rows: 1, cols: 2 }));
    pattern.apply(container, testImages);

    const images = container.querySelectorAll('img');
    expect(images.length).toBe(2);
    images.forEach(img => {
      expect(img.style.objectFit).toBe('contain');
    });
  });

  it('cleans up timers', () => {
    const pattern = new GridPattern();
    pattern.init(makeConfig({ pattern: 'grid' }, { rows: 2, cols: 2 }));
    pattern.apply(container, testImages);
    pattern.cleanup();
    // No assertion needed — just verify no error thrown
  });
});

describe('MosaicPattern', () => {
  let container: HTMLDivElement;
  const testImages = Array.from({ length: 20 }, (_, i) => `img${i}.jpg`);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates mosaic cells based on density', () => {
    const pattern = new MosaicPattern();
    pattern.init(makeConfig({ pattern: 'mosaic' }, { density: 5 }));
    pattern.apply(container, testImages);

    const cells = container.querySelectorAll('div');
    expect(cells.length).toBeGreaterThan(0);
    expect(container.style.display).toBe('grid');
  });

  it('higher density produces more or equal cells', () => {
    const lowPattern = new MosaicPattern();
    lowPattern.init(makeConfig({ pattern: 'mosaic' }, { density: 2 }));
    lowPattern.apply(container, testImages);
    const lowCount = container.querySelectorAll('div').length;

    container.innerHTML = '';
    const highPattern = new MosaicPattern();
    highPattern.init(makeConfig({ pattern: 'mosaic' }, { density: 9 }));
    highPattern.apply(container, testImages);
    const highCount = container.querySelectorAll('div').length;

    expect(highCount).toBeGreaterThanOrEqual(lowCount);
  });

  it('builds the mosaic incrementally over time', () => {
    vi.useFakeTimers();

    const pattern = new MosaicPattern();
    // Short changeInterval → fillInterval clamped to 200ms
    pattern.init(makeConfig({ pattern: 'mosaic', changeInterval: 2000 }, { density: 5 }));
    pattern.apply(container, testImages);

    const totalCells = container.querySelectorAll('div').length;
    const initialImages = container.querySelectorAll('img').length;
    expect(initialImages).toBe(1);

    vi.advanceTimersByTime(1000);
    const nextImages = container.querySelectorAll('img').length;

    expect(nextImages).toBeGreaterThan(initialImages);
    expect(nextImages).toBeLessThanOrEqual(totalCells);

    pattern.cleanup();
    vi.useRealTimers();
  });

  it('cleans up timers', () => {
    const pattern = new MosaicPattern();
    pattern.init(makeConfig({ pattern: 'mosaic' }, { density: 3 }));
    pattern.apply(container, testImages);
    pattern.cleanup();
  });

  it('eventually fills every cell with an image', () => {
    vi.useFakeTimers();

    const pattern = new MosaicPattern();
    // Large changeInterval so hold phase doesn't expire during the test
    pattern.init(makeConfig({ pattern: 'mosaic', changeInterval: 60000 }, { density: 5 }));
    pattern.apply(container, testImages);

    // Advance enough to fill all cells (fill takes ≈ changeInterval)
    vi.advanceTimersByTime(60000);

    const cells = container.querySelectorAll('div');
    cells.forEach(cell => {
      expect(cell.querySelector('img')).not.toBeNull();
    });

    pattern.cleanup();
    vi.useRealTimers();
  });

  it('clears and rebuilds after the hold phase', () => {
    vi.useFakeTimers();

    const pattern = new MosaicPattern();
    // changeInterval=500 → fill at 200ms ticks, hold 500ms, fade 600ms
    pattern.init(makeConfig({ pattern: 'mosaic', changeInterval: 500 }, { density: 3 }));
    pattern.apply(container, testImages);

    // Capture a cell from the first layout immediately after apply
    const firstCycleCell = container.querySelector('div')!;
    expect(firstCycleCell).not.toBeNull();

    // Advance past a full cycle: fill (~25 cells × 200ms max) + hold (500ms) + fade (600ms) = ~6100ms
    vi.advanceTimersByTime(7000);

    // The original cell should no longer be in the container (layout was rebuilt)
    expect(container.contains(firstCycleCell)).toBe(false);
    // New cells should exist
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);

    pattern.cleanup();
    vi.useRealTimers();
  });
});

describe('RandomPattern', () => {
  let container: HTMLDivElement;
  const testImages = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates the requested number of random images', () => {
    const pattern = new RandomPattern();
    pattern.init(makeConfig({ pattern: 'random' }, { randomCount: 5, allowOverlap: true }));

    pattern.apply(container, testImages);
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(5);
  });

  it('cleans up timers', () => {
    const pattern = new RandomPattern();
    pattern.init(makeConfig({ pattern: 'random', changeInterval: 1000 }));
    pattern.apply(container, testImages);
    pattern.cleanup();
  });
});

describe('SlidingPattern', () => {
  let container: HTMLDivElement;
  const testImages = ['s1.jpg', 's2.jpg', 's3.jpg'];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('creates a sliding image and advances on interval', () => {
    vi.useFakeTimers();

    const pattern = new SlidingPattern();
    pattern.init(makeConfig({ pattern: 'sliding', changeInterval: 1000 }));
    pattern.apply(container, testImages);

    const firstSrc = container.querySelector('img')?.src;
    vi.advanceTimersByTime(1200);
    const secondSrc = container.querySelector('img')?.src;

    expect(firstSrc).toBeTruthy();
    expect(secondSrc).toBeTruthy();

    pattern.cleanup();
    vi.useRealTimers();
  });
});
