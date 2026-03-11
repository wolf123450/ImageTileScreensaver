import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { promisify } from 'util';
import { loadConfig, defaultConfig, ScreensaverConfig, saveConfig } from './config';
import dotenv from 'dotenv';
import logger from './logger';

// Initialize dotenv
dotenv.config();

// Log application startup
logger.info('Application starting', { 
  version: app.getVersion(),
  environment: process.env.NODE_ENV || 'production',
  platform: process.platform
});

// For async file operations
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Keep a global reference of the window objects to prevent them from being garbage collected
let screensaverWindows: BrowserWindow[] = [];
let config: ScreensaverConfig = defaultConfig;
let configWindow: BrowserWindow | null = null;

function createScreensaverWindows() {
  logger.info('Creating screensaver windows');
  // Get all displays
  const displays = screen.getAllDisplays();
  logger.debug(`Found ${displays.length} displays`, { displays: displays.map(d => ({ 
    id: d.id, 
    bounds: d.bounds, 
    scaleFactor: d.scaleFactor 
  }))});
  
  // Create a window for each display
  displays.forEach((display, index) => {
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        preload: path.join(__dirname, 'preload.bundle.js'),
        nodeIntegration: false,
        contextIsolation: true
      },
      fullscreen: true,
      frame: false,
      show: false // Don't show until ready
    });

    // Load the index.html file with a query parameter for display identification
    win.loadURL(
      url.format({
        pathname: path.join(__dirname, 'index.html'),
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
      logger.debug(`Window for display ${index} ready to show`);
      win.show();
    });

    // Handle window close event
    win.on('closed', () => {
      logger.debug(`Window for display ${index} closed`);
      screensaverWindows = screensaverWindows.filter(w => w !== win);
      
      // If all windows are closed, quit the app
      if (screensaverWindows.length === 0) {
        logger.info('All windows closed, quitting app');
        app.quit();
      }
    });

    screensaverWindows.push(win);
  });

  logger.debug(`NODE_ENV: ${process.env.NODE_ENV}`);
  // Open DevTools in development mode (only on primary display)
  if (process.env.NODE_ENV === 'development' && screensaverWindows.length > 0) {
    logger.debug('Opening DevTools on primary display');
    screensaverWindows[0].webContents.openDevTools();
  }
}

// Listen for the close-screensaver event from the renderer
ipcMain.on('close-screensaver', () => {
  logger.info('Closing screensaver due to user input');
  closeAllScreensaverWindows();
});

function closeAllScreensaverWindows() {
  logger.debug(`Closing ${screensaverWindows.length} screensaver windows`);
  screensaverWindows.forEach(win => {
    if (!win.isDestroyed()) {
      win.close();
    }
  });
  screensaverWindows = [];
}

// Get all images from the configured directory
async function getImageFiles(directory: string): Promise<{images: string[], totalCount: number}> {
  logger.debug(`Scanning for images in: ${directory}`);
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
        }
      }
    }
    
    logger.info(`Found ${imageFiles.length} image files in ${directory}`);
    return { 
      images: imageFiles, 
      totalCount: imageFiles.length 
    };
  } catch (error) {
    logger.error(`Error reading image directory: ${directory}`, { error });
    return { 
      images: [], 
      totalCount: 0 
    };
  }
}

// Handle IPC for getting images
ipcMain.handle('get-images', async () => {
  logger.debug('IPC: get-images called');
  const imageFolder = path.resolve(config.imageFolder);
  logger.debug(`Getting images from: ${imageFolder}`);
  const result = await getImageFiles(imageFolder);
  return result.images; // Maintain backward compatibility
});

// Handle IPC for getting config
ipcMain.handle('get-config', () => {
  logger.debug('IPC: get-config called');
  return config;
});

// Create the configuration window
function createConfigWindow() {
  logger.info('Creating configuration window');
  // Check if config window already exists
  if (configWindow) {
    logger.debug('Config window already exists, focusing it');
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 850,
    height: 700,
    title: 'Image Tile Screensaver Configuration',
    webPreferences: {
      preload: path.join(__dirname, 'preload.bundle.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true, // Hide the menu bar
    show: false // Don't show until ready
  });

  // Load the configuration HTML
  // Use URL format with protocol to avoid path resolution issues
  const configPath = url.format({
    pathname: path.join(__dirname, 'configui', 'screensaver-settings.html'), // Updated filename
    protocol: 'file:',
    slashes: true
  });
  
  logger.debug(`Loading config UI from: ${configPath}`);
  configWindow.loadURL(configPath);

  // Show window when content has loaded
  configWindow.once('ready-to-show', () => {
    logger.debug('Config window ready to show');
    configWindow?.show();
  });

  // Handle window close
  configWindow.on('closed', () => {
    logger.debug('Config window closed');
    configWindow = null;
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Opening DevTools on config window');
    configWindow.webContents.openDevTools();
  }
}

// Handle Windows screensaver command line arguments
function handleWindowsScreensaverArgs() {
  const args = process.argv;
  logger.info('Command line arguments', { args });
  
  // Windows screensaver command line arguments:
  // /s - Run the screensaver (normal mode)
  // /c - Show the configuration dialog without a parent window
  // /c:<HWND> - Show the configuration dialog with the specified parent window
  // /p <HWND> - Preview the screensaver in the given window
  
  // Check for configuration mode
  const configArgIndex = args.findIndex(arg => 
    arg === '/c' || arg.startsWith('/c:') || 
    arg === '-c' || arg.startsWith('-c:'));
  
  if (configArgIndex >= 0) {
    const configArg = args[configArgIndex];
    const parentHwnd = configArg.includes(':') ? configArg.split(':')[1] : null;
    
    logger.info('Configuration mode requested', { parentHwnd });
    
    if (parentHwnd) {
      logger.debug(`Parent window handle provided: ${parentHwnd}`);
      // We can use this in the future if we need to make the config window modal to the parent
      // For now, we'll just create the config window normally
    }
    
    createConfigWindow();
    return false;
  } else if (args.includes('/p') || args.some(arg => arg.startsWith('/p:'))) {
    // Preview mode handling - handle both /p and /p:HWND format
    const previewArgIndex = args.findIndex(arg => arg === '/p' || arg.startsWith('/p:'));
    let previewHwnd: string | null = null;
    
    if (previewArgIndex >= 0) {
      const previewArg = args[previewArgIndex];
      if (previewArg.includes(':')) {
        // Format is /p:HWND
        previewHwnd = previewArg.split(':')[1];
      } else if (previewArgIndex < args.length - 1) {
        // Format is /p HWND
        previewHwnd = args[previewArgIndex + 1];
      }
    }
    
    logger.info('Preview mode requested', { previewHwnd });
    // For now, just quit as we haven't implemented preview mode yet
    app.quit();
    return false;
  } else if (args.includes('/s') || args.length === 1) {
    logger.info('Running as screensaver');
    // Run as screensaver or normal app
    return true;
  }
  
  logger.info('No valid screensaver arguments found, running normally');
  // Default to running normally
  return true;
}

// Add IPC handlers for configuration
ipcMain.handle('browse-directory', async () => {
  logger.debug('IPC: browse-directory called');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    logger.debug('Directory selection canceled');
    return null;
  }
  
  logger.debug(`Directory selected: ${result.filePaths[0]}`);
  return result.filePaths[0];
});

ipcMain.handle('validate-directory', async (_, directory) => {
  logger.debug(`IPC: validate-directory called for ${directory}`);
  try {
    const stats = await fs.promises.stat(directory);
    const isValid = stats.isDirectory();
    logger.debug(`Directory validation result: ${isValid}`);
    return isValid;
  } catch (error) {
    logger.error(`Error validating directory: ${directory}`, { error });
    return false;
  }
});

// Handle IPC for getting preview images - modified to support frontend pagination
ipcMain.handle('get-preview-images', async (_, directory) => {
  logger.debug(`IPC: get-preview-images called for ${directory}`);
  try {
    // Get all images from the directory at once
    const result = await getImageFiles(directory);
    
    // Return all images and total count
    return { 
      allImages: result.images,
      totalCount: result.totalCount
    };
  } catch (error) {
    logger.error(`Error getting preview images from ${directory}`, { error });
    return { 
      allImages: [], 
      totalCount: 0
    };
  }
});

ipcMain.handle('apply-config', async (_, newConfig) => {
  logger.info('IPC: apply-config called', { newConfig });
  try {
    // Apply configuration without saving to disk
    config = { ...config, ...newConfig };
    return true;
  } catch (error) {
    logger.error('Error applying configuration', { error });
    throw error;
  }
});

ipcMain.handle('save-config', async (_, newConfig) => {
  logger.info('IPC: save-config called', { newConfig });
  try {
    // Update current config
    config = { ...config, ...newConfig };
    
    // Save to disk using the config module
    await saveConfig(config);
    logger.info('Configuration saved successfully');
    
    return true;
  } catch (error) {
    logger.error('Error saving configuration', { error });
    throw error;
  }
});

ipcMain.on('close-config-window', () => {
  logger.debug('IPC: close-config-window called');
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.close();
  }
  configWindow = null;
});

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  logger.info('Electron app is ready');
  // Load the config
  config = loadConfig();
  logger.info('Configuration loaded', { config });
  
  // Process command line arguments for image directory
  const args = process.argv;
  const dirArgIndex = args.findIndex(arg => arg === '--dir' || arg === '-d');
  if (dirArgIndex >= 0 && dirArgIndex < args.length - 1) {
    const dirFromArgs = args[dirArgIndex + 1];
    logger.info(`Using image directory from command line: ${dirFromArgs}`);
    config.imageFolder = dirFromArgs;
  }
  
  logger.debug("Handling Windows screensaver args");
  // Only create windows if we should run in screensaver mode
  if (handleWindowsScreensaverArgs()) {
    createScreensaverWindows();
  }
});

// Add an IPC handler to get the log file path
ipcMain.handle('get-log-path', () => {
  const logPath = logger.getLogPath();
  logger.debug(`IPC: get-log-path called, returning ${logPath}`);
  return logPath;
});

// Quit when all windows are closed - simplified for both Windows and macOS
app.on('window-all-closed', () => {
  logger.info('All windows closed, quitting application');
  app.quit();
});

// This keeps compatibility with macOS
app.on('activate', () => {
  logger.info('App activated');
  if (screensaverWindows.length === 0) {
    createScreensaverWindows();
  }
});

// Log unhandled exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
