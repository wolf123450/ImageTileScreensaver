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
});
