// scripts/add-metadata.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  if (key.startsWith('--')) {
    acc[key.slice(2)] = value || true;
  }
  return acc;
}, {});

// Get content directory from args
const contentDir = args['content-dir'];

// Validate content directory is provided
if (!contentDir) {
  console.error('[ERROR] Content directory not specified. Please provide --content-dir parameter.');
  process.exit(1);
}

// Resolve the final content directory path
const CONTENT_DIR = path.resolve(contentDir);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if content has front matter
function hasFrontMatter(content) {
  return content.startsWith('---\n') && content.includes('\n---\n');
}

// Create default metadata block based on file name
function createDefaultMetadata(filePath) {
  const fileName = path.basename(filePath, '.md');
  const title = fileName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `---
title: "${title}"
tags: []
---
`;
}

// Process a markdown file
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Skip if file already has metadata
    if (hasFrontMatter(content)) {
      console.log(`Skipping ${filePath} - already has metadata`);
      return;
    }

    // Add default metadata
    const newContent = createDefaultMetadata(filePath) + content;
    await fs.writeFile(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath} with default metadata`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Recursively process a directory
async function processDirectory(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        await processFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
  }
}

// Entry point
async function main() {
  try {
    // Validate content directory exists and is accessible
    try {
      await fs.access(CONTENT_DIR);
      console.log(`[info] Using content directory: ${CONTENT_DIR}`);
    } catch (error) {
      console.error(`[ERROR] Content directory error: ${error.message}`);
      process.exit(1);
    }

    console.log(`[info] Starting to process markdown files in: ${CONTENT_DIR}`);
    await processDirectory(CONTENT_DIR);
    console.log('[info] Finished processing markdown files');
  } catch (error) {
    console.error('[ERROR] An unexpected error occurred:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

