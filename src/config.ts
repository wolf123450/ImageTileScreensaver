import * as path from 'path';
import * as os from 'os';

// Basic configuration for the screensaver
export interface ScreensaverConfig {
  imageFolder: string;
  changeInterval: number; // milliseconds
  pattern: string;
}

// Default configuration with a sample image path
export const defaultConfig: ScreensaverConfig = {
  imageFolder: path.join(process.cwd(), 'assets'), // Path to the folder with images
  changeInterval: 10000, // Change image every 10 seconds
  pattern: 'simple' // Simple pattern for the proof of concept
};

export function loadConfig(): ScreensaverConfig {
  try {
    // For this proof of concept, just return the default config
    // In a more complete implementation, this would load from a file
    return {
      ...defaultConfig,
      // You could add logic here to load from a config file
    };
  } catch (error) {
    console.error('Error loading config, using defaults:', error);
    return defaultConfig;
  }
}
