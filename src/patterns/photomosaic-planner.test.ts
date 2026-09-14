import { describe, it, expect } from 'vitest';
import { PhotomosaicPlanner } from './photomosaic-planner';
import type { PlannerCacheEntry } from './photomosaic-planner';
import { PlacementEngine, createPriorityFn } from './placement-engine';
import type { RGB } from './color-utils';

// Helper: create a fake CanvasRenderingContext2D that returns a fixed color
function fakeCtx(color: RGB): CanvasRenderingContext2D {
  return {
    getImageData: () => ({
      data: new Uint8ClampedArray([color[0], color[1], color[2], 255]),
    }),
  } as unknown as CanvasRenderingContext2D;
}

function makeCache(entries: Array<{ url: string; color: RGB; w: number; h: number }>): Map<string, PlannerCacheEntry> {
  const map = new Map<string, PlannerCacheEntry>();
  for (const e of entries) {
    map.set(e.url, { avgColor: e.color, domColor: e.color, width: e.w, height: e.h });
  }
  return map;
}

describe('PhotomosaicPlanner', () => {
  it('produces a plan with tiles inside reference bounds', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 200, h: 200 },
      { url: 'b.jpg', color: [200, 50, 50], w: 200, h: 200 },
    ]);
    const refBounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorDistanceFn: 'rgb',
      colorSource: 'average',
      maxTiles: 50,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    expect(plan.length).toBeGreaterThan(0);
    // First tile should be the one closest to [100,100,100] = 'a.jpg'
    expect(plan[0].url).toBe('a.jpg');
  });

  it('applies reuse penalty to diversify selections', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    // Two images with very similar colors
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 200, h: 200 },
      { url: 'b.jpg', color: [102, 100, 100], w: 200, h: 200 },
    ]);
    const refBounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorDistanceFn: 'rgb',
      colorSource: 'average',
      maxTiles: 20,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    // With reuse penalty, both images should appear
    const urls = new Set(plan.map(p => p.url));
    expect(urls.size).toBe(2);
  });

  it('skips corners outside reference bounds', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    // Reference bounds large enough to fit some tiles but not all
    // targetArea=10000 → sampleSide=100 → halfTile=50
    // Inner bounds will be [-150,-150] to [150,150] (300x300)
    // Seed tile 104x104 centered: fits, but growth is bounded
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 100, h: 100 },
    ]);
    const refBounds = { minX: -200, minY: -200, maxX: 200, maxY: 200 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorDistanceFn: 'rgb',
      colorSource: 'average',
      maxTiles: 100,
    });

    engine.seedFirstTile(104, 104, 'center', 400, 400);
    const plan = planner.plan(engine);

    // Tiles fitting inside the bounded area — limited by boundary, well under maxTiles
    expect(plan.length).toBeLessThan(100);
    expect(plan.length).toBeGreaterThan(0);
    expect(engine.cornerCount).toBe(0); // all corners consumed
  });

  it('respects maxTiles cap', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    const cache = makeCache([
      { url: 'a.jpg', color: [100, 100, 100], w: 200, h: 200 },
    ]);
    const refBounds = { minX: -5000, minY: -5000, maxX: 5000, maxY: 5000 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorDistanceFn: 'rgb',
      colorSource: 'average',
      maxTiles: 5,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    expect(plan.length).toBe(5);
  });

  it('uses dominant color when strategy is dominant', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    const cache = new Map<string, PlannerCacheEntry>();
    // avgColor is far from target, domColor is close
    cache.set('a.jpg', { avgColor: [255, 0, 0], domColor: [100, 100, 100], width: 200, height: 200 });
    cache.set('b.jpg', { avgColor: [100, 100, 100], domColor: [255, 0, 0], width: 200, height: 200 });

    const refBounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorDistanceFn: 'rgb',
      colorSource: 'dominant',
      maxTiles: 1,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    // With dominant strategy, a.jpg's domColor [100,100,100] matches target
    expect(plan[0].url).toBe('a.jpg');
  });

  it('returns empty plan when cache is empty', () => {
    const engine = new PlacementEngine(createPriorityFn('center-out'));
    const cache = new Map<string, PlannerCacheEntry>();
    const refBounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const ctx = fakeCtx([100, 100, 100]);

    const planner = new PhotomosaicPlanner({
      cache,
      referenceCtx: ctx,
      referenceWidth: 100,
      referenceHeight: 100,
      referenceWorldBounds: refBounds,
      targetArea: 10000,
      tileMargin: 4,
      colorDistanceFn: 'rgb',
      colorSource: 'average',
      maxTiles: 10,
    });

    engine.seedFirstTile(104, 104, 'center', 1000, 1000);
    const plan = planner.plan(engine);

    expect(plan.length).toBe(0);
  });
});
