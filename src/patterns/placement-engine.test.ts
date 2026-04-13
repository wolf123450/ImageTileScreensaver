import { describe, it, expect } from 'vitest';
import {
  PlacementEngine,
  createPriorityFn,
} from './placement-engine';
import type { PlacedTile, FreeCorner } from './placement-engine';

describe('PlacementEngine', () => {
  describe('seedFirstTile', () => {
    it('places a tile centered at origin', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      const tile = engine.seedFirstTile(100, 50, 'center', 800, 600);

      expect(tile.x).toBe(-50);
      expect(tile.y).toBe(-25);
      expect(tile.width).toBe(100);
      expect(tile.height).toBe(50);
    });

    it('adds 4 corners after seeding', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 50, 'center', 800, 600);
      expect(engine.cornerCount).toBe(4);
    });

    it('places tile within viewport for random position', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      const tile = engine.seedFirstTile(100, 50, 'random', 800, 600);

      expect(tile.x).toBeGreaterThanOrEqual(-400);
      expect(tile.y).toBeGreaterThanOrEqual(-300);
      expect(tile.x + tile.width).toBeLessThanOrEqual(400);
      expect(tile.y + tile.height).toBeLessThanOrEqual(300);
    });

    it('returns the placed tile in placedTiles', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 50, 'center', 800, 600);
      expect(engine.tileCount).toBe(1);
    });
  });

  describe('getWorldBounds', () => {
    it('returns bounds of a single seeded tile', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 50, 'center', 800, 600);
      const bounds = engine.getWorldBounds();
      expect(bounds.minX).toBe(-50);
      expect(bounds.minY).toBe(-25);
      expect(bounds.maxX).toBe(50);
      expect(bounds.maxY).toBe(25);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 50, 'center', 800, 600);
      engine.reset();
      expect(engine.tileCount).toBe(0);
      expect(engine.cornerCount).toBe(0);
    });
  });

  // Task 3 tests below
  describe('placeTile', () => {
    it('places a second tile adjacent to the first', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);
      const tile2 = engine.placeTile(100, 100);
      expect(tile2).not.toBeNull();
      expect(engine.tileCount).toBe(2);
    });

    it('placed tiles never overlap', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(50, 50, 'center', 800, 600);
      for (let i = 0; i < 20; i++) {
        engine.placeTile(50, 50);
      }
      const tiles = engine.getTiles();
      for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
          const a = tiles[i];
          const b = tiles[j];
          const overlaps =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlaps, `Tile ${i} overlaps tile ${j}`).toBe(false);
        }
      }
    });

    it('adds new corners after each placement', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);
      engine.placeTile(100, 100);
      expect(engine.cornerCount).toBeGreaterThan(0);
    });

    it('returns null when no placement is possible', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);
      let placed = 0;
      for (let i = 0; i < 1000; i++) {
        const result = engine.placeTile(100, 100);
        if (result === null) break;
        placed++;
      }
      expect(placed).toBeGreaterThan(0);
    });

    it('culls dead corners that have no valid orientation', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);
      for (let i = 0; i < 50; i++) {
        engine.placeTile(100, 100);
      }
      expect(engine.cornerCount).toBeLessThan(204);
    });
  });

  // Task 4 tests below
  describe('priority functions', () => {
    it('center-out places nearest to center first', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(50, 50, 'center', 800, 600);
      const tiles: PlacedTile[] = [];
      for (let i = 0; i < 10; i++) {
        const tile = engine.placeTile(50, 50);
        if (tile) tiles.push(tile);
      }
      const distances = tiles.map(t => {
        const cx = t.x + t.width / 2;
        const cy = t.y + t.height / 2;
        return Math.sqrt(cx * cx + cy * cy);
      });
      expect(distances[0]).toBeLessThan(distances[distances.length - 1]);
    });

    it('directional places along the configured angle', () => {
      const engine = new PlacementEngine(createPriorityFn('directional', 0));
      engine.seedFirstTile(50, 50, 'center', 800, 600);
      const tiles: PlacedTile[] = [];
      for (let i = 0; i < 5; i++) {
        const tile = engine.placeTile(50, 50);
        if (tile) tiles.push(tile);
      }
      expect(tiles.length).toBeGreaterThan(0);
    });
  });

  describe('createPriorityFn', () => {
    it('center-out returns distance from origin', () => {
      const fn = createPriorityFn('center-out');
      expect(fn({ x: 3, y: 4 })).toBeCloseTo(5);
      expect(fn({ x: 0, y: 0 })).toBe(0);
    });

    it('spiral-cw adds atan2 term', () => {
      const fn = createPriorityFn('spiral-cw');
      const base = Math.sqrt(9 + 16);
      const angle = Math.atan2(4, 3);
      expect(fn({ x: 3, y: 4 })).toBeCloseTo(base + 0.1 * angle);
    });

    it('directional projects onto angle', () => {
      const fn = createPriorityFn('directional', 90);
      expect(fn({ x: 0, y: 5 })).toBeCloseTo(5);
      expect(fn({ x: 5, y: 0 })).toBeCloseTo(0, 0);
    });
  });

  describe('skipCorner', () => {
    it('removes the top-priority corner without placing a tile', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.seedFirstTile(100, 100, 'center', 800, 600);
      const cornersBefore = engine.cornerCount;
      const tilesBefore = engine.tileCount;
      engine.skipCorner();
      expect(engine.cornerCount).toBe(cornersBefore - 1);
      expect(engine.tileCount).toBe(tilesBefore);
    });

    it('is a no-op when corner queue is empty', () => {
      const engine = new PlacementEngine(createPriorityFn('center-out'));
      engine.skipCorner();
      expect(engine.cornerCount).toBe(0);
    });
  });
});
