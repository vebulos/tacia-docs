const fs = require('fs-extra');
const path = require('path');

const srcDir = path.join(__dirname, '../src/content');
const destDir = path.join(__dirname, '../src/assets/content');

// Ensure the destination directory exists
fs.ensureDirSync(destDir);

// Remove all files and subdirectories in the destination directory
fs.emptyDirSync(destDir);

// Copy the content directory
fs.copySync(srcDir, destDir, { overwrite: true });

console.log('Content files copied to assets directory');
