import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

// Get the current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ContentItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  filePath?: string;  // Only for files, includes .md extension
  metadata?: Record<string, any>;
  children?: ContentItem[];
}

const CONTENT_DIR = join(__dirname, '../src/content');
const OUTPUT_FILE = join(CONTENT_DIR, 'structure.json'); // Generate in source directory

function readFrontMatter(content: string): { metadata: Record<string, any>; content: string } {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontMatterRegex);
  
  if (!match) {
    return { metadata: {}, content };
  }

  const frontMatter = match[1];
  const metadata: Record<string, any> = {};

  frontMatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: any = line.slice(colonIndex + 1).trim();
      
      // Parse arrays like [item1, item2]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((item: string) => item.trim());
      }
      
      metadata[key] = value;
    }
  });

  return {
    metadata,
    content: content.slice(match[0].length)
  };
}

function scanDirectory(directory: string, basePath: string = ''): ContentItem[] {
  const items: ContentItem[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });
  
  // Process files first, then directories
  const files = [];
  const dirs = [];
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      dirs.push(entry);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entry);
    }
  }
  
  // Process files first
  for (const entry of files) {
    const fullPath = join(directory, entry.name);
    const relativePath = join(basePath, entry.name);
    
    const content = readFileSync(fullPath, 'utf8');
    const { metadata } = readFrontMatter(content);
    
    // Ensure metadata has required fields
    const fileNameWithoutExt = entry.name.replace(/\.md$/, '');
    const relativePathWithoutExt = join(basePath, fileNameWithoutExt);
    const filePath = `/${relativePath.replace(/\\/g, '/')}`;
    
    // Ensure metadata has required fields
    const fileMetadata = {
      title: metadata.title || fileNameWithoutExt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      categories: Array.isArray(metadata.categories) ? metadata.categories : [basePath.split('/')[0] || 'uncategorized'],
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      ...metadata
    };
    
    const item: ContentItem = {
      name: fileNameWithoutExt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      path: `/${relativePathWithoutExt.replace(/\\/g, '/')}`,
      filePath: filePath,
      type: 'file',
      metadata: fileMetadata
    };
    
    items.push(item);
  }
  
  // Then process directories
  for (const entry of dirs) {
    const fullPath = join(directory, entry.name);
    const relativePath = join(basePath, entry.name);
    
    const children = scanDirectory(fullPath, relativePath);
    // Check for README.md in the directory for metadata
    let dirMetadata: {
      title?: string;
      categories?: string[];
      tags?: string[];
      [key: string]: any;
    } = {};
    const readmePath = join(fullPath, 'README.md');
    
    if (existsSync(readmePath)) {
      try {
        const readmeContent = readFileSync(readmePath, 'utf8');
        const { metadata } = readFrontMatter(readmeContent);
        dirMetadata = metadata;
      } catch (e) {
        console.warn(`Error reading README.md in ${fullPath}:`, e);
      }
    }
    
    items.push({
      name: entry.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      path: `/${relativePath.replace(/\\/g, '/')}`,
      type: 'directory',
      metadata: {
        title: dirMetadata.title || entry.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        categories: Array.isArray(dirMetadata.categories) ? dirMetadata.categories : [basePath.split('/')[0] || 'uncategorized'],
        tags: Array.isArray(dirMetadata.tags) ? dirMetadata.tags : [],
        ...dirMetadata
      },
      children
    });
  }
  
  return items;
}

function generateContentStructure() {
  try {
    // Ensure output directory exists
    const outputDir = dirname(OUTPUT_FILE);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate structure
    const structure = scanDirectory(CONTENT_DIR);
    
    // Write to file
    const outputContent = JSON.stringify(structure, null, 2);
    writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
    console.log(`Content structure generated at: ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('Error generating content structure:', error);
    process.exit(1);
  }
}

generateContentStructure();
