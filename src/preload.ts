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
    getPreviewImages: (directory: string, count: number) => Promise<string[]>;
    applyConfig: (config: any) => Promise<void>;
    saveConfig: (config: any) => Promise<void>;
    closeConfigWindow: () => void;
};

const exposedAPI: ContextBridgeApi = {
    closeScreensaver: () => ipcRenderer.send('close-screensaver'),
    getImages: () => ipcRenderer.invoke('get-images'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    // Configuration-related methods
    browseDirectory: () => ipcRenderer.invoke('browse-directory'),
    validateDirectory: (directory) => ipcRenderer.invoke('validate-directory', directory),
    getPreviewImages: (directory, count) => ipcRenderer.invoke('get-preview-images', directory, count),
    applyConfig: (config) => ipcRenderer.invoke('apply-config', config),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    closeConfigWindow: () => ipcRenderer.send('close-config-window')
    };

contextBridge.exposeInMainWorld(
  'electronAPI', 
  exposedAPI
);
