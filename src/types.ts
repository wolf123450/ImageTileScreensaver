/**
 * Shared type definitions for the Image Tile Screensaver.
 * These types mirror the Rust ScreensaverConfig (src-tauri/src/config.rs)
 * and are the single source of truth for the TypeScript frontend.
 */

export interface TransitionConfig {
    effect: string;
    duration: number; // milliseconds
}

export interface ScreensaverConfig {
    imageFolder: string;
    includeSubdirectories: boolean;
    changeInterval: number; // milliseconds
    pattern: string;
    patternOptions?: PatternOptions;
    multiMonitorSync: boolean;
    transition: TransitionConfig;
    theme: string;
    imageFitStyle?: string;
}

export interface PatternOptions {
    rows?: number;
    cols?: number;
    density?: number;
}

export interface PreviewImagesResult {
    allImages: string[];
    totalCount: number;
}

/** The IPC API surface exposed to renderer/settings code via window.electronAPI */
export interface ScreensaverAPI {
    closeScreensaver: () => void;
    getImages: () => Promise<string[]>;
    getConfig: () => Promise<ScreensaverConfig>;
    browseDirectory: () => Promise<string | null>;
    validateDirectory: (directory: string) => Promise<boolean>;
    getPreviewImages: (directory: string) => Promise<PreviewImagesResult>;
    applyConfig: (config: ScreensaverConfig) => Promise<void>;
    saveConfig: (config: ScreensaverConfig) => Promise<void>;
    closeConfigWindow: () => void;
    getLogPath: () => Promise<string>;
}

declare global {
    interface Window {
        electronAPI: ScreensaverAPI;
    }
}
