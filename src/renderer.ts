import './types';
import { Pattern } from './patterns';
import { PatternFactory } from './patterns/pattern-factory';
import type { ScreensaverConfig } from './types';

// Image array to store all loaded images
let images: string[] = [];
let displayId: number = 0;
let displayCount: number = 1;
let currentPattern: Pattern | null = null;

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

// Display a sample image when no images are found
function displaySampleImage() {
  console.log('No images found, displaying sample image');
  
  const container = document.getElementById('image-container');
  if (!container) return;
  
  // Clean up any existing pattern
  if (currentPattern) {
    currentPattern.cleanup();
    currentPattern = null;
  }
  
  // Clear any existing content
  container.innerHTML = '';
  
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

  document.addEventListener('mousedown', (event) => {
    console.log('Mouse down at:', event.clientX, event.clientY);
    window.electronAPI.closeScreensaver();
  }, true);

  // Track initial mouse position for movement detection
  let initialX = 0;
  let initialY = 0;
  
  // Set initial position when mouse starts moving
  document.addEventListener('mousemove', (e) => {
    if (initialX === 0 && initialY === 0) {
      initialX = e.clientX;
      initialY = e.clientY;
      return;
    }
    
    // Calculate absolute distance moved
    const deltaX = Math.abs(e.clientX - initialX);
    const deltaY = Math.abs(e.clientY - initialY);
    
    // Allow small mouse movements without exiting (threshold of 5 pixels)
    const threshold = 5;
    if (deltaX > threshold || deltaY > threshold) {
      console.log(`Mouse moved beyond threshold: delta X=${deltaX}, delta Y=${deltaY}`);
      window.electronAPI.closeScreensaver();
    }
  }, true);

  // Also add click handler as a fallback
  document.addEventListener('click', () => {
    console.log('Click detected');
    window.electronAPI.closeScreensaver();
  }, true);

  try {
    // Load configuration
    const config = await window.electronAPI.getConfig();
    
    // Load all images
    images = await window.electronAPI.getImages();
    
    if (images.length === 0) {
      // Fallback to a sample image if no images found
      displaySampleImage();
    } else {
      // Apply the configured pattern
      await applyConfiguredPattern(config);
    }
  } catch (error) {
    console.error('Error loading images:', error);
    displaySampleImage(); // Fallback
  }
});

// Apply the pattern specified in the configuration
async function applyConfiguredPattern(config: ScreensaverConfig) {
  const container = document.getElementById('image-container');
  if (!container || images.length === 0) return;
  
  // Get the pattern name from config, default to 'simple'
  const patternName = config.pattern || 'simple';
  
  console.log(`Applying pattern: ${patternName}`);
  
  // Clean up any existing pattern
  if (currentPattern) {
    currentPattern.cleanup();
  }
  
  // Create a new pattern instance
  currentPattern = PatternFactory.getPattern(patternName);
  
  // Initialize the pattern with configuration
  const patternConfig = {
    ...config,
    displayId: displayId,
    displayCount: displayCount,
    imageFitStyle: config.imageFitStyle || 'cover'
  };
  
  currentPattern.init(patternConfig);
  
  // Apply the pattern to the container
  currentPattern.apply(container, images);
}