interface ConfigValues {
    changeInterval: number;
    imageDirectory: string;
    includeSubdirectories: boolean;
    pattern: string;
    multiMonitorSync: boolean;
    transitionEffect: string;
    transitionDuration: number;
    theme: string; // Add theme property
}

// Default values
let config: ConfigValues = {
    changeInterval: 10,
    imageDirectory: '',
    includeSubdirectories: true,
    pattern: 'simple',
    multiMonitorSync: false,
    transitionEffect: 'fade',
    transitionDuration: 1000,
    theme: 'light' // Default theme
};

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
let directoryStatus: HTMLElement;
let imageCount: HTMLElement;
let previewContainer: HTMLElement;
let themeToggle: HTMLButtonElement; // Add theme toggle button reference

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
        showErrorMessage('Failed to load configuration settings.');
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
    
    directoryStatus = document.getElementById('directory-status') as HTMLElement;
    imageCount = document.getElementById('image-count') as HTMLElement;
    previewContainer = document.getElementById('preview-container') as HTMLElement;
    
    themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
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
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
}

// Update UI with loaded configuration
function updateUIFromConfig(savedConfig: any): void {
    if (savedConfig.changeInterval) {
        changeIntervalInput.value = (savedConfig.changeInterval / 1000).toString(); // Convert ms to seconds
    }
    
    if (savedConfig.imageFolder) {
        imageDirectoryInput.value = savedConfig.imageFolder;
        validateDirectory(savedConfig.imageFolder);
    }
    
    if (savedConfig.includeSubdirectories !== undefined) {
        includeSubdirectoriesCheckbox.checked = savedConfig.includeSubdirectories;
    }
    
    if (savedConfig.pattern) {
        selectPattern(savedConfig.pattern);
    }
    
    if (savedConfig.multiMonitorSync !== undefined) {
        multiMonitorSyncCheckbox.checked = savedConfig.multiMonitorSync;
    }
    
    if (savedConfig.transition && savedConfig.transition.effect) {
        transitionEffectSelect.value = savedConfig.transition.effect;
    }
    
    if (savedConfig.transition && savedConfig.transition.duration !== undefined) {
        transitionDurationInput.value = savedConfig.transition.duration.toString();
    }
    
    if (savedConfig.theme) {
        config.theme = savedConfig.theme;
        applyTheme(savedConfig.theme);
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
async function validateDirectory(directory: string): Promise<void> {
    try {
        const directoryExists = await window.electronAPI.validateDirectory(directory);
        
        if (directoryExists) {
            directoryStatus.textContent = 'Directory is valid';
            directoryStatus.className = 'status-message success';
            
            // Load image previews
            const images = await window.electronAPI.getPreviewImages(directory, 5);
            updateImagePreviews(images);
        } else {
            directoryStatus.textContent = 'Directory does not exist';
            directoryStatus.className = 'status-message error';
            imageCount.textContent = 'No images found';
            previewContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Error validating directory:', error);
        directoryStatus.textContent = 'Error validating directory';
        directoryStatus.className = 'status-message error';
    }
}

// Update image preview section
function updateImagePreviews(images: string[]): void {
    previewContainer.innerHTML = '';
    
    if (images.length === 0) {
        imageCount.textContent = 'No images found in this directory';
        return;
    }
    
    imageCount.textContent = `Found ${images.length} images`;
    
    // Create preview thumbnails
    images.forEach(imagePath => {
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = 'Preview';
        img.title = imagePath.split('/').pop() || imagePath;
        previewContainer.appendChild(img);
    });
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
            patternOptionsContainer.innerHTML = `
                <div class="form-group">
                    <label for="grid-size">Grid Size:</label>
                    <div class="input-group">
                        <input type="number" id="grid-rows" min="1" max="10" value="2" style="width: 70px">
                        <span class="input-group-text">×</span>
                        <input type="number" id="grid-cols" min="1" max="10" value="3" style="width: 70px">
                    </div>
                </div>
            `;
            break;
            
        case 'mosaic':
            patternOptionsContainer.innerHTML = `
                <div class="form-group">
                    <label for="mosaic-density">Mosaic Density:</label>
                    <input type="range" id="mosaic-density" min="1" max="10" value="5">
                    <span id="mosaic-density-value">Medium</span>
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
            
        case 'random':
            patternOptionsContainer.innerHTML = `
                <div class="form-group">
                    <label for="random-count">Number of Images:</label>
                    <input type="number" id="random-count" min="1" max="50" value="8">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="allow-overlap" checked>
                        Allow images to overlap
                    </label>
                </div>
            `;
            break;
            
        default:
            // No options for simple pattern
            patternOptionsContainer.innerHTML = '<p>No additional options for this pattern.</p>';
    }
}

// Get configuration values from the UI
function getConfigFromUI(): ConfigValues {
    return {
        changeInterval: Number(changeIntervalInput.value) || 10,
        imageDirectory: imageDirectoryInput.value,
        includeSubdirectories: includeSubdirectoriesCheckbox.checked,
        pattern: config.pattern,
        multiMonitorSync: multiMonitorSyncCheckbox.checked,
        transitionEffect: transitionEffectSelect.value,
        transitionDuration: Number(transitionDurationInput.value) || 1000,
        theme: config.theme
    };
}

// Apply changes but don't save or close
async function applyChanges(): Promise<void> {
    const newConfig = getConfigFromUI();
    
    try {
        await window.electronAPI.applyConfig({
            imageFolder: newConfig.imageDirectory,
            includeSubdirectories: newConfig.includeSubdirectories,
            changeInterval: newConfig.changeInterval * 1000, // Convert to milliseconds
            pattern: newConfig.pattern,
            multiMonitorSync: newConfig.multiMonitorSync,
            transition: {
                effect: newConfig.transitionEffect,
                duration: newConfig.transitionDuration
            },
            theme: newConfig.theme
        });
        
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
        await window.electronAPI.saveConfig({
            imageFolder: newConfig.imageDirectory,
            includeSubdirectories: newConfig.includeSubdirectories,
            changeInterval: newConfig.changeInterval * 1000, // Convert to milliseconds
            pattern: newConfig.pattern,
            multiMonitorSync: newConfig.multiMonitorSync,
            transition: {
                effect: newConfig.transitionEffect,
                duration: newConfig.transitionDuration
            },
            theme: newConfig.theme
        });
        
        showSuccessMessage('Settings saved successfully');
        
        // Close after a brief delay to show success message
        setTimeout(() => {
            closeWindow();
        }, 1000);
    } catch (error) {
        console.error('Error saving configuration:', error);
        showErrorMessage('Failed to save settings');
    }
}

// Close the configuration window
function closeWindow(): void {
    window.electronAPI.closeConfigWindow();
}

// Show a success message briefly
function showSuccessMessage(message: string): void {
    // Implementation would depend on UI design
    // For now, just log to console
    console.log('Success:', message);
    alert(message);
}

// Show an error message
function showErrorMessage(message: string): void {
    // Implementation would depend on UI design
    // For now, just log to console
    console.error('Error:', message);
    alert('Error: ' + message);
}
