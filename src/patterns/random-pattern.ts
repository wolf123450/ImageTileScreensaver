import { Pattern } from './index';
import type { ScreensaverConfig } from '../types';
import { replaceImageInCell } from './image-utils';

interface RandomPatternConfig {
  imageFitStyle: string;
  changeInterval: number;
  randomCount: number;
  allowOverlap: boolean;
}

export class RandomPattern implements Pattern {
  name: string = 'random';

  private config: RandomPatternConfig = {
    imageFitStyle: 'cover',
    changeInterval: 10000,
    randomCount: 8,
    allowOverlap: true,
  };

  private cells: HTMLDivElement[] = [];
  private refreshTimer: number | null = null;

  init(config: ScreensaverConfig): void {
    this.config = {
      ...this.config,
      imageFitStyle: config.imageFitStyle,
      changeInterval: config.changeInterval,
      randomCount: config.patternOptions?.randomCount ?? this.config.randomCount,
      allowOverlap: config.patternOptions?.allowOverlap ?? this.config.allowOverlap,
    };
  }

  apply(container: HTMLElement, imageUrls: string[]): void {
    if (!imageUrls.length) return;

    this.cleanup();
    container.innerHTML = '';
    container.style.display = 'block';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    this.cells = [];

    const count = Math.max(1, this.config.randomCount);
    for (let i = 0; i < count; i++) {
      const cell = document.createElement('div');
      cell.style.position = 'absolute';
      cell.style.overflow = 'hidden';
      cell.style.borderRadius = '8px';
      cell.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)';

      this.positionCell(cell, i, count);

      const img = document.createElement('img');
      img.src = imageUrls[Math.floor(Math.random() * imageUrls.length)];
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = this.config.imageFitStyle;
      img.style.transition = 'opacity 0.5s ease-in-out';

      cell.appendChild(img);
      container.appendChild(cell);
      this.cells.push(cell);
    }

    const refreshEvery = Math.max(500, Math.floor(this.config.changeInterval / count));
    this.refreshTimer = window.setInterval(() => {
      if (!this.cells.length) return;
      const cell = this.cells[Math.floor(Math.random() * this.cells.length)];

      if (this.config.allowOverlap) {
        const index = this.cells.indexOf(cell);
        this.positionCell(cell, index, count);
      }

      replaceImageInCell(cell, imageUrls, this.config.imageFitStyle);
    }, refreshEvery);
  }

  cleanup(): void {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.cells = [];
  }

  private positionCell(cell: HTMLDivElement, index: number, total: number): void {
    if (!this.config.allowOverlap) {
      const cols = Math.ceil(Math.sqrt(total));
      const rows = Math.ceil(total / cols);
      const col = index % cols;
      const row = Math.floor(index / cols);
      const width = 100 / cols;
      const height = 100 / rows;

      cell.style.left = `${col * width}%`;
      cell.style.top = `${row * height}%`;
      cell.style.width = `${width}%`;
      cell.style.height = `${height}%`;
      return;
    }

    const width = 18 + Math.random() * 26;
    const height = 18 + Math.random() * 26;
    const left = Math.random() * (100 - width);
    const top = Math.random() * (100 - height);

    cell.style.width = `${width}%`;
    cell.style.height = `${height}%`;
    cell.style.left = `${left}%`;
    cell.style.top = `${top}%`;
  }
}
