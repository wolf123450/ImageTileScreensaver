import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * Configuration options for the screensaver
 */
export interface ScreensaverConfig {
    imageFolder: string;
    includeSubdirectories: boolean;
    changeInterval: number;  // milliseconds
    pattern: string;
    multiMonitorSync: boolean;
    transition: {
        effect: string;
        duration: number;  // milliseconds
    };
    theme: string;  // 'light' or 'dark'
}

/**
 * Default configuration values
 */
export const defaultConfig: ScreensaverConfig = {
    imageFolder: '',
    includeSubdirectories: true,
    changeInterval: 10000,  // 10 seconds
    pattern: 'simple',
    multiMonitorSync: false,
    transition: {
        effect: 'fade',
        duration: 1000  // 1 second
    },
    theme: 'light'
};

/**
 * Get the path to the config file
 */
export function getConfigFilePath(): string {
    // Use app.getPath('userData') to get the app data directory
    // This ensures we use the correct location for each platform
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'config.json');
}

/**
 * Load configuration from file
 * @returns The loaded configuration, or default if not found
 */
export function loadConfig(): ScreensaverConfig {
    const configPath = getConfigFilePath();
    
    try {
        // Check if file exists
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const loadedConfig = JSON.parse(configData);
            
            // Merge with defaults in case the saved config is missing some properties
            return { ...defaultConfig, ...loadedConfig };
        }
    } catch (error) {
        console.error('Error loading config file:', error);
    }
    
    // If we get here, use default config
    return { ...defaultConfig };
}

/**
 * Save configuration to file
 * @param config The configuration to save
 * @returns Promise that resolves when saving is complete
 */
export async function saveConfig(config: ScreensaverConfig): Promise<void> {
    const configPath = getConfigFilePath();
    
    try {
        // Ensure directory exists
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Write the config file
        const configData = JSON.stringify(config, null, 2); // Pretty print with 2 spaces
        await fs.promises.writeFile(configPath, configData, 'utf-8');
        console.log(`Configuration saved to ${configPath}`);
    } catch (error) {
        console.error('Error saving config file:', error);
        throw error;
    }
}
