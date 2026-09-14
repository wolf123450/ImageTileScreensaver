import './types';
import { Pattern } from './patterns';
import { PatternFactory } from './patterns/pattern-factory';
import { MosaicPattern } from './patterns/mosaic-pattern';
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
  // Pass ?debug=1 in the URL to disable exit-on-input for debugging
  const debugMode = params.debug === '1';
  if (debugMode) {
    console.log('DEBUG MODE: exit-on-input disabled. Press Escape or Q to exit.');
  }

  // Debug info panel
  let debugPanel: HTMLDivElement | null = null;
  let debugUpdateTimer: number | null = null;

  function createDebugPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
      position: fixed; top: 8px; left: 8px; z-index: 99999;
      background: rgba(0,0,0,0.75); color: #0f0; font: 12px monospace;
      padding: 8px 12px; border-radius: 4px; pointer-events: none;
      white-space: pre; line-height: 1.5;
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function updateDebugPanel() {
    if (!debugPanel) return;
    if (currentPattern instanceof MosaicPattern) {
      const s = currentPattern.stats;
      const avg = currentPattern.avgTickTime;
      const cfg = (currentPattern as any).config;
      const zoomPct = (s.currentScale * 100).toFixed(1);
      const lines = [
        `[${s.state.toUpperCase()}]  Tiles: ${s.tilesPlaced}  Cycle: ${s.cycleCount}`,
        `Tick: ${s.lastTickTime.toFixed(1)}ms  Avg: ${avg.toFixed(1)}ms  Stalls: ${s.stallCount}`,
        `Zoom: ${zoomPct}%  (max-out: ${((cfg?.maxZoomOut ?? 0) * 100).toFixed(0)}%)`,
        `Tile screen: ${s.tileScreenPx.toFixed(0)}px  (min: ${s.minTileScreenPx}px)`,
        `World: ${s.worldW.toFixed(0)} x ${s.worldH.toFixed(0)}`,
      ];
      if (s.plannerMode) {
        lines.push(`Planner: ${s.plannedRemaining} tiles remaining`);
      } else {
        lines.push(`Buffer: ${s.bufferCurrent}/${s.bufferMax}  Avail: ${s.bufferAvailable}/${s.bufferTotal}`);
      }
      lines.push(`Dist: ${cfg?.colorDistanceFn ?? '?'}  Src: ${cfg?.colorSource ?? '?'}  Speed: ${cfg?.placementSpeed ?? '?'}ms`);
      if (s.refWidth > 0) {
        const coverage = s.worldW > 0 && s.refWorldW > 0
          ? ((s.worldW * s.worldH) / (s.refWorldW * s.refWorldH) * 100).toFixed(0)
          : '?';
        lines.push(`Ref img: ${s.refWidth}x${s.refHeight}px  World: ${s.refWorldW.toFixed(0)}x${s.refWorldH.toFixed(0)}`);
        lines.push(`Tiles cover: ${coverage}% of ref  ...${s.referenceImage.slice(-35)}`);
      }
      debugPanel.textContent = lines.join('\n');
    } else {
      debugPanel.textContent = `Pattern: ${currentPattern?.name ?? 'none'}`;
    }
  }

  function toggleDebugPanel() {
    if (debugPanel) {
      debugPanel.remove();
      debugPanel = null;
      if (debugUpdateTimer !== null) {
        window.clearInterval(debugUpdateTimer);
        debugUpdateTimer = null;
      }
    } else {
      debugPanel = createDebugPanel();
      updateDebugPanel();
      debugUpdateTimer = window.setInterval(updateDebugPanel, 250);
    }
  }

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (debugMode && key === 'd') {
      toggleDebugPanel();
      return;
    }
    if (debugMode && key === 'r') {
      if (currentPattern instanceof MosaicPattern) {
        currentPattern.toggleReferenceOverlay();
      }
      return;
    }
    if (debugMode && key !== 'escape' && key !== 'q') return;
    console.log('Key pressed:', event.key);
    window.electronAPI.closeScreensaver();
  }, true); // Use capturing to ensure event gets processed early

  document.addEventListener('mousedown', (event) => {
    if (debugMode) return;
    console.log('Mouse down at:', event.clientX, event.clientY);
    window.electronAPI.closeScreensaver();
  }, true);

  // Track initial mouse position for movement detection
  let initialX = 0;
  let initialY = 0;
  
  // Set initial position when mouse starts moving
  document.addEventListener('mousemove', (e) => {
    if (debugMode) return;
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
    if (debugMode) return;
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