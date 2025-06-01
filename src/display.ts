import { app, BrowserWindow, screen } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.bundle.js'),
            contextIsolation: true,
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

/**
 * Interface representing display monitor information
 */
export interface DisplayInfo {
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor?: number;
  isPrimary?: boolean;
}

/**
 * Gets information about all connected displays
 */
export function getAllDisplays(): Promise<DisplayInfo[]> {
  // This would typically use Electron's screen API
  // For now, returning a placeholder implementation
  return Promise.resolve([
    {
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      isPrimary: true
    }
  ]);
}