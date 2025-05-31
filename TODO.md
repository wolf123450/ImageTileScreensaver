# Image Tile Screensaver - TODO List

This document outlines features and improvements that need to be implemented or enhanced in the Image Tile Screensaver project. Items are organized by priority and category, with a ranking from 1-10 (10 being highest priority for MVP and user value).

## High Priority

### Core Functionality
- [ ] **CF-1:** Complete the implementation of the Windows screensaver preview mode (`/p` command line argument) [9/10]
- [ ] **CF-2:** Add a configuration dialog for the Windows screensaver settings (`/c` command line argument) [10/10]
  #### Implementation Steps:
  1. **CF-2.1:** Create Configuration UI Components:
     - Design and implement a configuration dialog using HTML/CSS/TS in a separate window
     - Create form elements for all configurable settings (image directory, change interval, patterns, etc.)
     - Add validation for user inputs (directory exists, interval is a positive number, etc.)
  
  2. **CF-2.2:** Add Configuration Window Management:
     - Create a new electron BrowserWindow specifically for configuration
     - Implement proper window sizing, positioning, and styling for a dialog
     - Add modal behavior to block interaction with other windows when config is open
  
  3. **CF-2.3:** Command Line Argument Handling:
     - Enhance the existing `/c` handler in `main.ts` to create and show the config window
     - Add proper argument parsing for any additional parameters
     - Implement Windows-specific behavior for configuration dialog integration
  
  4. **CF-2.4:** Configuration Persistence:
     - Create a configuration file format (JSON) to store user settings
     - Implement read/write functions for the configuration file
     - Add functions to apply configuration changes in real-time
  
  5. **CF-2.5:** Configuration API:
     - Extend the IPC interface in `preload.ts` to expose configuration-related functions
     - Add methods for saving, loading, and validating configuration
     - Create event emitters for configuration changes
  
  6. **CF-2.6:** UI/UX Refinement:
     - Add proper error handling with user-friendly messages
     - Implement "Apply", "Save", and "Cancel" buttons with appropriate behaviors
     - Create a directory browser dialog for selecting image folders
     - Add preview functionality for pattern selection

  7. **CF-2.7:** Testing and Validation:
     - Test the configuration dialog across different Windows versions
     - Verify that settings are correctly saved and loaded
     - Ensure proper behavior when launched from Windows screensaver settings
     - Test handling of invalid configuration values

- [ ] **CF-3:** Implement persistent configuration storage (currently using default config only) [8/10]
- [ ] **CF-4:** Create a proper error handling system for missing image directories [7/10]
- [ ] **CF-5:** Add recursive directory scanning for images (currently only top-level images are found) [6/10]

### Patterns
- [ ] **PAT-1:** Implement additional pattern generators beyond the simple pattern: [7/10]
  - [ ] **PAT-1.1:** Grid pattern: Display images in a configurable grid layout [8/10]
  - [ ] **PAT-1.2:** Mosaic pattern: Create a mosaic effect with images of different sizes [6/10]
  - [ ] **PAT-1.3:** Sliding pattern: Images that move across the screen [5/10]
  - [ ] **PAT-1.4:** Random pattern: Display images in random positions and sizes [7/10]
- [ ] **PAT-2:** Add pattern configuration options in the UI [8/10]

### User Interface
- [ ] **UI-1:** Build a configuration UI accessible from the screensaver settings [10/10]
  #### Implementation Steps:
  1. **UI-1.1:** Design UI Architecture:
     - Create wireframes for the configuration UI with all needed components
     - Define component hierarchy and state management approach
     - Plan responsive layout to handle different screen sizes

  2. **UI-1.2:** Create Base UI Framework:
     - Set up HTML structure with appropriate container elements
     - Implement CSS styling with a cohesive design system
     - Add dark/light mode support for system integration

  3. **UI-1.3:** Implement Core UI Components:
     - Create a sidebar navigation for different setting categories
     - Build form components for all configurable options
     - Implement tabbed interface for organizing complex settings
     - Add custom UI controls for specialized settings (interval sliders, color pickers, etc.)

  4. **UI-1.4:** Directory Selection Component:
     - Create a directory browser component to select image sources
     - Add support for multiple directories with priority settings
     - Implement directory validation and permission checking
     - Show directory statistics (number of images, types, total size)

  5. **UI-1.5:** Pattern Configuration Components:
     - Create visual selectors for different pattern types
     - Build pattern-specific configuration panels
     - Implement live preview functionality for patterns
     - Create pattern parameter controls (grid size, animation speed, etc.)

  6. **UI-1.6:** Multi-monitor Configuration:
     - Implement monitor detection and display
     - Create UI for per-monitor settings
     - Add visual representation of the user's monitor layout
     - Support dragging and dropping settings between monitors

  7. **UI-1.7:** Settings Persistence Integration:
     - Connect UI components to configuration read/write functions
     - Implement real-time validation and feedback
     - Add "reset to defaults" functionality
     - Create import/export capabilities for sharing configurations

  8. **UI-1.8:** Accessibility and Usability:
     - Implement keyboard navigation throughout the UI
     - Add tooltips and help text for complex options
     - Ensure proper contrast and text sizing
     - Support screen readers and assistive technologies

  9. **UI-1.9:** Testing and Refinement:
     - Conduct usability testing with different user scenarios
     - Test across multiple operating systems and window managers
     - Verify that all settings correctly affect the screensaver behavior
     - Optimize performance for smooth interactions

- [ ] **UI-2:** Create a standalone settings application for non-Windows platforms [6/10]
- [ ] **UI-3:** Add visual feedback during image loading [7/10]
- [ ] **UI-4:** Implement a preview panel in the configuration dialog [9/10]

## Medium Priority

### Image Handling
- [ ] **IMG-1:** Add support for image metadata (EXIF) display options [4/10]
- [ ] **IMG-2:** Implement image caching for faster loading of large collections [7/10]
- [ ] **IMG-3:** Add image preloading to improve transition smoothness [8/10]
- [ ] **IMG-4:** Support for online image sources (URLs, cloud storage) [5/10]
- [ ] **IMG-5:** Add image filtering options (by date, type, size, etc.) [4/10]
- [ ] **IMG-6:** Implement a virtual image collection with lazy loading for large directories [6/10]

### Transitions
- [ ] **TR-1:** Add transition effects between images: [7/10]
  - [ ] **TR-1.1:** Fade transitions [8/10]
  - [ ] **TR-1.2:** Slide transitions [6/10]
  - [ ] **TR-1.3:** Zoom transitions [5/10]
  - [ ] **TR-1.4:** Custom transitions [3/10]
- [ ] **TR-2:** Create a transition effects API for extensibility [4/10]
- [ ] **TR-3:** Allow per-pattern transition settings [5/10]

### Performance
- [ ] **PERF-1:** Optimize image loading and rendering for better performance [8/10]
- [ ] **PERF-2:** Implement background image processing to avoid UI freezes [7/10]
- [ ] **PERF-3:** Add hardware acceleration options for transitions [5/10]
- [ ] **PERF-4:** Optimize memory usage for large image collections [7/10]

## Low Priority

### Multi-monitor Features
- [ ] **MM-1:** Add synchronized display modes across all monitors [6/10]
- [ ] **MM-2:** Implement per-monitor settings (different patterns on different monitors) [5/10]
- [ ] **MM-3:** Support for monitor-spanning images [4/10]
- [ ] **MM-4:** Handle dynamic monitor configuration changes [6/10]

### Miscellaneous
- [ ] **MISC-1:** Add localization support for multiple languages [3/10]
- [ ] **MISC-2:** Create a plugin system for custom patterns and transitions [2/10]
- [ ] **MISC-3:** Add keyboard shortcuts for manual navigation [4/10]
- [ ] **MISC-4:** Implement a slideshow mode with captions [5/10]
- [ ] **MISC-5:** Add screen blanking options for energy saving [6/10]
- [ ] **MISC-6:** Create a screensaver packaging system for macOS and Linux [4/10]

### Distribution and Installation
- [ ] **DIST-1:** Complete the Windows .scr file generation script [9/10]
- [ ] **DIST-2:** Create installer packages for Windows, macOS, and Linux [7/10]
- [ ] **DIST-3:** Add auto-update functionality [3/10]
- [ ] **DIST-4:** Create documentation for end users [8/10]

## Technical Debt
- [ ] **TD-1:** Improve code documentation and comments [6/10]
- [ ] **TD-2:** Add unit tests for core functionality [7/10]
- [ ] **TD-3:** Create integration tests for pattern generators [5/10]
- [ ] **TD-4:** Refactor renderer.ts to separate concerns more clearly [7/10]
- [ ] **TD-5:** Add stronger typing throughout the codebase [6/10]
- [ ] **TD-6:** Implement logging system for better debugging [5/10]
