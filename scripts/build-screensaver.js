const { execSync } = require('child_process');
const path = require('path');

// Execute commands and print output
function runCommand(command) {
  console.log(`\n> Running: ${command}\n`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error);
    process.exit(1);
  }
}

// Main build process
async function buildScreensaver() {
  try {
    // Step 1: Build production webpack bundle
    runCommand('webpack --mode=production');

    // Step 2: Build electron app with electron-builder
    runCommand('electron-builder --config electron-builder.json');

    // Step 3: Now we can prune dev dependencies before running create-screensaver
    // This is needed if create-screensaver has specific production requirements
    runCommand('npm prune --production');
    
    // Step 4: Run the screensaver creation script
    runCommand('node scripts/create-screensaver.js');

    console.log('\nBuild completed successfully!');
  } catch (error) {
    console.error('Build process failed:', error);
    process.exit(1);
  }
}

// Execute the build process
buildScreensaver();
