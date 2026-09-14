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
    version: number;
    imageFolder: string;
    includeSubdirectories: boolean;
    changeInterval: number; // milliseconds
    pattern: string;
    patternOptions?: PatternOptions;
    multiMonitorSync: boolean;
    transition: TransitionConfig;
    theme: string;
    imageFitStyle: string;
}

export interface PatternOptions {
    rows?: number;
    cols?: number;
    density?: number;
    randomCount?: number;
    allowOverlap?: boolean;
    slideSpeed?: number;
    // Mosaic placement engine options
    placementSpeed?: number;
    tileAreaPercent?: number;
    tileMargin?: number;
    priorityFunction?: 'center-out' | 'spiral-cw' | 'spiral-ccw' | 'random' | 'directional';
    directionAngle?: number;
    startPosition?: 'center' | 'random';
    maxTiles?: number;
    holdDuration?: number;
    zoomEnabled?: boolean;
    maxZoomOut?: number;
    bufferSize?: number;
    referenceImage?: string;
    referenceImageDir?: string;
    colorDistanceFn?: 'rgb' | 'hsv';
    colorSource?: 'average' | 'dominant';
    referenceTileCount?: number;
}

export interface PreviewImagesResult {
    allImages: string[];
    totalCount: number;
}

export interface ColorCacheEntry {
    avgColor: string;   // hex e.g. "#4a6b3c"
    domColor: string;   // hex e.g. "#2d4f1e"
    mtime: number;      // file modification time in ms since epoch
    size: number;       // file size in bytes
    width?: number;     // natural pixel width
    height?: number;    // natural pixel height
}

export interface ColorCacheData {
    version: number;
    entries: Record<string, ColorCacheEntry>;
}

export interface FileStatEntry {
    path: string;
    mtime: number;
    size: number;
}

/** The IPC API surface exposed to renderer/settings code via window.electronAPI */
export interface ScreensaverAPI {
    closeScreensaver: () => Promise<void>;
    getImages: () => Promise<string[]>;
    getConfig: () => Promise<ScreensaverConfig>;
    browseDirectory: () => Promise<string | null>;
    validateDirectory: (directory: string) => Promise<boolean>;
    getPreviewImages: (directory: string) => Promise<PreviewImagesResult>;
    applyConfig: (config: ScreensaverConfig) => Promise<void>;
    saveConfig: (config: ScreensaverConfig) => Promise<void>;
    closeConfigWindow: () => void;
    getLogPath: () => Promise<string>;
    readColorCache: () => Promise<ColorCacheData>;
    writeColorCache: (data: ColorCacheData) => Promise<void>;
    getFileStats: (paths: string[]) => Promise<FileStatEntry[]>;
    getRawImagePaths: () => Promise<string[]>;
}

declare global {
    interface Window {
        electronAPI: ScreensaverAPI;
    }
}
