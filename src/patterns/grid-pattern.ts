import { Pattern } from './index';
import { replaceImageInCell } from './image-utils';

export interface GridPatternConfig {
  rows: number;
  cols: number;
  spacing: number;
  imageFitStyle: string;
  changeInterval: number;
  displayId?: number;  // Add displayId as optional property
  displayCount?: number; // Add displayCount as optional property
}

/**
 * Grid pattern that arranges images in a grid layout and refreshes cells individually
 */
export class GridPattern implements Pattern {
  name: string = 'grid';
  private config: GridPatternConfig = {
    rows: 2,
    cols: 3,
    spacing: 10,
    imageFitStyle: 'cover',
    changeInterval: 10000
  };
  private refreshTimers: number[] = [];
  private gridCells: HTMLDivElement[] = [];
  
  init(config: Partial<GridPatternConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  apply(container: HTMLElement, imageUrls: string[]): void {
    if (!imageUrls.length) return;
    
    console.log(`Applying grid pattern: ${this.config.rows}x${this.config.cols} with ${this.config.spacing}px spacing`);
    
    // Clean up any previous state
    this.cleanup();
    
    // Clear the container
    container.innerHTML = '';
    
    // Reset grid cells array
    this.gridCells = [];
    
    // Set container to be a grid
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${this.config.cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${this.config.rows}, 1fr)`;
    container.style.gap = `${this.config.spacing}px`;
    container.style.padding = '0';
    
    // Create grid cells with random images
    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const cellIndex = row * this.config.cols + col;
        
        // Select a random image for initial display
        const randomImageIndex = Math.floor(Math.random() * imageUrls.length);
        
        // Create cell container
        const cell = document.createElement('div');
        cell.style.width = '100%';
        cell.style.height = '100%';
        cell.style.overflow = 'hidden';
        cell.style.position = 'relative'; 
        cell.dataset.cellIndex = cellIndex.toString();
        
        // Create image
        const img = document.createElement('img');
        img.src = imageUrls[randomImageIndex];
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = this.config.imageFitStyle;
        img.style.transition = 'opacity 0.5s ease-in-out';
        
        cell.appendChild(img);
        container.appendChild(cell);
        
        // Store the cell for later updates
        this.gridCells.push(cell);
      }
    }
    
    // Calculate the interval for replacing individual images
    const totalCells = this.config.rows * this.config.cols;
    const individualRefreshInterval = this.config.changeInterval / totalCells;
    
    // Set up continuous timer to refresh images one at a time
    this.setupGridRefreshTimer(imageUrls, individualRefreshInterval);
  }
  
  private setupGridRefreshTimer(imageUrls: string[], interval: number): void {
    if (this.gridCells.length === 0 || imageUrls.length === 0) return;
    
    console.log(`Setting up grid refresh with interval: ${interval}ms per cell`);
    
    // Set a single interval timer that will replace one random image at a time
    const continuousTimer = window.setInterval(() => {
      this.replaceRandomGridImage(imageUrls);
    }, interval);
    
    this.refreshTimers.push(continuousTimer);
  }
  
  private replaceRandomGridImage(imageUrls: string[]): void {
    if (this.gridCells.length === 0 || imageUrls.length === 0) return;
    const randomCellIndex = Math.floor(Math.random() * this.gridCells.length);
    replaceImageInCell(this.gridCells[randomCellIndex], imageUrls, this.config.imageFitStyle);
  }
  
  cleanup(): void {
    console.log(`Clearing ${this.refreshTimers.length} grid refresh timers`);
    
    this.refreshTimers.forEach(timer => {
      window.clearInterval(timer);
    });
    
    this.refreshTimers = [];
    this.gridCells = [];
  }
}
