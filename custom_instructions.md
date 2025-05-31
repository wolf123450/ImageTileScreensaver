# Custom Instructions for LLM Code Collaboration

## Project Context
This repository contains an Image Tile Screensaver application built with Electron and TypeScript. It displays images from local directories in a dynamic tile layout across multiple monitors, functioning as a proper screensaver on Windows systems as well as a standalone application.

## Code Style Guidelines

### TypeScript Best Practices
- Use TypeScript's strong typing system; avoid `any` types where possible
- Prefer interfaces over types for object shape definitions
- Use meaningful variable and function names that convey purpose
- Add JSDoc comments for public functions and complex code blocks
- Follow functional programming principles when appropriate
- Use optional chaining and nullish coalescing where applicable

### Project Structure
- Main process code goes in `src/`
- Renderer process code is also in `src/` with clear separation of concerns
- Pattern generation logic is in `src/patterns/`
- Display management is in `src/display.ts`
- Configuration handling is in `src/config.ts`
- Keep files focused on a single responsibility

## When Writing Code

### Consider Performance
- This is a screensaver application that displays and animates images across multiple monitors
- Optimize image loading and rendering operations
- Use efficient data structures for handling large collections of images
- Implement lazy loading techniques for image resources
- Minimize memory usage when processing large image collections
- Consider GPU acceleration where appropriate

### Error Handling
- Add proper error handling for all file operations
- Include user-friendly error messages
- Log errors appropriately for debugging
- Provide fallback behaviors when resources are unavailable

### Multi-Monitor Support
- Code should handle multiple monitors correctly
- Consider different monitor arrangements and resolutions
- Handle cases where monitors have different DPI settings
- Test with various multi-monitor configurations

### Testing Suggestions
- Write code that is testable
- Suggest test cases for critical functionality
- Consider edge cases (extremely large images, slow file systems, etc.)
- Test with different image formats and sizes

## When Providing Explanations
- Explain the rationale behind complex algorithms
- Document any performance optimizations
- Note any areas where future improvements could be made
- Provide context for why certain approaches were chosen over alternatives

## Dependencies
- Suggest minimal dependencies
- Prefer well-established, maintained libraries
- Explain why a dependency is needed when suggesting one
- Consider the impact on build size and performance

## Security Considerations
- Follow secure coding practices, especially for file system operations
- Don't hardcode sensitive values
- Suggest proper input validation
- Be cautious with file path handling to prevent directory traversal attacks

## Cross-Platform Compatibility
- Remember this is an Electron app that should run on Windows, macOS, and Linux
- Consider path handling differences between operating systems
- Be aware of platform-specific APIs and suggest alternatives when needed
- Windows screensaver mode requires special handling of command line arguments

## Windows Screensaver Integration
- The app functions as a standard Windows .scr screensaver
- Handle Windows-specific screensaver command line arguments (/s, /c, /p)
- Support proper user interaction behavior (exit on mouse/keyboard activity)
- Implement appropriate power management considerations
