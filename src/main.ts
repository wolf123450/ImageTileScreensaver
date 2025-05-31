import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { promisify } from 'util';
import { loadConfig, defaultConfig, ScreensaverConfig } from './config';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// For async file operations
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Keep a global reference of the window objects to prevent them from being garbage collected
let screensaverWindows: BrowserWindow[] = [];
let config: ScreensaverConfig = defaultConfig;

function createScreensaverWindows() {
  // Get all displays
  const displays = screen.getAllDisplays();
  
  // Create a window for each display
  displays.forEach((display, index) => {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: true
      },
      fullscreen: true,
      frame: false,
      show: false // Don't show until ready
    });

    // Load the index.html file with a query parameter for display identification
    win.loadURL(
      url.format({
        pathname: path.join(__dirname, '../index.html'),
        protocol: 'file:',
        slashes: true,
        query: { 
          displayId: index,
          displayCount: displays.length
        }
      })
    );

    // Show window when content has loaded
    win.once('ready-to-show', () => {
      win.show();
    });

    // Handle window close event
    win.on('closed', () => {
      screensaverWindows = screensaverWindows.filter(w => w !== win);
      
      // If all windows are closed, quit the app
      if (screensaverWindows.length === 0) {
        app.quit();
      }
    });

    screensaverWindows.push(win);
  });

  console.log(process.env.NODE_ENV);
  // Open DevTools in development mode (only on primary display)
  if (process.env.NODE_ENV === 'development' && screensaverWindows.length > 0) {
    screensaverWindows[0].webContents.openDevTools();
  }
}

// Listen for the close-screensaver event from the renderer
ipcMain.on('close-screensaver', () => {
  console.log('Closing screensaver due to user input');
  closeAllScreensaverWindows();
});

function closeAllScreensaverWindows() {
  screensaverWindows.forEach(win => {
    if (!win.isDestroyed()) {
      win.close();
    }
  });
  screensaverWindows = [];
}

// Get all images from the configured directory
async function getImageFiles(directory: string): Promise<string[]> {
  try {
    const files = await readdir(directory);
    const imageFiles: string[] = [];
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const fileStat = await stat(filePath);
      
      if (fileStat.isFile()) {
        // Check if the file has an image extension
        const ext = path.extname(file).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) {
          imageFiles.push(filePath);
          console.log(`Found image: ${filePath}`);
        }
      }
    }
    
    return imageFiles;
  } catch (error) {
    console.error('Error reading image directory:', error);
    return [];
  }
}

// Handle IPC for getting images
ipcMain.handle('get-images', async () => {
  return await getImageFiles(path.resolve(config.imageFolder));
});

// Handle IPC for getting config
ipcMain.handle('get-config', () => {
  return config;
});

// Handle Windows screensaver command line arguments
function handleWindowsScreensaverArgs() {
  const args = process.argv;
  console.log("Command line arguments:", args);
  
  // Windows screensaver command line arguments:
  // /s - Run the screensaver (normal mode)
  // /c - Show the configuration dialog
  // /p <HWND> - Preview the screensaver in the given window
  
  if (args.includes('/c')) {
    // Show configuration dialog (will implement later)
    console.log('Configuration mode requested');
    // For the proof of concept, just quit
    app.quit();
    return false;
  } else if (args.includes('/p')) {
    // Preview mode (will implement later)
    console.log('Preview mode requested');
    // For the proof of concept, just quit
    app.quit();
    return false;
  } else if (args.includes('/s') || args.length === 1) {
    console.log('Running as screensaver');
    // Run as screensaver or normal app
    return true;
  }
  
  console.log('No valid screensaver arguments found, running normally');
  // Default to running normally
  return true;
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  // Load the config
  config = loadConfig();
  
  // Process command line arguments for image directory
  const args = process.argv;
  const dirArgIndex = args.findIndex(arg => arg === '--dir' || arg === '-d');
  if (dirArgIndex >= 0 && dirArgIndex < args.length - 1) {
    config.imageFolder = args[dirArgIndex + 1];
  }
  
  console.log("handling Windows screensaver args");
  // Only create windows if we should run in screensaver mode
  if (handleWindowsScreensaverArgs()) {
    createScreensaverWindows();
  }
});

// Quit when all windows are closed - simplified for both Windows and macOS
app.on('window-all-closed', () => {
  app.quit();
});

// This keeps compatibility with macOS
app.on('activate', () => {
  if (screensaverWindows.length === 0) {
    createScreensaverWindows();
  }
});
