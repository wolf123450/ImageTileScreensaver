const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get application version from package.json
const packageJson = require('../package.json');
const version = packageJson.version;
// Use name if productName is not available
const appName = packageJson.productName ? 
  packageJson.productName.replace(/\s+/g, '') : 
  packageJson.name.replace(/-/g, '');

// Paths
const buildDir = path.join(__dirname, '../build/win-unpacked');
const mainExePath = path.join(buildDir, `${packageJson.productName || packageJson.name}.exe`);
const scrOutputDir = path.join(__dirname, '../build/screensaver');
const scrOutputPath = path.join(scrOutputDir, `${appName}.scr`);

// Create output directory if it doesn't exist
if (!fs.existsSync(scrOutputDir)) {
  fs.mkdirSync(scrOutputDir, { recursive: true });
}

// Check if the executable exists
if (!fs.existsSync(mainExePath)) {
  console.error(`Error: Executable not found at ${mainExePath}`);
  process.exit(1);
}

// Copy entire build directory to screensaver directory
console.log(`Copying build files to ${scrOutputDir}`);
fs.cpSync(buildDir, scrOutputDir, { recursive: true });

// Rename the main exe to .scr file
const exeInScrDir = path.join(scrOutputDir, `${packageJson.productName || packageJson.name}.exe`);
console.log(`Creating screensaver file by renaming: ${exeInScrDir} to ${scrOutputPath}`);
fs.renameSync(exeInScrDir, scrOutputPath);

console.log('Screensaver package created successfully');

// Instructions for uninstallation of previous broken installation
console.log('\nTo uninstall the previously installed screensaver:');
console.log('1. Open Command Prompt as Administrator');
console.log(`2. Run: reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Screen Savers\\${appName}" /f`);
console.log('3. Delete the .scr file from C:\\Windows\\System32 if it exists');

// Instructions for installation
console.log('\nNew installation instructions:');
console.log(`1. Copy the entire "${scrOutputDir}" folder to a permanent location`);
console.log('2. Right-click the .scr file in that location and select "Install"');
console.log('3. Configure the screensaver through the normal Windows settings');