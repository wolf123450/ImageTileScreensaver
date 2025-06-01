import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object

export type ContextBridgeApi = {
    closeScreensaver: () => void;
    getImages: () => Promise<string[]>;
    getConfig: () => Promise<any>;
    // Configuration-related methods
    browseDirectory: () => Promise<string | null>;
    validateDirectory: (directory: string) => Promise<boolean>;
    /**
     * Gets all images from a directory
     * @param directory Directory to scan for images
     * @returns Object with all images and total count
     */
    getPreviewImages: (
        directory: string
    ) => Promise<{
        allImages: string[], 
        totalCount: number
    }>;
    applyConfig: (config: any) => Promise<void>;
    saveConfig: (config: any) => Promise<void>;
    closeConfigWindow: () => void;
    getLogPath: () => Promise<string>; // New method for getting log path
};

const exposedAPI: ContextBridgeApi = {
    closeScreensaver: () => ipcRenderer.send('close-screensaver'),
    getImages: () => ipcRenderer.invoke('get-images'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    // Configuration-related methods
    browseDirectory: () => ipcRenderer.invoke('browse-directory'),
    validateDirectory: (directory) => ipcRenderer.invoke('validate-directory', directory),
    getPreviewImages: (directory) => 
        ipcRenderer.invoke('get-preview-images', directory),
    applyConfig: (config) => ipcRenderer.invoke('apply-config', config),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    closeConfigWindow: () => ipcRenderer.send('close-config-window'),
    getLogPath: () => ipcRenderer.invoke('get-log-path') // Expose new method
};

contextBridge.exposeInMainWorld(
  'electronAPI', 
  exposedAPI
);
