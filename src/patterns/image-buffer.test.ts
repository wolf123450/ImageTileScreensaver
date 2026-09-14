import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageBuffer } from './image-buffer';
import type { BufferedImage } from './image-buffer';

// Mock Image loading — jsdom doesn't load real images
function mockImageLoad() {
  vi.spyOn(globalThis, 'Image').mockImplementation(() => {
    const img = {
      src: '',
      naturalWidth: 200,
      naturalHeight: 100,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      style: {},
    } as unknown as HTMLImageElement;

    let _src = '';
    Object.defineProperty(img, 'src', {
      get() { return _src; },
      set(v: string) {
        _src = v;
        queueMicrotask(() => img.onload?.());
      },
    });

    return img;
  });
}

describe('ImageBuffer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockImageLoad();
  });

  it('prefill loads bufferSize images', async () => {
    const buffer = new ImageBuffer();
    buffer.init(
      ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'],
      800, 600,
      { tileAreaPercent: 10, bufferSize: 3 },
    );

    await buffer.prefill();
    expect(buffer.bufferedCount).toBe(3);
  });

  it('next returns a buffered image and triggers backfill', async () => {
    const buffer = new ImageBuffer();
    buffer.init(
      ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
      800, 600,
      { tileAreaPercent: 10, bufferSize: 2 },
    );
    await buffer.prefill();

    const img = buffer.next();
    expect(img).not.toBeNull();
    expect(img!.url).toBeTruthy();
    expect(img!.naturalWidth).toBe(200);
    expect(img!.naturalHeight).toBe(100);
  });

  it('returns null when buffer is empty', async () => {
    const buffer = new ImageBuffer();
    buffer.init(['a.jpg'], 800, 600, { tileAreaPercent: 10, bufferSize: 1 });
    await buffer.prefill();

    buffer.next(); // consume the only one
    const result = buffer.next();
    expect(result).toBeNull();
  });

  it('hasMore returns false when all URLs consumed', async () => {
    const buffer = new ImageBuffer();
    buffer.init(['a.jpg'], 800, 600, { tileAreaPercent: 10, bufferSize: 1 });
    await buffer.prefill();

    buffer.next();
    expect(buffer.hasMore()).toBe(false);
  });

  it('reshuffles when all URLs are consumed', async () => {
    const buffer = new ImageBuffer();
    buffer.init(['a.jpg', 'b.jpg'], 800, 600, { tileAreaPercent: 10, bufferSize: 2 });
    await buffer.prefill();

    // Consume both
    buffer.next();
    buffer.next();

    // Should have reshuffled and started loading again
    expect(buffer.hasMore()).toBe(true);
  });

  describe('color cache', () => {
    it('uses cached color instead of computing when cache is provided', async () => {
      const buffer = new ImageBuffer();
      const cache = new Map<string, { avgColor: [number, number, number]; domColor: [number, number, number] }>();
      cache.set('a.jpg', { avgColor: [255, 0, 0], domColor: [200, 0, 0] });
      cache.set('b.jpg', { avgColor: [0, 255, 0], domColor: [0, 200, 0] });

      buffer.init(
        ['a.jpg', 'b.jpg'],
        800, 600,
        { tileAreaPercent: 10, bufferSize: 2, colorSource: 'average' },
        cache,
      );

      await buffer.prefill();
      const img = buffer.next();
      expect(img).not.toBeNull();
      // Color should come from cache, not computed
      const isRed = img!.avgColor[0] === 255 && img!.avgColor[1] === 0 && img!.avgColor[2] === 0;
      const isGreen = img!.avgColor[0] === 0 && img!.avgColor[1] === 255 && img!.avgColor[2] === 0;
      expect(isRed || isGreen).toBe(true);
    });

    it('falls back to computed color on cache miss', async () => {
      const buffer = new ImageBuffer();
      const cache = new Map<string, { avgColor: [number, number, number]; domColor: [number, number, number] }>();
      cache.set('a.jpg', { avgColor: [255, 0, 0], domColor: [200, 0, 0] });

      buffer.init(
        ['a.jpg', 'b.jpg'],
        800, 600,
        { tileAreaPercent: 10, bufferSize: 2 },
        cache,
      );

      await buffer.prefill();
      expect(buffer.bufferedCount).toBe(2);
    });
  });
});
