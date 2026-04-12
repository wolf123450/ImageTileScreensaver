import { describe, it, expect } from 'vitest';
import { colorDistance, computeTileDimensions } from './color-utils';

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
