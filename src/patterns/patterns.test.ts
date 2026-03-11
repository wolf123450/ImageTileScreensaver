import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PatternFactory } from './pattern-factory';
import { SimplePattern } from './simple-pattern';
import { GridPattern } from './grid-pattern';
import { MosaicPattern } from './mosaic-pattern';

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
    pattern.init({ imageFitStyle: 'cover', changeInterval: 60000 });
    pattern.apply(container, testImages);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toContain('img1.jpg');
  });

  it('does nothing with empty image array', () => {
    const pattern = new SimplePattern();
    pattern.init({ imageFitStyle: 'cover', changeInterval: 60000 });
    pattern.apply(container, []);
    expect(container.querySelector('img')).toBeNull();
  });

  it('cleans up interval timer', () => {
    vi.useFakeTimers();
    const pattern = new SimplePattern();
    pattern.init({ imageFitStyle: 'cover', changeInterval: 1000 });
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
    pattern.init({ imageFitStyle: 'cover', changeInterval: 60000, displayId: 2 });
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
    pattern.init({ rows: 2, cols: 3, spacing: 4, imageFitStyle: 'cover', changeInterval: 60000 });
    pattern.apply(container, testImages);

    const cells = container.querySelectorAll('div');
    expect(cells.length).toBe(6);
    expect(container.style.display).toBe('grid');
    expect(container.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(container.style.gridTemplateRows).toBe('repeat(2, 1fr)');
  });

  it('each cell contains an image', () => {
    const pattern = new GridPattern();
    pattern.init({ rows: 1, cols: 2, spacing: 0, imageFitStyle: 'contain', changeInterval: 60000 });
    pattern.apply(container, testImages);

    const images = container.querySelectorAll('img');
    expect(images.length).toBe(2);
    images.forEach(img => {
      expect(img.style.objectFit).toBe('contain');
    });
  });

  it('cleans up timers', () => {
    const pattern = new GridPattern();
    pattern.init({ rows: 2, cols: 2, spacing: 0, imageFitStyle: 'cover', changeInterval: 60000 });
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
    pattern.init({ density: 5, imageFitStyle: 'cover', changeInterval: 60000 });
    pattern.apply(container, testImages);

    const cells = container.querySelectorAll('div');
    expect(cells.length).toBeGreaterThan(0);
    expect(container.style.display).toBe('grid');
  });

  it('higher density produces more or equal cells', () => {
    const lowPattern = new MosaicPattern();
    lowPattern.init({ density: 2, imageFitStyle: 'cover', changeInterval: 60000 });
    lowPattern.apply(container, testImages);
    const lowCount = container.querySelectorAll('div').length;

    container.innerHTML = '';
    const highPattern = new MosaicPattern();
    highPattern.init({ density: 9, imageFitStyle: 'cover', changeInterval: 60000 });
    highPattern.apply(container, testImages);
    const highCount = container.querySelectorAll('div').length;

    expect(highCount).toBeGreaterThanOrEqual(lowCount);
  });

  it('cleans up timers', () => {
    const pattern = new MosaicPattern();
    pattern.init({ density: 3, imageFitStyle: 'cover', changeInterval: 60000 });
    pattern.apply(container, testImages);
    pattern.cleanup();
  });

  it('every cell has an image', () => {
    const pattern = new MosaicPattern();
    pattern.init({ density: 5, imageFitStyle: 'cover', changeInterval: 60000 });
    pattern.apply(container, testImages);

    const cells = container.querySelectorAll('div');
    cells.forEach(cell => {
      expect(cell.querySelector('img')).not.toBeNull();
    });
  });
});
