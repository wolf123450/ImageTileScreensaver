import { Pattern } from './index';
import { replaceImageInCell } from './image-utils';
import type { ScreensaverConfig } from '../types';

export interface MosaicPatternConfig {
  density: number;
  imageFitStyle: string;
  changeInterval: number;
  displayId?: number;
  displayCount?: number;
}

/**
 * Mosaic pattern that creates a mosaic effect with images of different sizes
 */
export class MosaicPattern implements Pattern {
  name: string = 'mosaic';
  private config: MosaicPatternConfig = {
    density: 5, // Medium density by default (1-10 scale)
    imageFitStyle: 'cover',
    changeInterval: 10000
  };
  private refreshTimers: number[] = [];
  private mosaicCells: HTMLDivElement[] = [];
  private pendingFillIndices: number[] = [];

  init(config: ScreensaverConfig): void {
    this.config = {
      ...this.config,
      imageFitStyle: config.imageFitStyle,
      changeInterval: config.changeInterval,
      density: config.patternOptions?.density ?? this.config.density,
    };
  }

  apply(container: HTMLElement, imageUrls: string[]): void {
    if (!imageUrls.length) return;

    console.log(`Applying mosaic pattern with density: ${this.config.density}`);

    // Clean up any previous state
    this.cleanup();

    // Clear the container
    container.innerHTML = '';

    // Reset mosaic cells array
    this.mosaicCells = [];

    // Set container to be a grid for mosaic layout
    container.style.display = 'grid';

    // Generate mosaic layout based on density
    const layout = this.generateMosaicLayout();

    // Apply grid template to container
    container.style.gridTemplateColumns = layout.columns;
    container.style.gridTemplateRows = layout.rows;
    container.style.gap = '8px';
    container.style.padding = '8px';

    // Create empty mosaic cells first; images will be filled over time.
    for (let i = 0; i < layout.cells.length; i++) {
      const cellConfig = layout.cells[i];

      // Create cell container
      const cell = document.createElement('div');
      cell.style.gridColumnStart = cellConfig.colStart.toString();
      cell.style.gridColumnEnd = cellConfig.colEnd.toString();
      cell.style.gridRowStart = cellConfig.rowStart.toString();
      cell.style.gridRowEnd = cellConfig.rowEnd.toString();
      cell.style.overflow = 'hidden';
      cell.style.position = 'relative';
      cell.dataset.cellIndex = i.toString();

      container.appendChild(cell);

      // Store the cell for later updates
      this.mosaicCells.push(cell);
    }

    // Start with one tile visible, then fill the rest incrementally.
    this.pendingFillIndices = this.buildShuffledIndices(this.mosaicCells.length);
    this.fillNextMosaicCell(imageUrls);

    // Calculate individual refresh interval based on total cell count
    const totalCells = layout.cells.length;
    const individualRefreshInterval = Math.max(200, this.config.changeInterval / totalCells);

    // Set up continuous timer to fill, then refresh one cell at a time.
    this.setupMosaicRefreshTimer(imageUrls, individualRefreshInterval);
  }
  
  private generateMosaicLayout() {
    // Determine grid size based on density
    // Higher density means more cells of varying sizes
    const density = this.config.density;
    
    // Base grid size - increases with density
    const baseSize = 4 + Math.floor(density / 2);
    
    // Generate a grid template with varying cell sizes
    const columns = new Array(baseSize).fill('1fr').join(' ');
    const rows = new Array(baseSize).fill('1fr').join(' ');
    
    // Generate cell configurations
    const cells: Array<{
      colStart: number;
      colEnd: number;
      rowStart: number;
      rowEnd: number;
    }> = [];
    
    // Higher density means more variation in cell sizes
    // Create a few large cells first
    const largeCellCount = Math.max(1, Math.floor((10 - density) / 3));
    
    // Track occupied positions
    const occupied = new Set<string>();
    
    // Helper to check if a position is available
    const isAvailable = (col: number, row: number) => {
      return !occupied.has(`${col}-${row}`);
    };
    
    // Helper to mark positions as occupied
    const markOccupied = (colStart: number, colEnd: number, rowStart: number, rowEnd: number) => {
      for (let c = colStart; c < colEnd; c++) {
        for (let r = rowStart; r < rowEnd; r++) {
          occupied.add(`${c}-${r}`);
        }
      }
    };
    
    // Create large cells
    for (let i = 0; i < largeCellCount; i++) {
      // Try to find an available position for a large cell
      let attempts = 0;
      let placed = false;
      
      while (!placed && attempts < 20) {
        const size = Math.min(3, Math.floor(Math.random() * 2) + 2);
        const colStart = Math.floor(Math.random() * (baseSize - size + 1)) + 1;
        const rowStart = Math.floor(Math.random() * (baseSize - size + 1)) + 1;
        const colEnd = colStart + size;
        const rowEnd = rowStart + size;
        
        // Check if all positions are available
        let available = true;
        for (let c = colStart; c < colEnd; c++) {
          for (let r = rowStart; r < rowEnd; r++) {
            if (!isAvailable(c, r)) {
              available = false;
              break;
            }
          }
          if (!available) break;
        }
        
        if (available) {
          cells.push({
            colStart,
            colEnd,
            rowStart,
            rowEnd
          });
          
          markOccupied(colStart, colEnd, rowStart, rowEnd);
          placed = true;
        }
        
        attempts++;
      }
    }
    
    // Create medium cells
    const mediumCellTarget = Math.floor(density / 2) + 3;
    let mediumCellCount = 0;
    
    for (let i = 0; i < 30 && mediumCellCount < mediumCellTarget; i++) {
      const size = 2;
      const colStart = Math.floor(Math.random() * (baseSize - size + 1)) + 1;
      const rowStart = Math.floor(Math.random() * (baseSize - size + 1)) + 1;
      const colEnd = colStart + size;
      const rowEnd = rowStart + size;
      
      // Check if all positions are available
      let available = true;
      for (let c = colStart; c < colEnd; c++) {
        for (let r = rowStart; r < rowEnd; r++) {
          if (!isAvailable(c, r)) {
            available = false;
            break;
          }
        }
        if (!available) break;
      }
      
      if (available) {
        cells.push({
          colStart,
          colEnd,
          rowStart,
          rowEnd
        });
        
        markOccupied(colStart, colEnd, rowStart, rowEnd);
        mediumCellCount++;
      }
    }
    
    // Fill remaining spaces with single cells
    for (let col = 1; col <= baseSize; col++) {
      for (let row = 1; row <= baseSize; row++) {
        if (isAvailable(col, row)) {
          cells.push({
            colStart: col,
            colEnd: col + 1,
            rowStart: row,
            rowEnd: row + 1
          });
          
          markOccupied(col, col + 1, row, row + 1);
        }
      }
    }
    
    return {
      columns,
      rows,
      cells
    };
  }
  
  private setupMosaicRefreshTimer(imageUrls: string[], interval: number): void {
    if (this.mosaicCells.length === 0 || imageUrls.length === 0) return;

    console.log(`Setting up mosaic refresh with interval: ${interval}ms per cell`);

    const continuousTimer = window.setInterval(() => {
      // Fill empty cells first so the layout builds up over time.
      if (this.fillNextMosaicCell(imageUrls)) {
        return;
      }

      this.replaceRandomMosaicImage(imageUrls);
    }, interval);

    this.refreshTimers.push(continuousTimer);
  }

  private buildShuffledIndices(count: number): number[] {
    const indices = Array.from({ length: count }, (_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }

  private createCellImage(imageUrls: string[]): HTMLImageElement {
    const randomImageIndex = Math.floor(Math.random() * imageUrls.length);
    const img = document.createElement('img');
    img.src = imageUrls[randomImageIndex];
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = this.config.imageFitStyle;
    img.style.transition = 'opacity 0.5s ease-in-out';
    return img;
  }

  private fillNextMosaicCell(imageUrls: string[]): boolean {
    while (this.pendingFillIndices.length > 0) {
      const nextIndex = this.pendingFillIndices.shift();
      if (nextIndex === undefined) return false;

      const cell = this.mosaicCells[nextIndex];
      if (!cell || cell.querySelector('img')) {
        continue;
      }

      const img = this.createCellImage(imageUrls);
      img.style.opacity = '0';
      cell.appendChild(img);
      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });
      return true;
    }

    return false;
  }

  private replaceRandomMosaicImage(imageUrls: string[]): void {
    if (this.mosaicCells.length === 0 || imageUrls.length === 0) return;

    const filledCells = this.mosaicCells.filter(cell => cell.querySelector('img'));
    if (filledCells.length === 0) return;

    const randomCellIndex = Math.floor(Math.random() * filledCells.length);
    replaceImageInCell(filledCells[randomCellIndex], imageUrls, this.config.imageFitStyle);
  }

  cleanup(): void {
    console.log(`Clearing ${this.refreshTimers.length} mosaic refresh timers`);

    this.refreshTimers.forEach(timer => {
      window.clearInterval(timer);
    });

    this.refreshTimers = [];
    this.mosaicCells = [];
    this.pendingFillIndices = [];
  }
}
