import { Pattern } from './index';

export interface SimplePatternConfig {
  imageFitStyle: string;
  changeInterval: number;
  displayId?: number;  // Add displayId as optional property
  displayCount?: number; // Add displayCount as optional property
}

/**
 * Simple pattern that displays a single image at a time, changing periodically
 */
export class SimplePattern implements Pattern {
  name: string = 'simple';
  private config: SimplePatternConfig = {
    imageFitStyle: 'cover',
    changeInterval: 10000
  };
  private changeTimer: number | null = null;
  private currentIndex: number = 0;
  private displayId: number = 0;

  init(config: SimplePatternConfig): void {
    this.config = { ...this.config, ...config };
    this.displayId = config.displayId || 0;
  }

  apply(container: HTMLElement, imageUrls: string[]): void {
    if (!imageUrls.length) return;
    
    // Clear previous content
    container.innerHTML = '';
    
    // Reset container styles (in case it was previously a grid)
    container.style.display = 'flex';
    container.style.gridTemplateColumns = '';
    container.style.gridTemplateRows = '';
    container.style.gap = '';
    
    // Create and display the image
    const adjustedIndex = (this.currentIndex + this.displayId) % imageUrls.length;
    const img = document.createElement('img');
    img.src = imageUrls[adjustedIndex];
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = this.config.imageFitStyle;
    
    // Add fade-in effect
    img.style.opacity = '0';
    img.style.transition = 'opacity 1s ease-in-out';
    container.appendChild(img);
    
    // Trigger reflow to ensure transition works
    void img.offsetWidth;
    
    // Fade in
    img.style.opacity = '1';
    
    // Set up timer for next image
    this.cleanup(); // Clear any existing timer
    this.changeTimer = window.setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % imageUrls.length;
      this.apply(container, imageUrls);
    }, this.config.changeInterval);
  }

  cleanup(): void {
    if (this.changeTimer !== null) {
      window.clearInterval(this.changeTimer);
      this.changeTimer = null;
    }
  }
}
