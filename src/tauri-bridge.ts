/**
 * Tauri API adapter — provides the same `window.electronAPI` interface
 * that the existing renderer and config UI code expects, but backed
 * by Tauri invoke() calls instead of Electron IPC.
 *
 * Include this script BEFORE renderer.bundle.js or settings.bundle.js.
 * It is only loaded when running under Tauri (no Electron preload).
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Convert an array of local file paths to asset protocol URLs */
function toAssetUrls(paths: string[]): string[] {
    return paths.map(p => convertFileSrc(p));
}

export interface TauriBridgeApi {
    closeScreensaver: () => void;
    getImages: () => Promise<string[]>;
    getConfig: () => Promise<any>;
    browseDirectory: () => Promise<string | null>;
    validateDirectory: (directory: string) => Promise<boolean>;
    getPreviewImages: (directory: string) => Promise<{
        allImages: string[];
        totalCount: number;
    }>;
    applyConfig: (config: any) => Promise<void>;
    saveConfig: (config: any) => Promise<void>;
    closeConfigWindow: () => void;
    getLogPath: () => Promise<string>;
}

const tauriAPI: TauriBridgeApi = {
    closeScreensaver: () => {
        getCurrentWindow().close();
    },

    getImages: async () => {
        const paths = await invoke<string[]>('get_images');
        return toAssetUrls(paths);
    },

    getConfig: () => invoke('get_config'),

    browseDirectory: async () => {
        const selected = await open({ directory: true, multiple: false });
        if (typeof selected === 'string') return selected;
        return null;
    },

    validateDirectory: (directory: string) =>
        invoke<boolean>('validate_directory', { directory }),

    getPreviewImages: async (directory: string) => {
        const result = await invoke<{ allImages: string[]; totalCount: number }>('get_preview_images', { directory });
        return {
            allImages: toAssetUrls(result.allImages),
            totalCount: result.totalCount,
        };
    },

    applyConfig: (config: any) =>
        invoke('apply_config', { newConfig: config }).then(() => {}),

    saveConfig: (config: any) =>
        invoke('save_config', { newConfig: config }).then(() => {}),

    closeConfigWindow: () => {
        getCurrentWindow().close();
    },

    getLogPath: () => invoke<string>('get_log_path'),
};

// Expose as window.electronAPI so existing code works unchanged
(window as any).electronAPI = tauriAPI;
