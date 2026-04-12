import '../types';
import type { PatternOptions, ScreensaverConfig } from '../types';

const CURRENT_CONFIG_VERSION = 2;

const DEFAULT_CONFIG: ScreensaverConfig = {
    version: CURRENT_CONFIG_VERSION,
    imageFolder: '',
    includeSubdirectories: true,
    changeInterval: 10000,
    pattern: 'simple',
    patternOptions: {},
    multiMonitorSync: false,
    transition: {
        effect: 'fade',
        duration: 1000,
    },
    theme: 'light',
    imageFitStyle: 'cover',
};

let config: ScreensaverConfig = { ...DEFAULT_CONFIG };

// DOM Elements
let tabButtons: NodeListOf<Element>;
let tabPanes: NodeListOf<Element>;
let changeIntervalInput: HTMLInputElement;
let imageDirectoryInput: HTMLInputElement;
let browseDirectoryButton: HTMLButtonElement;
let includeSubdirectoriesCheckbox: HTMLInputElement;
let patternOptions: NodeListOf<Element>;
let multiMonitorSyncCheckbox: HTMLInputElement;
let transitionEffectSelect: HTMLSelectElement;
let transitionDurationInput: HTMLInputElement;
let applyButton: HTMLButtonElement;
let saveButton: HTMLButtonElement;
let cancelButton: HTMLButtonElement;
let doneButton: HTMLButtonElement; // Add done button reference
let resetButton: HTMLButtonElement | null = null;
let directoryStatus: HTMLElement;
let imageCount: HTMLElement;
let previewContainer: HTMLElement;
let themeToggle: HTMLButtonElement; // Add theme toggle button reference
let imageFitStyleSelect: HTMLSelectElement; // Add image fit style select reference
let toastContainer: HTMLDivElement | null = null;

// Add pagination state and image cache
let currentImagePage = 0;
let imagesPerPage = 20; // Changed default from 5 to 20
let totalImageCount = 0;
let cachedImageData: {
    directory: string;
    images: string[];
    totalCount: number;
    isLoading: boolean;
} | null = null;

// Init function to set up the UI when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    setupEventListeners();
    
    try {
        // Load configuration from main process
        const savedConfig = await window.electronAPI.getConfig();
        updateUIFromConfig(savedConfig);
    } catch (error) {
        console.error('Error loading configuration:', error);
        if (window.electronAPI) {
            showErrorMessage('Failed to load configuration settings.');
        } else {
            console.warn('Running outside Tauri — using default configuration values.');
        }
    }
});

// Initialize DOM element references
function initElements(): void {
    tabButtons = document.querySelectorAll('.tab-button');
    tabPanes = document.querySelectorAll('.tab-pane');
    
    changeIntervalInput = document.getElementById('change-interval') as HTMLInputElement;
    imageDirectoryInput = document.getElementById('image-directory') as HTMLInputElement;
    browseDirectoryButton = document.getElementById('browse-directory') as HTMLButtonElement;
    includeSubdirectoriesCheckbox = document.getElementById('include-subdirectories') as HTMLInputElement;
    
    patternOptions = document.querySelectorAll('.pattern-option');
    
    multiMonitorSyncCheckbox = document.getElementById('multi-monitor-sync') as HTMLInputElement;
    transitionEffectSelect = document.getElementById('transition-effect') as HTMLSelectElement;
    transitionDurationInput = document.getElementById('transition-duration') as HTMLInputElement;
    
    applyButton = document.getElementById('apply-button') as HTMLButtonElement;
    saveButton = document.getElementById('save-button') as HTMLButtonElement;
    cancelButton = document.getElementById('cancel-button') as HTMLButtonElement;
    doneButton = document.getElementById('done-button') as HTMLButtonElement; // Initialize done button
    
    directoryStatus = document.getElementById('directory-status') as HTMLElement;
    imageCount = document.getElementById('image-count') as HTMLElement;
    previewContainer = document.getElementById('preview-container') as HTMLElement;
    
    themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
    imageFitStyleSelect = document.getElementById('image-fit-style') as HTMLSelectElement;
}

// Set up event listeners for the UI elements
function setupEventListeners(): void {
    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            activateTab(tabId);
        });
    });
    
    // Directory browsing
    browseDirectoryButton.addEventListener('click', async () => {
        try {
            const directory = await window.electronAPI.browseDirectory();
            if (directory) {
                imageDirectoryInput.value = directory;
                validateDirectory(directory);
            }
        } catch (error) {
            console.error('Error browsing directory:', error);
        }
    });
    
    // Add event listener for manual directory input change
    imageDirectoryInput.addEventListener('change', () => {
        validateDirectory(imageDirectoryInput.value);
    });
    
    // Pattern selection
    patternOptions.forEach(option => {
        option.addEventListener('click', () => {
            const pattern = option.getAttribute('data-pattern');
            selectPattern(pattern);
        });
    });
    
    // Form input validation
    changeIntervalInput.addEventListener('input', () => {
        validateNumberInput(changeIntervalInput, 1, 3600);
    });
    
    transitionDurationInput.addEventListener('input', () => {
        validateNumberInput(transitionDurationInput, 0, 5000);
    });
    
    // Button actions
    applyButton.addEventListener('click', applyChanges);
    saveButton.addEventListener('click', saveChanges);
    cancelButton.addEventListener('click', closeWindow);
    doneButton.addEventListener('click', saveAndClose); // Add done button event listener
    if (resetButton) {
        resetButton.addEventListener('click', resetToDefaults);
    }
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
}

// Update UI with loaded configuration
function updateUIFromConfig(savedConfig: ScreensaverConfig): void {
    config = {
        ...DEFAULT_CONFIG,
        ...savedConfig,
        version: savedConfig.version ?? DEFAULT_CONFIG.version,
        transition: {
            ...DEFAULT_CONFIG.transition,
            ...(savedConfig.transition || {}),
        },
        patternOptions: {
            ...(savedConfig.patternOptions || {}),
        },
        imageFitStyle: savedConfig.imageFitStyle || DEFAULT_CONFIG.imageFitStyle,
    };

    changeIntervalInput.value = (config.changeInterval / 1000).toString();
    imageDirectoryInput.value = config.imageFolder;
    includeSubdirectoriesCheckbox.checked = config.includeSubdirectories;
    selectPattern(config.pattern);
    multiMonitorSyncCheckbox.checked = config.multiMonitorSync;
    transitionEffectSelect.value = config.transition.effect;
    transitionDurationInput.value = config.transition.duration.toString();
    imageFitStyleSelect.value = config.imageFitStyle;
    applyTheme(config.theme);

    if (config.imageFolder) {
        validateDirectory(config.imageFolder, true);
    }
}

// Toggle between light and dark theme
function toggleTheme(): void {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    applyTheme(newTheme);
    config.theme = newTheme;
}

// Apply the selected theme to the document
function applyTheme(theme: string): void {
    document.documentElement.setAttribute('data-theme', theme);
    
    // For accessibility - update the toggle button aria-label
    const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeToggle.setAttribute('aria-label', label);
}

// Validate directory and show preview of images
async function validateDirectory(directory: string, isInitialLoad = false): Promise<void> {
    if (!directory) {
        directoryStatus.textContent = 'Directory is required';
        directoryStatus.className = 'status-message error';
        imageCount.textContent = 'No images found';
        previewContainer.innerHTML = '';
        cachedImageData = null;
        if (!isInitialLoad) {
            showErrorMessage('Please choose an image directory.');
        }
        return;
    }

    try {
        const directoryExists = await window.electronAPI.validateDirectory(directory);
        
        if (directoryExists) {
            directoryStatus.textContent = 'Directory is valid';
            directoryStatus.className = 'status-message success';
            
            // Reset pagination when directory changes
            currentImagePage = 0;
            
            // Only load images if we don't have them cached already
            if (!isInitialLoad || !cachedImageData || cachedImageData.directory !== directory) {
                await loadAllImages(directory);
            } else {
                // If we already have the images cached, just update the UI
                updateImagePreviewsUI();
            }
        } else {
            directoryStatus.textContent = 'Directory does not exist';
            directoryStatus.className = 'status-message error';
            imageCount.textContent = 'No images found';
            previewContainer.innerHTML = '';
            cachedImageData = null;
            if (!isInitialLoad) {
                showErrorMessage('Selected directory does not exist or is not accessible.');
            }
        }
    } catch (error) {
        console.error('Error validating directory:', error);
        directoryStatus.textContent = 'Error validating directory';
        directoryStatus.className = 'status-message error';
        cachedImageData = null;
        if (!isInitialLoad) {
            showErrorMessage('Failed to validate the image directory.');
        }
    }
}

// Load all images from a directory
async function loadAllImages(directory: string): Promise<void> {
    // Show loading state
    imageCount.textContent = 'Loading images...';
    previewContainer.innerHTML = '';
    
    // Set initial loading state
    cachedImageData = {
        directory,
        images: [],
        totalCount: 0,
        isLoading: true
    };
    
    try {
        // Get all images from the directory
        const result = await window.electronAPI.getPreviewImages(directory);
        
        // Update cache with all images
        cachedImageData = {
            directory,
            images: result.allImages,
            totalCount: result.totalCount,
            isLoading: false
        };
        
        totalImageCount = result.totalCount;
        
        // Update UI with the first page
        updateImagePreviewsUI();
        
    } catch (error) {
        console.error('Error loading images:', error);
        imageCount.textContent = 'Error loading images';
        previewContainer.innerHTML = '';
        cachedImageData = null;
    }
}

// Update the UI based on current pagination settings
function updateImagePreviewsUI(): void {
    // Clear the container
    previewContainer.innerHTML = '';
    
    if (!cachedImageData) {
        imageCount.textContent = 'No images found';
        return;
    }
    
    if (cachedImageData.isLoading) {
        imageCount.textContent = 'Loading images...';
        return;
    }
    
    const total = cachedImageData.totalCount;
    
    if (total === 0) {
        imageCount.textContent = 'No images found in this directory';
        return;
    }
    
    // Calculate page bounds
    const startIndex = currentImagePage * imagesPerPage;
    const endIndex = Math.min(startIndex + imagesPerPage, total);
    
    // Display count and pagination info
    imageCount.textContent = `Found ${total} images (showing ${startIndex + 1}-${endIndex})`;
    
    // Get images for the current page
    const pageImages = cachedImageData.images.slice(startIndex, endIndex);
    
    // Create preview thumbnails
    pageImages.forEach(imagePath => {
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = 'Preview';
        img.title = imagePath.split(/[/\\]/).pop() || imagePath; // Handle both slash types
        previewContainer.appendChild(img);
    });
    
    // Add pagination controls if needed
    if (total > imagesPerPage) {
        addPaginationControls();
    }
}

// Add pagination controls to navigate between pages
function addPaginationControls(): void {
    if (!cachedImageData) return;
    
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination-controls';
    
    // Calculate max page correctly
    const maxPage = Math.ceil(cachedImageData.totalCount / imagesPerPage) - 1;
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.disabled = currentImagePage === 0;
    prevButton.addEventListener('click', () => {
        if (currentImagePage > 0) {
            currentImagePage--;
            updateImagePreviewsUI();
        }
    });
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next →';
    nextButton.disabled = currentImagePage >= maxPage;
    nextButton.addEventListener('click', () => {
        if (currentImagePage < maxPage) {
            currentImagePage++;
            updateImagePreviewsUI();
        }
    });
    
    // Page indicator
    const pageIndicator = document.createElement('span');
    pageIndicator.textContent = `Page ${currentImagePage + 1} of ${maxPage + 1}`;
    
    // Add page size selector
    const pageSizeContainer = document.createElement('div');
    pageSizeContainer.className = 'page-size-selector';
    
    const pageSizeLabel = document.createElement('label');
    pageSizeLabel.textContent = 'Show:';
    pageSizeLabel.htmlFor = 'page-size-select';
    
    const pageSizeSelect = document.createElement('select');
    pageSizeSelect.id = 'page-size-select';
    
    // Add page size options
    [10, 20, 30, 40, 50].forEach(size => {
        const option = document.createElement('option');
        option.value = size.toString();
        option.textContent = `${size} images`;
        option.selected = size === imagesPerPage;
        pageSizeSelect.appendChild(option);
    });
    
    // Add page size change handler
    pageSizeSelect.addEventListener('change', () => {
        const newPageSize = parseInt(pageSizeSelect.value);
        
        if (newPageSize !== imagesPerPage) {
            // Adjust the current page to preserve the first visible image as much as possible
            const firstVisibleImage = currentImagePage * imagesPerPage;
            
            // Set new page size
            imagesPerPage = newPageSize;
            
            // Calculate new current page
            currentImagePage = Math.floor(firstVisibleImage / imagesPerPage);
            
            // Update UI
            updateImagePreviewsUI();
        }
    });
    
    pageSizeContainer.appendChild(pageSizeLabel);
    pageSizeContainer.appendChild(pageSizeSelect);
    
    // Add refresh button
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '↻ Refresh';
    refreshButton.title = 'Refresh image list';
    refreshButton.className = 'refresh-button';
    refreshButton.addEventListener('click', () => {
        loadAllImages(cachedImageData!.directory);
    });
    
    // Add elements to the pagination div
    paginationDiv.appendChild(prevButton);
    paginationDiv.appendChild(pageIndicator);
    paginationDiv.appendChild(nextButton);
    paginationDiv.appendChild(pageSizeContainer);
    paginationDiv.appendChild(refreshButton);
    
    // Add pagination div to the preview container
    previewContainer.appendChild(paginationDiv);
}

// Validate numeric input fields
function validateNumberInput(input: HTMLInputElement, min: number, max: number): void {
    const value = Number(input.value);
    const validationMessage = input.nextElementSibling as HTMLElement;
    
    if (isNaN(value) || value < min || value > max) {
        validationMessage.textContent = `Please enter a number between ${min} and ${max}`;
        input.setCustomValidity(`Please enter a number between ${min} and ${max}`);
    } else {
        validationMessage.textContent = '';
        input.setCustomValidity('');
    }
}

// Activate a tab
function activateTab(tabId: string | null): void {
    if (!tabId) return;
    
    // Update tab buttons
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-tab') === tabId);
    });
    
    // Show selected tab pane
    tabPanes.forEach(pane => {
        pane.classList.toggle('active', pane.id === tabId);
    });
}

// Select a pattern
function selectPattern(pattern: string | null): void {
    if (!pattern) return;
    
    // Update selection UI
    patternOptions.forEach(option => {
        option.classList.toggle('selected', option.getAttribute('data-pattern') === pattern);
    });
    
    // Update config value
    config.pattern = pattern;
    
    // Load pattern-specific options
    loadPatternOptions(pattern);
}

// Load options specific to the selected pattern
function loadPatternOptions(pattern: string): void {
    const patternOptionsContainer = document.getElementById('pattern-options-container');
    if (!patternOptionsContainer) return;
    
    // Clear existing options
    patternOptionsContainer.innerHTML = '';
    
    // Load options based on pattern type
    switch (pattern) {
        case 'grid':
            {
            const rows = config.patternOptions?.rows ?? 2;
            const cols = config.patternOptions?.cols ?? 3;
            patternOptionsContainer.innerHTML = `
                <div class="form-group">
                    <label for="grid-size">Grid Size:</label>
                    <div class="input-group">
                        <input type="number" id="grid-rows" min="1" max="10" value="${rows}" style="width: 70px">
                        <span class="input-group-text">×</span>
                        <input type="number" id="grid-cols" min="1" max="10" value="${cols}" style="width: 70px">
                    </div>
                </div>
            `;
            break;
            }
            
        case 'mosaic':
            {
            const opts = config.patternOptions ?? {};
            const tileArea = opts.tileAreaPercent ?? 7;
            const tileMargin = opts.tileMargin ?? 4;
            const placementSpeed = opts.placementSpeed ?? 200;
            const maxTiles = opts.maxTiles ?? 200;
            const startPos = opts.startPosition ?? 'center';
            const priorityFn = opts.priorityFunction ?? 'center-out';
            const dirAngle = opts.directionAngle ?? 0;
            const holdDuration = opts.holdDuration != null ? opts.holdDuration / 1000 : 5;
            const zoomEnabled = opts.zoomEnabled ?? true;
            const maxZoomStep = opts.maxZoomOut != null ? Math.min(6, Math.max(0, Math.round(-Math.log2(opts.maxZoomOut)))) : 2;
            const maxZoomPct = (100 / Math.pow(2, maxZoomStep));
            const photomosaicEnabled = !!(opts.referenceImage || opts.referenceImageDir);
            const refSource = opts.referenceImage ? 'single' : opts.referenceImageDir ? 'directory' : 'random';
            const colorMatch = opts.colorMatchStrategy ?? 'average';

            patternOptionsContainer.innerHTML = `
                <div class="mosaic-option-group">
                    <h4>Placement</h4>
                    <div class="form-group">
                        <label for="mosaic-tile-area">Tile Size:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-tile-area" min="1" max="20" value="${tileArea}">
                            <span class="range-value" id="mosaic-tile-area-value">${tileArea}%</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-tile-margin">Tile Margin:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-tile-margin" min="0" max="100" value="${tileMargin}">
                            <span class="range-value" id="mosaic-tile-margin-value">${tileMargin}px</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-placement-speed">Placement Speed:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-placement-speed" min="50" max="1000" step="50" value="${placementSpeed}">
                            <span class="range-value" id="mosaic-placement-speed-value">${placementSpeed}ms</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-max-tiles">Max Tiles (0 = unlimited):</label>
                        <input type="number" id="mosaic-max-tiles" min="0" max="1000" value="${maxTiles}">
                    </div>
                    <div class="form-group">
                        <label>Start Position:</label>
                        <div class="radio-group">
                            <label><input type="radio" name="mosaic-start-position" value="center" ${startPos === 'center' ? 'checked' : ''}> Center</label>
                            <label><input type="radio" name="mosaic-start-position" value="random" ${startPos === 'random' ? 'checked' : ''}> Random</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="mosaic-priority-function">Placement Order:</label>
                        <select id="mosaic-priority-function">
                            <option value="center-out" ${priorityFn === 'center-out' ? 'selected' : ''}>Center Out</option>
                            <option value="spiral-cw" ${priorityFn === 'spiral-cw' ? 'selected' : ''}>Spiral CW</option>
                            <option value="spiral-ccw" ${priorityFn === 'spiral-ccw' ? 'selected' : ''}>Spiral CCW</option>
                            <option value="directional" ${priorityFn === 'directional' ? 'selected' : ''}>Directional</option>
                            <option value="random" ${priorityFn === 'random' ? 'selected' : ''}>Random</option>
                        </select>
                    </div>
                    <div class="form-group conditional-field ${priorityFn === 'directional' ? 'visible' : ''}" id="mosaic-direction-angle-group">
                        <label for="mosaic-direction-angle">Direction Angle:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-direction-angle" min="0" max="360" value="${dirAngle}">
                            <span class="range-value" id="mosaic-direction-angle-value">${dirAngle}°</span>
                        </div>
                    </div>
                </div>

                <div class="mosaic-option-group">
                    <h4>Display</h4>
                    <div class="form-group">
                        <label for="mosaic-hold-duration">Hold Duration (seconds):</label>
                        <input type="number" id="mosaic-hold-duration" min="1" max="60" value="${holdDuration}">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="mosaic-zoom-enabled" ${zoomEnabled ? 'checked' : ''}>
                            Enable zoom out
                        </label>
                    </div>
                    <div class="form-group conditional-field ${zoomEnabled ? 'visible' : ''}" id="mosaic-max-zoom-out-group">
                        <label for="mosaic-max-zoom-out">Max Zoom Out:</label>
                        <div class="range-with-value">
                            <input type="range" id="mosaic-max-zoom-out" min="0" max="6" step="1" value="${maxZoomStep}" ${!zoomEnabled ? 'disabled' : ''}>
                            <span class="range-value" id="mosaic-max-zoom-out-value">${maxZoomPct <= 10 ? maxZoomPct.toFixed(2) : maxZoomPct <= 50 ? maxZoomPct.toFixed(1) : maxZoomPct}%</span>
                        </div>
                    </div>
                </div>

                <div class="mosaic-option-group">
                    <button class="collapsible-header ${photomosaicEnabled ? 'expanded' : ''}" id="mosaic-photomosaic-toggle">Photomosaic</button>
                    <div class="collapsible-content ${photomosaicEnabled ? 'expanded' : ''}" id="mosaic-photomosaic-content">
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="mosaic-photomosaic-enabled" ${photomosaicEnabled ? 'checked' : ''}>
                                Enable photomosaic
                            </label>
                        </div>
                        <div class="conditional-field ${photomosaicEnabled ? 'visible' : ''}" id="mosaic-photomosaic-options">
                            <div class="form-group">
                                <label>Reference Source:</label>
                                <div class="radio-group">
                                    <label><input type="radio" name="mosaic-reference-source" value="random" ${refSource === 'random' ? 'checked' : ''}> Random from Image Folder</label>
                                    <label><input type="radio" name="mosaic-reference-source" value="single" ${refSource === 'single' ? 'checked' : ''}> Single Image</label>
                                    <label><input type="radio" name="mosaic-reference-source" value="directory" ${refSource === 'directory' ? 'checked' : ''}> Directory</label>
                                </div>
                            </div>
                            <div class="form-group conditional-field ${refSource === 'single' ? 'visible' : ''}" id="mosaic-reference-image-group">
                                <label for="mosaic-reference-image">Reference Image:</label>
                                <div class="directory-selector">
                                    <input type="text" id="mosaic-reference-image" value="${opts.referenceImage ?? ''}" readonly>
                                    <button class="browse-button" id="mosaic-browse-reference-image">Browse...</button>
                                </div>
                            </div>
                            <div class="form-group conditional-field ${refSource === 'directory' ? 'visible' : ''}" id="mosaic-reference-dir-group">
                                <label for="mosaic-reference-dir">Reference Directory:</label>
                                <div class="directory-selector">
                                    <input type="text" id="mosaic-reference-dir" value="${opts.referenceImageDir ?? ''}" readonly>
                                    <button class="browse-button" id="mosaic-browse-reference-dir">Browse...</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="mosaic-color-match">Color Match:</label>
                                <select id="mosaic-color-match">
                                    <option value="average" ${colorMatch === 'average' ? 'selected' : ''}>Average Color</option>
                                    <option value="dominant" ${colorMatch === 'dominant' ? 'selected' : ''}>Dominant Color</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <div class="cache-status" id="mosaic-cache-status"></div>
                                <button class="bake-btn" id="mosaic-bake-btn">Bake Color Cache</button>
                                <div class="bake-progress" id="mosaic-bake-progress">
                                    <div class="bake-progress-bar">
                                        <div class="bake-progress-fill" id="mosaic-bake-fill"></div>
                                    </div>
                                    <span class="bake-progress-label" id="mosaic-bake-label">0 / 0 (0%)</span>
                                    <button class="bake-cancel-btn" id="mosaic-bake-cancel">Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Wire up range slider live labels
            const rangeInputs: Array<{ id: string; labelId: string; suffix: string }> = [
                { id: 'mosaic-tile-area', labelId: 'mosaic-tile-area-value', suffix: '%' },
                { id: 'mosaic-tile-margin', labelId: 'mosaic-tile-margin-value', suffix: 'px' },
                { id: 'mosaic-placement-speed', labelId: 'mosaic-placement-speed-value', suffix: 'ms' },
                { id: 'mosaic-direction-angle', labelId: 'mosaic-direction-angle-value', suffix: '°' },

            ];
            for (const { id, labelId, suffix } of rangeInputs) {
                const input = document.getElementById(id) as HTMLInputElement | null;
                const label = document.getElementById(labelId);
                if (input && label) {
                    input.addEventListener('input', () => {
                        label.textContent = input.value + suffix;
                    });
                }
            }

            // Conditional: direction angle visibility
            const prioritySelect = document.getElementById('mosaic-priority-function') as HTMLSelectElement | null;
            const angleGroup = document.getElementById('mosaic-direction-angle-group');
            prioritySelect?.addEventListener('change', () => {
                angleGroup?.classList.toggle('visible', prioritySelect.value === 'directional');
            });

            // Conditional: zoom out slider with power-of-2 label
            const zoomCheck = document.getElementById('mosaic-zoom-enabled') as HTMLInputElement | null;
            const zoomGroup = document.getElementById('mosaic-max-zoom-out-group');
            const zoomSlider = document.getElementById('mosaic-max-zoom-out') as HTMLInputElement | null;
            const zoomLabel = document.getElementById('mosaic-max-zoom-out-value');
            zoomCheck?.addEventListener('change', () => {
                zoomGroup?.classList.toggle('visible', zoomCheck.checked);
                if (zoomSlider) zoomSlider.disabled = !zoomCheck.checked;
            });
            zoomSlider?.addEventListener('input', () => {
                if (zoomLabel) {
                    const n = Number(zoomSlider.value);
                    const pct = 100 / Math.pow(2, n);
                    zoomLabel.textContent = (pct <= 10 ? pct.toFixed(2) : pct <= 50 ? pct.toFixed(1) : pct) + '%';
                }
            });

            // Collapsible: photomosaic section
            const photoToggle = document.getElementById('mosaic-photomosaic-toggle');
            const photoContent = document.getElementById('mosaic-photomosaic-content');
            photoToggle?.addEventListener('click', () => {
                photoToggle.classList.toggle('expanded');
                photoContent?.classList.toggle('expanded');
            });

            // Conditional: photomosaic enabled
            const photoEnabled = document.getElementById('mosaic-photomosaic-enabled') as HTMLInputElement | null;
            const photoOptions = document.getElementById('mosaic-photomosaic-options');
            photoEnabled?.addEventListener('change', () => {
                photoOptions?.classList.toggle('visible', photoEnabled.checked);
            });

            // Bake button
            const bakeBtn = document.getElementById('mosaic-bake-btn');
            bakeBtn?.addEventListener('click', () => startBake());

            // Check cache status on load if photomosaic is enabled
            if (photomosaicEnabled) {
                checkCacheStatus();
            }

            // Also check when photomosaic is toggled on
            photoEnabled?.addEventListener('change', () => {
                if (photoEnabled.checked) {
                    checkCacheStatus();
                }
            });

            // Conditional: reference source radios
            const refRadios = document.querySelectorAll('input[name="mosaic-reference-source"]');
            const refImageGroup = document.getElementById('mosaic-reference-image-group');
            const refDirGroup = document.getElementById('mosaic-reference-dir-group');
            const updateRefVisibility = () => {
                const selected = (document.querySelector('input[name="mosaic-reference-source"]:checked') as HTMLInputElement)?.value;
                refImageGroup?.classList.toggle('visible', selected === 'single');
                refDirGroup?.classList.toggle('visible', selected === 'directory');
            };
            refRadios.forEach(radio => radio.addEventListener('change', updateRefVisibility));

            // Browse buttons for reference image/dir
            const browseRefImage = document.getElementById('mosaic-browse-reference-image');
            const refImageInput = document.getElementById('mosaic-reference-image') as HTMLInputElement | null;
            browseRefImage?.addEventListener('click', async () => {
                const path = await window.electronAPI.browseDirectory();
                if (path && refImageInput) refImageInput.value = path;
            });

            const browseRefDir = document.getElementById('mosaic-browse-reference-dir');
            const refDirInput = document.getElementById('mosaic-reference-dir') as HTMLInputElement | null;
            browseRefDir?.addEventListener('click', async () => {
                const path = await window.electronAPI.browseDirectory();
                if (path && refDirInput) refDirInput.value = path;
            });

            break;
            }
            
        case 'random':
            {
            const randomCount = config.patternOptions?.randomCount ?? 8;
            const allowOverlap = config.patternOptions?.allowOverlap ?? true;
            patternOptionsContainer.innerHTML = `
                <div class="form-group">
                    <label for="random-count">Number of Images:</label>
                    <input type="number" id="random-count" min="1" max="50" value="${randomCount}">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="allow-overlap" ${allowOverlap ? 'checked' : ''}>
                        Allow images to overlap
                    </label>
                </div>
            `;
            break;
            }

        case 'sliding':
            {
            const slideSpeed = config.patternOptions?.slideSpeed ?? 40;
            patternOptionsContainer.innerHTML = `
                <div class="form-group">
                    <label for="slide-speed">Slide Speed (px/sec):</label>
                    <input type="number" id="slide-speed" min="10" max="400" value="${slideSpeed}">
                </div>
            `;
            break;
            }
            
        default:
            // No options for simple pattern
            patternOptionsContainer.innerHTML = '<p>No additional options for this pattern.</p>';
    }
}

// Get configuration values from the UI
function getPatternOptionsFromUI(): PatternOptions {
    switch (config.pattern) {
        case 'grid': {
            const gridRows = document.getElementById('grid-rows') as HTMLInputElement | null;
            const gridCols = document.getElementById('grid-cols') as HTMLInputElement | null;
            return {
                rows: Number(gridRows?.value) || 2,
                cols: Number(gridCols?.value) || 3,
            };
        }
        case 'mosaic': {
            const tileArea = document.getElementById('mosaic-tile-area') as HTMLInputElement | null;
            const tileMargin = document.getElementById('mosaic-tile-margin') as HTMLInputElement | null;
            const placementSpeed = document.getElementById('mosaic-placement-speed') as HTMLInputElement | null;
            const maxTiles = document.getElementById('mosaic-max-tiles') as HTMLInputElement | null;
            const startPos = document.querySelector('input[name="mosaic-start-position"]:checked') as HTMLInputElement | null;
            const priorityFn = document.getElementById('mosaic-priority-function') as HTMLSelectElement | null;
            const dirAngle = document.getElementById('mosaic-direction-angle') as HTMLInputElement | null;
            const holdDuration = document.getElementById('mosaic-hold-duration') as HTMLInputElement | null;
            const zoomEnabled = document.getElementById('mosaic-zoom-enabled') as HTMLInputElement | null;
            const maxZoomOut = document.getElementById('mosaic-max-zoom-out') as HTMLInputElement | null;
            const photoEnabled = document.getElementById('mosaic-photomosaic-enabled') as HTMLInputElement | null;
            const refSource = document.querySelector('input[name="mosaic-reference-source"]:checked') as HTMLInputElement | null;
            const refImage = document.getElementById('mosaic-reference-image') as HTMLInputElement | null;
            const refDir = document.getElementById('mosaic-reference-dir') as HTMLInputElement | null;
            const colorMatch = document.getElementById('mosaic-color-match') as HTMLSelectElement | null;

            const result: PatternOptions = {
                tileAreaPercent: Number(tileArea?.value) || 7,
                tileMargin: Number(tileMargin?.value) || 4,
                placementSpeed: Number(placementSpeed?.value) || 200,
                maxTiles: maxTiles?.value != null && maxTiles.value !== '' ? Number(maxTiles.value) : 200,
                startPosition: (startPos?.value as 'center' | 'random') || 'center',
                priorityFunction: (priorityFn?.value as PatternOptions['priorityFunction']) || 'center-out',
                directionAngle: Number(dirAngle?.value) || 0,
                holdDuration: (Number(holdDuration?.value) || 5) * 1000,
                zoomEnabled: zoomEnabled?.checked ?? true,
                maxZoomOut: 1 / Math.pow(2, Number(maxZoomOut?.value) || 0),
                colorMatchStrategy: (colorMatch?.value as 'average' | 'dominant') || 'average',
            };

            if (photoEnabled?.checked) {
                const source = refSource?.value || 'random';
                if (source === 'single' && refImage?.value) {
                    result.referenceImage = refImage.value;
                } else if (source === 'directory' && refDir?.value) {
                    result.referenceImageDir = refDir.value;
                }
                if (source === 'random') {
                    result.referenceImage = '__random__';
                }
            }

            return result;
        }
        case 'random': {
            const randomCount = document.getElementById('random-count') as HTMLInputElement | null;
            const allowOverlap = document.getElementById('allow-overlap') as HTMLInputElement | null;
            return {
                randomCount: Number(randomCount?.value) || 8,
                allowOverlap: allowOverlap?.checked ?? true,
            };
        }
        case 'sliding': {
            const slideSpeed = document.getElementById('slide-speed') as HTMLInputElement | null;
            return {
                slideSpeed: Number(slideSpeed?.value) || 40,
            };
        }
        default:
            return {};
    }
}

function getConfigFromUI(): ScreensaverConfig {
    return {
        version: CURRENT_CONFIG_VERSION,
        imageFolder: imageDirectoryInput.value,
        includeSubdirectories: includeSubdirectoriesCheckbox.checked,
        changeInterval: (Number(changeIntervalInput.value) || 10) * 1000,
        pattern: config.pattern,
        patternOptions: getPatternOptionsFromUI(),
        multiMonitorSync: multiMonitorSyncCheckbox.checked,
        transition: {
            effect: transitionEffectSelect.value,
            duration: Number(transitionDurationInput.value) || 1000,
        },
        theme: config.theme,
        imageFitStyle: imageFitStyleSelect.value || DEFAULT_CONFIG.imageFitStyle,
    };
}

// Apply changes but don't save or close
async function applyChanges(): Promise<void> {
    const newConfig = getConfigFromUI();
    
    try {
        await window.electronAPI.applyConfig(newConfig);
        config = { ...newConfig };
        
        showSuccessMessage('Settings applied successfully');
    } catch (error) {
        console.error('Error applying configuration:', error);
        showErrorMessage('Failed to apply settings');
    }
}

// Save changes and close window
async function saveChanges(): Promise<void> {
    const newConfig = getConfigFromUI();
    
    try {
        await window.electronAPI.saveConfig(newConfig);
        config = { ...newConfig };
        
        showSuccessMessage('Settings saved successfully');
    } catch (error) {
        console.error('Error saving configuration:', error);
        showErrorMessage('Failed to save settings');
    }
}

// Save changes and close window without showing success message
async function saveAndClose(): Promise<void> {
    const newConfig = getConfigFromUI();
    
    try {
        await window.electronAPI.saveConfig(newConfig);
        config = { ...newConfig };
        
        closeWindow();
    } catch (error) {
        console.error('Error saving and closing:', error);
        showErrorMessage('Failed to save settings');
    }
}

async function resetToDefaults(): Promise<void> {
    const confirmReset = window.confirm('Reset all settings to defaults?');
    if (!confirmReset) return;

    try {
        config = { ...DEFAULT_CONFIG };
        updateUIFromConfig(config);
        await window.electronAPI.saveConfig(config);
        showSuccessMessage('Settings reset to defaults');
    } catch (error) {
        console.error('Error resetting defaults:', error);
        showErrorMessage('Failed to reset settings');
    }
}

// Close the configuration window
function closeWindow(): void {
    window.electronAPI.closeConfigWindow();
}

// Show a success message briefly
function showSuccessMessage(message: string): void {
    console.log('Success:', message);
    showToast(message, 'success');
}

// Show an error message
function showErrorMessage(message: string): void {
    console.error('Error:', message);
    showToast(message, 'error');
}

function showToast(message: string, kind: 'success' | 'error'): void {
    if (!toastContainer) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 2800);
}

// --- Color cache bake UI ---

let activeWorker: Worker | null = null;

async function checkCacheStatus(): Promise<void> {
    const statusEl = document.getElementById('mosaic-cache-status');
    if (!statusEl) return;

    const api = (window as any).electronAPI;
    if (!api?.readColorCache || !api?.getRawImagePaths || !api?.getFileStats) {
        statusEl.className = 'cache-status visible status-error';
        statusEl.textContent = 'Color cache API not available.';
        return;
    }

    try {
        const [cacheData, rawPaths] = await Promise.all([
            api.readColorCache(),
            api.getRawImagePaths(),
        ]);

        if (rawPaths.length === 0) {
            statusEl.className = 'cache-status visible status-warning';
            statusEl.textContent = 'No images found. Configure an image folder first.';
            return;
        }

        const stats: { path: string; mtime: number; size: number }[] = await api.getFileStats(rawPaths);
        const statsMap = new Map(stats.map(s => [s.path, s]));

        const entries = cacheData.entries ?? {};
        let missing = 0;

        for (const rawPath of rawPaths) {
            const entry = entries[rawPath];
            const stat = statsMap.get(rawPath);
            if (!entry || !stat || entry.mtime !== stat.mtime || entry.size !== stat.size) {
                missing++;
            }
        }

        if (missing === 0) {
            statusEl.className = 'cache-status visible status-ok';
            statusEl.textContent = `Color cache up to date (${rawPaths.length} images)`;
        } else if (Object.keys(entries).length === 0) {
            statusEl.className = 'cache-status visible status-error';
            statusEl.textContent = 'No color cache found. Click Bake to precompute colors for photomosaic mode.';
        } else {
            statusEl.className = 'cache-status visible status-warning';
            statusEl.textContent = `Color cache incomplete: ${missing} of ${rawPaths.length} images need recomputation. Click Bake to update.`;
        }
    } catch (e) {
        statusEl.className = 'cache-status visible status-error';
        statusEl.textContent = `Error checking cache: ${e}`;
    }
}

async function startBake(): Promise<void> {
    const api = (window as any).electronAPI;
    if (!api) return;

    const bakeBtn = document.getElementById('mosaic-bake-btn') as HTMLButtonElement | null;
    const progressDiv = document.getElementById('mosaic-bake-progress');
    const fillBar = document.getElementById('mosaic-bake-fill');
    const label = document.getElementById('mosaic-bake-label');
    const cancelBtn = document.getElementById('mosaic-bake-cancel');

    if (!bakeBtn || !progressDiv || !fillBar || !label) return;

    // Read existing cache and raw paths
    const cacheData = await api.readColorCache();
    const entries = cacheData.entries ?? {};
    const rawPaths: string[] = await api.getRawImagePaths();
    const assetUrls: string[] = await api.getImages();

    // Build raw path → asset URL mapping
    const pathToUrl = new Map<string, string>();
    for (let i = 0; i < rawPaths.length; i++) {
        pathToUrl.set(rawPaths[i], assetUrls[i]);
    }

    // Get file stats for invalidation (uses raw filesystem paths)
    const stats: { path: string; mtime: number; size: number }[] = await api.getFileStats(rawPaths);
    const statsMap = new Map(stats.map((s: { path: string; mtime: number; size: number }) => [s.path, s]));

    // Filter to images needing computation
    const toCompute: Array<{ rawPath: string; assetUrl: string }> = [];
    for (const rawPath of rawPaths) {
        const entry = entries[rawPath];
        const stat = statsMap.get(rawPath);
        const assetUrl = pathToUrl.get(rawPath);
        if (!assetUrl) continue;
        if (!entry || !stat || entry.mtime !== stat.mtime || entry.size !== stat.size) {
            toCompute.push({ rawPath, assetUrl });
        }
    }

    if (toCompute.length === 0) {
        await checkCacheStatus();
        return;
    }

    // Show progress, hide bake button
    bakeBtn.style.display = 'none';
    progressDiv.classList.add('visible');
    label.textContent = `0 / ${toCompute.length} (0%)`;
    fillBar.style.width = '0%';

    // Spawn worker
    const worker = new Worker('../color-worker.bundle.js');
    activeWorker = worker;

    worker.onmessage = async (e: MessageEvent) => {
        const msg = e.data;

        if (msg.type === 'progress') {
            const pct = Math.round((msg.completed / msg.total) * 100);
            label.textContent = `${msg.completed} / ${msg.total} (${pct}%)`;
            fillBar.style.width = `${pct}%`;
        }

        if (msg.type === 'result') {
            const stat = statsMap.get(msg.rawPath);
            entries[msg.rawPath] = {
                avgColor: msg.avgColor,
                domColor: msg.domColor,
                mtime: stat?.mtime ?? 0,
                size: stat?.size ?? 0,
            };
        }

        if (msg.type === 'done') {
            // Write cache (even on cancel — preserve partial progress)
            try {
                await api.writeColorCache({ version: 1, entries });
            } catch (writeErr) {
                console.error('Failed to write color cache:', writeErr);
            }

            // Reset UI
            worker.terminate();
            activeWorker = null;
            progressDiv.classList.remove('visible');
            bakeBtn.style.display = '';
            await checkCacheStatus();
        }
    };

    // Wire cancel button
    cancelBtn?.addEventListener('click', () => {
        worker.postMessage({ type: 'cancel' });
    }, { once: true });

    // Start the worker
    worker.postMessage({ type: 'start', items: toCompute });
}