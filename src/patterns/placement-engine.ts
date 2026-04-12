export interface PlacedTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FreeCorner {
  x: number;
  y: number;
  priority: number;
}

export type PriorityFn = (corner: { x: number; y: number }) => number;

export function createPriorityFn(
  name: 'center-out' | 'spiral-cw' | 'spiral-ccw' | 'random' | 'directional',
  directionAngle: number = 0,
): PriorityFn {
  switch (name) {
    case 'center-out':
      return ({ x, y }) => Math.sqrt(x * x + y * y);
    case 'spiral-cw':
      return ({ x, y }) => Math.sqrt(x * x + y * y) + 0.1 * Math.atan2(y, x);
    case 'spiral-ccw':
      return ({ x, y }) => Math.sqrt(x * x + y * y) - 0.1 * Math.atan2(y, x);
    case 'directional': {
      const rad = (directionAngle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      return ({ x, y }) => x * cosA + y * sinA;
    }
    case 'random':
      return () => Math.random();
  }
}

export class PlacementEngine {
  private placedTiles: PlacedTile[] = [];
  private freeCorners: FreeCorner[] = [];
  private priorityFn: PriorityFn;

  constructor(priorityFn: PriorityFn) {
    this.priorityFn = priorityFn;
  }

  get tileCount(): number {
    return this.placedTiles.length;
  }

  get cornerCount(): number {
    return this.freeCorners.length;
  }

  peekCorner(): FreeCorner | null {
    return this.freeCorners.length > 0 ? this.freeCorners[0] : null;
  }

  getTiles(): readonly PlacedTile[] {
    return this.placedTiles;
  }

  seedFirstTile(
    width: number,
    height: number,
    position: 'center' | 'random',
    viewportWidth: number,
    viewportHeight: number,
  ): PlacedTile {
    let x: number;
    let y: number;

    if (position === 'center') {
      x = -width / 2;
      y = -height / 2;
    } else {
      const halfVW = viewportWidth / 2;
      const halfVH = viewportHeight / 2;
      x = Math.random() * (viewportWidth - width) - halfVW;
      y = Math.random() * (viewportHeight - height) - halfVH;
    }

    const tile: PlacedTile = { x, y, width, height };
    this.placedTiles.push(tile);
    this.addCornersForTile(tile);
    return tile;
  }

  placeTile(width: number, height: number): PlacedTile | null {
    let i = 0;
    while (i < this.freeCorners.length) {
      const corner = this.freeCorners[i];
      const candidate = this.tryOrientations(corner, width, height);

      if (candidate) {
        this.freeCorners.splice(i, 1);
        this.placedTiles.push(candidate);
        this.addCornersForTile(candidate);
        return candidate;
      }

      // All 4 orientations collided — dead corner, remove
      this.freeCorners.splice(i, 1);
    }

    return null;
  }

  getWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    if (this.placedTiles.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const tile of this.placedTiles) {
      if (tile.x < minX) minX = tile.x;
      if (tile.y < minY) minY = tile.y;
      if (tile.x + tile.width > maxX) maxX = tile.x + tile.width;
      if (tile.y + tile.height > maxY) maxY = tile.y + tile.height;
    }

    return { minX, minY, maxX, maxY };
  }

  reset(): void {
    this.placedTiles = [];
    this.freeCorners = [];
  }

  private tryOrientations(
    corner: FreeCorner,
    width: number,
    height: number,
  ): PlacedTile | null {
    const cx = corner.x;
    const cy = corner.y;

    const candidates: PlacedTile[] = [
      { x: cx, y: cy, width, height },
      { x: cx - width, y: cy, width, height },
      { x: cx, y: cy - height, width, height },
      { x: cx - width, y: cy - height, width, height },
    ];

    for (const candidate of candidates) {
      if (!this.collidesWithAny(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private collidesWithAny(tile: PlacedTile): boolean {
    for (const placed of this.placedTiles) {
      if (
        tile.x < placed.x + placed.width &&
        tile.x + tile.width > placed.x &&
        tile.y < placed.y + placed.height &&
        tile.y + tile.height > placed.y
      ) {
        return true;
      }
    }
    return false;
  }

  private addCornersForTile(tile: PlacedTile): void {
    const corners = [
      { x: tile.x, y: tile.y },
      { x: tile.x + tile.width, y: tile.y },
      { x: tile.x, y: tile.y + tile.height },
      { x: tile.x + tile.width, y: tile.y + tile.height },
    ];

    for (const c of corners) {
      this.freeCorners.push({
        x: c.x,
        y: c.y,
        priority: this.priorityFn(c),
      });
    }

    this.freeCorners.sort((a, b) => a.priority - b.priority);
  }
}
