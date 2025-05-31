import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object

export type ContextBridgeApi = {
    closeScreensaver: () => void;
    getImages: () => Promise<string[]>;
    getConfig: () => Promise<any>;
};

const exposedAPI: ContextBridgeApi = {
    closeScreensaver: () => ipcRenderer.send('close-screensaver'),
    getImages: () => ipcRenderer.invoke('get-images'),
    getConfig: () => ipcRenderer.invoke('get-config')
    };

contextBridge.exposeInMainWorld(
  'electronAPI', 
  exposedAPI
);
