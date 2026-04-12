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
            const density = config.patternOptions?.density ?? 5;
            const densityText = density <= 3 ? 'Low' : density >= 8 ? 'High' : 'Medium';
            patternOptionsContainer.innerHTML = `
                <div class="form-group">
                    <label for="mosaic-density">Mosaic Density:</label>
                    <input type="range" id="mosaic-density" min="1" max="10" value="${density}">
                    <span id="mosaic-density-value">${densityText}</span>
                </div>
            `;
            
            // Add live update for range slider
            const densitySlider = document.getElementById('mosaic-density') as HTMLInputElement;
            const densityValue = document.getElementById('mosaic-density-value');
            
            if (densitySlider && densityValue) {
                densitySlider.addEventListener('input', () => {
                    const val = parseInt(densitySlider.value);
                    let densityText = 'Medium';
                    
                    if (val <= 3) densityText = 'Low';
                    else if (val >= 8) densityText = 'High';
                    
                    densityValue.textContent = densityText;
                });
            }
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
            const mosaicDensity = document.getElementById('mosaic-density') as HTMLInputElement | null;
            return {
                density: Number(mosaicDensity?.value) || 5,
            };
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