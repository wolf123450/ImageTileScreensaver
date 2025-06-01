// This file should augment the properties of the `Window` with the type of the
// `ContextBridgeApi` from `Electron.contextBridge` declared in `src/preload.ts`.
import type { ContextBridgeApi } from './preload'
import { ImageLayout } from './patterns';

declare global {
  interface Window {
    electronAPI: ContextBridgeApi
  }
}

// Image array to store all loaded images
let images: string[] = [];
let currentImageIndex = 0;
let changeInterval: number = 10000; // Default 10 seconds
let displayId: number = 0;
let displayCount: number = 1;

console.log('Renderer process started, setting up event listeners and loading images');

// Parse query parameters to get display information
function getQueryParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const queryString = window.location.search.substring(1);
  const pairs = queryString.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  
  return params;
}

// Once the DOM is loaded, load and display images
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, setting up event listeners');
  
  // Get display information from query parameters
  const params = getQueryParams();
  displayId = parseInt(params.displayId || '0', 10);
  displayCount = parseInt(params.displayCount || '1', 10);
  
  console.log(`This is display ${displayId} of ${displayCount} displays`);
  
  // Set up event listeners first to ensure they're active immediately
  // Exit on any key or mouse activity (standard screensaver behavior)
  document.addEventListener('keydown', (event) => {
    console.log('Key pressed:', event.key);
    window.electronAPI.closeScreensaver();
  }, true); // Use capturing to ensure event gets processed early

  // document.addEventListener('mousedown', (event) => {
  //   console.log('Mouse down at:', event.clientX, event.clientY);
  //   window.electronAPI.closeScreensaver();
  // }, true);

  // Track initial mouse position for movement detection
  let initialX = 0;
  let initialY = 0;
  
  // Set initial position when mouse starts moving
  // document.addEventListener('mousemove', (e) => {
  //   if (initialX === 0 && initialY === 0) {
  //     initialX = e.clientX;
  //     initialY = e.clientY;
  //     return;
  //   }
    
  //   // Calculate absolute distance moved
  //   const deltaX = Math.abs(e.clientX - initialX);
  //   const deltaY = Math.abs(e.clientY - initialY);
    
  //   // Allow small mouse movements without exiting (threshold of 5 pixels)
  //   const threshold = 5;
  //   if (deltaX > threshold || deltaY > threshold) {
  //     console.log(`Mouse moved beyond threshold: delta X=${deltaX}, delta Y=${deltaY}`);
  //     window.electronAPI.closeScreensaver();
  //   }
  // }, true);

  // Also add click handler as a fallback
  document.addEventListener('click', () => {
    console.log('Click detected');
    window.electronAPI.closeScreensaver();
  }, true);

  try {
    // Load configuration
    const config = await window.electronAPI.getConfig();
    changeInterval = config.changeInterval || 10000;
    
    // Load all images
    images = await window.electronAPI.getImages();
    
    if (images.length === 0) {
      // Fallback to a sample image if no images found
      displaySampleImage();
    } else {
      // Start the image slideshow based on display ID
      displayNextImage();
      
      // Only set up the interval for simple pattern, not for grid pattern
      if (config.pattern !== 'grid') {
        console.log(`Setting up interval for simple pattern: ${changeInterval}ms`);
        setInterval(displayNextImage, changeInterval);
      } else {
        console.log('Grid pattern active, not setting up displayNextImage interval');
        // Grid pattern refresh is managed by its own timers in setupGridRefreshTimers
      }
    }
  } catch (error) {
    console.error('Error loading images:', error);
    displaySampleImage(); // Fallback
  }
});

// Keep track of grid refresh timers
let gridRefreshTimers: NodeJS.Timeout[] = [];
let gridCells: HTMLDivElement[] = [];

// Add a function to apply the grid pattern
async function applyGridPattern(container: HTMLElement, imageUrls: string[], config = { rows: 2, cols: 3, spacing: 10 }) {
  console.log(`Applying grid pattern: ${config.rows}x${config.cols} with ${config.spacing}px spacing`);
  
  // Clear the container
  container.innerHTML = '';
  
  // Clear any existing grid refresh timers
  clearGridRefreshTimers();
  
  // Reset grid cells array
  gridCells = [];
  
  // Get container dimensions
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // Calculate cell dimensions
  const cellSpacing = config.spacing;
  const cellWidth = (containerWidth - (cellSpacing * (config.cols - 1))) / config.cols;
  const cellHeight = (containerHeight - (cellSpacing * (config.rows - 1))) / config.rows;
  
  // Set container to be a grid
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
  container.style.gridTemplateRows = `repeat(${config.rows}, 1fr)`;
  container.style.gap = `${cellSpacing}px`;
  container.style.padding = '0';
  
  // Create grid cells with random images
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const cellIndex = row * config.cols + col;
      
      // Select a random image for initial display
      const randomImageIndex = Math.floor(Math.random() * imageUrls.length);
      
      // Create cell container
      const cell = document.createElement('div');
      cell.style.width = '100%';
      cell.style.height = '100%';
      cell.style.overflow = 'hidden';
      cell.style.position = 'relative'; // Set position relative initially
      cell.dataset.cellIndex = cellIndex.toString();
      
      // Create image
      const img = document.createElement('img');
      img.src = imageUrls[randomImageIndex];
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.transition = 'opacity 0.5s ease-in-out';
      
      cell.appendChild(img);
      container.appendChild(cell);
      
      // Store the cell for later updates
      gridCells.push(cell);
    }
  }
  
  // Calculate the interval for replacing individual images
  const totalCells = config.rows * config.cols;
  const individualRefreshInterval = changeInterval / totalCells;
  
  // Set up timers to replace images one by one
  setupGridRefreshTimers(imageUrls, individualRefreshInterval);
}

// Set up timers to refresh grid images one at a time
function setupGridRefreshTimers(imageUrls: string[], interval: number) {
  if (gridCells.length === 0 || imageUrls.length === 0) return;
  
  console.log(`Setting up grid refresh with interval: ${interval}ms per cell, total cells: ${gridCells.length}`);
  
  // Clear any existing timers to avoid conflicts
  clearGridRefreshTimers();
  
  // Initial staggered replacement of random images
  for (let i = 0; i < gridCells.length; i++) {
    // Initial delay to start the sequence
    const initialTimer = setTimeout(() => {
      console.log(`Initial staggered update for cell ${i}`);
      // Replace a random image at a random position
      replaceRandomGridImage(imageUrls);
    }, i * interval);
    
    gridRefreshTimers.push(initialTimer);
  }
  
  // Set a single interval timer that will replace one random image at a time
  // This avoids the reset pattern by not having multiple independent timers
  const continuousTimer = setInterval(() => {
    console.log(`Continuous timer triggered at ${new Date().toISOString()}`);
    replaceRandomGridImage(imageUrls);
  }, interval);
  
  console.log(`Set continuous timer with ID: ${continuousTimer}, interval: ${interval}ms`);
  gridRefreshTimers.push(continuousTimer);
}

// Replace a random image in the grid with a new random image
function replaceRandomGridImage(imageUrls: string[]) {
  if (gridCells.length === 0 || imageUrls.length === 0) return;
  
  // Select a random cell
  const randomCellIndex = Math.floor(Math.random() * gridCells.length);
  const cell = gridCells[randomCellIndex];
  
  console.log(`Replacing image in cell ${randomCellIndex}`);
  
  // Select a random image that's different from the current one
  const img = cell.querySelector('img') as HTMLImageElement;
  const currentSrc = img.src;
  let newImageSrc = currentSrc;
  
  // Make sure we pick a different image
  while (newImageSrc === currentSrc && imageUrls.length > 1) {
    const randomImageIndex = Math.floor(Math.random() * imageUrls.length);
    newImageSrc = imageUrls[randomImageIndex];
  }
  
  // Create and add the new image with a fade effect
  const newImg = document.createElement('img');
  newImg.src = newImageSrc;
  newImg.style.width = '100%';
  newImg.style.height = '100%';
  newImg.style.objectFit = 'cover';
  newImg.style.opacity = '0';
  newImg.style.position = 'absolute';
  newImg.style.top = '0';
  newImg.style.left = '0';
  newImg.style.transition = 'opacity 0.5s ease-in-out';
  
  // Make sure cell has relative positioning for absolute child positioning
  cell.style.position = 'relative';
  
  // Add the new image
  cell.appendChild(newImg);
  
  // Trigger reflow to ensure transition works
  void newImg.offsetWidth;
  
  // Fade in new image
  newImg.style.opacity = '1';
  
  // Fade out and remove the old image after transition completes
  setTimeout(() => {
    img.style.opacity = '0';
    setTimeout(() => {
      // Check if the image is still a child of the cell before removing it
      if (img.parentNode === cell) {
        cell.removeChild(img);
      } else {
        console.log(`Image already removed from cell ${randomCellIndex}`);
      }
    }, 500);
  }, 0);
}

// Clear any existing grid refresh timers
function clearGridRefreshTimers() {
  console.log(`Clearing ${gridRefreshTimers.length} grid refresh timers`);
  
  gridRefreshTimers.forEach(timer => {
    console.log(`Clearing timer ID: ${timer}`);
    clearTimeout(timer);
    clearInterval(timer);
  });
  
  gridRefreshTimers = [];
  console.log('Grid refresh timers cleared');
}

// Display an image by its index in the images array
function displayImageByIndex(index: number) {
  if (images.length === 0) return;
  
  // Get the container
  const container = document.getElementById('image-container');
  if (!container) return;
  
  // Clear previous content and any grid timers
  container.innerHTML = '';
  clearGridRefreshTimers();
  
  // Reset container styles (in case it was previously a grid)
  container.style.display = 'flex';
  container.style.gridTemplateColumns = '';
  container.style.gridTemplateRows = '';
  container.style.gap = '';
  
  // Create and display the image
  const img = document.createElement('img');
  img.src = images[index];
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  
  // Add fade-in effect
  img.style.opacity = '0';
  img.style.transition = 'opacity 1s ease-in-out';
  container.appendChild(img);
  
  // Trigger reflow to ensure transition works
  void img.offsetWidth;
  
  // Fade in
  img.style.opacity = '1';
}

// Display a sample image when no images are found
function displaySampleImage() {
  console.log('No images found, displaying sample image');
  
  const container = document.getElementById('image-container');
  if (!container) return;
  
  // Clear any existing content
  container.innerHTML = '';
  clearGridRefreshTimers();
  
  // Create a placeholder div
  const placeholderDiv = document.createElement('div');
  placeholderDiv.style.width = '100%';
  placeholderDiv.style.height = '100%';
  placeholderDiv.style.display = 'flex';
  placeholderDiv.style.flexDirection = 'column';
  placeholderDiv.style.justifyContent = 'center';
  placeholderDiv.style.alignItems = 'center';
  placeholderDiv.style.backgroundColor = '#000';
  placeholderDiv.style.color = '#fff';
  placeholderDiv.style.fontFamily = 'Arial, sans-serif';
  
  // Add message text
  const messageText = document.createElement('h2');
  messageText.textContent = 'No images found';
  messageText.style.marginBottom = '20px';
  
  // Add help text
  const helpText = document.createElement('p');
  helpText.textContent = 'Please add images to your configured folders and restart the screensaver.';
  
  // Add elements to the container
  placeholderDiv.appendChild(messageText);
  placeholderDiv.appendChild(helpText);
  container.appendChild(placeholderDiv);
}

function displayNextImage() {
  if (images.length === 0) return;
  
  // Get the container
  const container = document.getElementById('image-container');
  if (!container) return;
  
  console.log(`displayNextImage called at ${new Date().toISOString()}`);
  
  // Get current configuration
  window.electronAPI.getConfig().then(config => {
    // Check which pattern to use
    if (config.pattern === 'grid') {
      console.log('Using grid pattern');
      // Clear any existing timers when changing patterns
      clearGridRefreshTimers();
      
      // Use the grid pattern
      // Get the grid configuration
      const gridConfig = { 
        rows: config.gridRows || 2, 
        cols: config.gridCols || 3,
        spacing: config.gridSpacing || 10
      };
      
      // Apply the grid pattern
      applyGridPattern(container, images, gridConfig);
    } else {
      // Clear any grid timers when switching to a different pattern
      clearGridRefreshTimers();
      
      // Use the simple pattern (existing code)
      currentImageIndex = (currentImageIndex + 1) % images.length;
      const adjustedIndex = (currentImageIndex + displayId) % images.length;
      displayImageByIndex(adjustedIndex);
    }
  }).catch(error => {
    console.error('Error getting configuration:', error);
    // Fall back to simple pattern
    clearGridRefreshTimers();
    currentImageIndex = (currentImageIndex + 1) % images.length;
    const adjustedIndex = (currentImageIndex + displayId) % images.length;
    displayImageByIndex(adjustedIndex);
  });
}