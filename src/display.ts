import { app, BrowserWindow, screen } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.js'),
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

// Basic display manager for the screensaver
export interface DisplayInfo {
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export function getDisplays(): DisplayInfo[] {
  const displays = screen.getAllDisplays();
  
  return displays.map((display, index) => ({
    id: index + 1,
    bounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    }
  }));
}

export function positionElementOnDisplay(element: HTMLElement, display: DisplayInfo): void {
  // Position an element on the specified display
  element.style.position = 'absolute';
  element.style.left = `${display.bounds.x}px`;
  element.style.top = `${display.bounds.y}px`;
  element.style.width = `${display.bounds.width}px`;
  element.style.height = `${display.bounds.height}px`;
}