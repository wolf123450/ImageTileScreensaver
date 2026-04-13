import { describe, it, expect } from 'vitest';
import { colorDistance, computeTileDimensions, rgbToHsv, hsvDistance } from './color-utils';

describe('colorDistance', () => {
  it('returns 0 for identical colors', () => {
    expect(colorDistance([100, 100, 100], [100, 100, 100])).toBe(0);
  });

  it('computes weighted euclidean distance', () => {
    const d = colorDistance([255, 0, 0], [0, 0, 0]);
    expect(d).toBeCloseTo(Math.sqrt(2 * 255 * 255));
  });

  it('weights green more than red', () => {
    const redDiff = colorDistance([255, 0, 0], [0, 0, 0]);
    const greenDiff = colorDistance([0, 255, 0], [0, 0, 0]);
    expect(greenDiff).toBeGreaterThan(redDiff);
  });
});

describe('computeTileDimensions', () => {
  it('computes dimensions for square image', () => {
    const { width, height } = computeTileDimensions(100, 100, 10000);
    expect(width).toBeCloseTo(100);
    expect(height).toBeCloseTo(100);
    expect(width * height).toBeCloseTo(10000);
  });

  it('computes dimensions for landscape image', () => {
    const { width, height } = computeTileDimensions(200, 100, 10000);
    const ratio = width / height;
    expect(ratio).toBeCloseTo(2);
    expect(width * height).toBeCloseTo(10000);
  });

  it('computes dimensions for portrait image', () => {
    const { width, height } = computeTileDimensions(100, 200, 10000);
    const ratio = width / height;
    expect(ratio).toBeCloseTo(0.5);
    expect(width * height).toBeCloseTo(10000);
  });
});

describe('rgbToHsv', () => {
  it('converts pure red', () => {
    const [h, s, v] = rgbToHsv([255, 0, 0]);
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });

  it('converts pure green', () => {
    const [h, s, v] = rgbToHsv([0, 255, 0]);
    expect(h).toBeCloseTo(120);
    expect(s).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });

  it('converts pure blue', () => {
    const [h, s, v] = rgbToHsv([0, 0, 255]);
    expect(h).toBeCloseTo(240);
    expect(s).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });

  it('converts white', () => {
    const [h, s, v] = rgbToHsv([255, 255, 255]);
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(0);
    expect(v).toBeCloseTo(1);
  });

  it('converts black', () => {
    const [h, s, v] = rgbToHsv([0, 0, 0]);
    expect(s).toBeCloseTo(0);
    expect(v).toBeCloseTo(0);
  });
});

describe('hsvDistance', () => {
  it('returns 0 for identical colors', () => {
    expect(hsvDistance([100, 100, 100], [100, 100, 100])).toBe(0);
  });

  it('returns non-zero for different colors', () => {
    expect(hsvDistance([255, 0, 0], [0, 255, 0])).toBeGreaterThan(0);
  });

  it('handles hue wrapping (red vs magenta)', () => {
    // Red (h=0) vs magenta (h=300) should be closer than red vs cyan (h=180)
    const redMagenta = hsvDistance([255, 0, 0], [255, 0, 255]);
    const redCyan = hsvDistance([255, 0, 0], [0, 255, 255]);
    expect(redMagenta).toBeLessThan(redCyan);
  });
});
