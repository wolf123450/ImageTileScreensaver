import { Pattern } from './index';
import type { ScreensaverConfig } from '../types';

interface SlidingPatternConfig {
  imageFitStyle: string;
  changeInterval: number;
  slideSpeed: number;
}

export class SlidingPattern implements Pattern {
  name: string = 'sliding';

  private config: SlidingPatternConfig = {
    imageFitStyle: 'cover',
    changeInterval: 10000,
    slideSpeed: 40,
  };

  private timer: number | null = null;
  private currentIndex = 0;

  init(config: ScreensaverConfig): void {
    this.config = {
      ...this.config,
      imageFitStyle: config.imageFitStyle,
      changeInterval: config.changeInterval,
      slideSpeed: config.patternOptions?.slideSpeed ?? this.config.slideSpeed,
    };
  }

  apply(container: HTMLElement, imageUrls: string[]): void {
    if (!imageUrls.length) return;

    this.cleanup();
    container.innerHTML = '';
    container.style.display = 'block';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    const firstImage = this.createImage(imageUrls[this.currentIndex % imageUrls.length]);
    firstImage.style.transform = 'translateX(0)';
    container.appendChild(firstImage);

    this.timer = window.setInterval(() => {
      const current = container.querySelector('img:last-of-type') as HTMLImageElement | null;
      if (!current) return;

      this.currentIndex = (this.currentIndex + 1) % imageUrls.length;
      const next = this.createImage(imageUrls[this.currentIndex]);
      next.style.transform = 'translateX(100%)';
      container.appendChild(next);

      requestAnimationFrame(() => {
        current.style.transform = 'translateX(-100%)';
        next.style.transform = 'translateX(0)';
      });

      window.setTimeout(() => {
        if (current.parentElement === container) {
          container.removeChild(current);
        }
      }, 700);
    }, this.config.changeInterval);
  }

  cleanup(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private createImage(src: string): HTMLImageElement {
    const img = document.createElement('img');
    img.src = src;
    img.style.position = 'absolute';
    img.style.inset = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = this.config.imageFitStyle;
    img.style.transition = 'transform 0.7s ease-in-out';
    img.style.willChange = 'transform';
    return img;
  }
}
