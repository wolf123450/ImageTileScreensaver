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

//   document.addEventListener('mousedown', (event) => {
//     console.log('Mouse down at:', event.clientX, event.clientY);
//     window.electronAPI.closeScreensaver();
//   }, true);

  // Track initial mouse position for movement detection
  let initialX = 0;
  let initialY = 0;
  
  // Set initial position when mouse starts moving
//   document.addEventListener('mousemove', (e) => {
//     if (initialX === 0 && initialY === 0) {
//       initialX = e.clientX;
//       initialY = e.clientY;
//       return;
//     }
    
//     // Calculate absolute distance moved
//     const deltaX = Math.abs(e.clientX - initialX);
//     const deltaY = Math.abs(e.clientY - initialY);
    
//     // Allow small mouse movements without exiting (threshold of 5 pixels)
//     const threshold = 5;
//     if (deltaX > threshold || deltaY > threshold) {
//       console.log(`Mouse moved beyond threshold: delta X=${deltaX}, delta Y=${deltaY}`);
//       window.electronAPI.closeScreensaver();
//     }
//   }, true);

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
      // Set up interval to change images
      setInterval(displayNextImage, changeInterval);
    }
  } catch (error) {
    console.error('Error loading images:', error);
    displaySampleImage(); // Fallback
  }
});

function displayNextImage() {
  if (images.length === 0) return;
  
  // Cycle through all available images
  currentImageIndex = (currentImageIndex + 1) % images.length;
  
  // Display image based on the current display ID
  // Each display gets a different image in the sequence
  const adjustedIndex = (currentImageIndex + displayId) % images.length;
  displayImageByIndex(adjustedIndex);
}

function displayImageByIndex(index: number) {
  if (index >= 0 && index < images.length) {
    const container = document.getElementById('image-container');
    if (!container) return;
    
    // Clear previous image
    container.innerHTML = '';
    
    // Create an image element
    const img = document.createElement('img');
    img.src = images[index];
    
    // Set styles to fit the window
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    
    // Display the image
    container.appendChild(img);
  }
}

function displaySampleImage() {
  // Load and display a sample image
  const container = document.getElementById('image-container');
  
  // Create an image element
  const img = document.createElement('img');
  
  // Use a placeholder image or a local image path
  img.src = 'assets/sample-image.jpg';
  
  // Set styles to fit the window
  img.style.maxWidth = '100%';
  img.style.maxHeight = '100%';
  img.style.objectFit = 'contain';
  
  // Display the image
  if (container) {
    container.appendChild(img);
  }
}