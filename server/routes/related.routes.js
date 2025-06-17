import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default content directory (can be replaced with config)
const CONTENT_DIR = path.join(process.cwd(), 'src', 'assets', 'content');

// Simple in-memory cache for related documents
// Structure: { [documentPath]: { timestamp: Date, data: Array<RelatedDoc>, ttl: number } }
const relatedDocsCache = new Map();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Handler for fetching related documents based on tags and categories.
 * @param {Request} req - HTTP request object
 * @param {Response} res - HTTP response object
 */
export async function getRelatedDocuments(req, res) {
  try {
    // Get document path from query
    const documentPath = req.query?.path || '';
    const limit = parseInt(req.query?.limit || '5', 10);
    const skipCache = req.query?.skipCache === 'true';
    
    console.log(`[related] Getting related documents for path: ${documentPath}, limit: ${limit}, skipCache: ${skipCache}`);
    
    if (!documentPath) {
      console.warn('[related] Missing document path in request');
      res.statusCode = 400;
      return res.json({ 
        error: 'Missing document path', 
        details: 'The path parameter is required',
        related: [] 
      });
    }
    
    // Normalize the path to ensure consistent handling
    const normalizedPath = path.normalize(documentPath.replace(/\\/g, '/'));
    
    // Check cache first if not skipping
    if (!skipCache) {
      const cachedResult = getCachedRelatedDocs(normalizedPath, limit);
      if (cachedResult) {
        console.log(`[related] Cache hit for ${normalizedPath}`);
        return res.json({
          related: cachedResult,
          fromCache: true
        });
      }
    }
    
    // Get the directory containing the current document
    const documentDir = path.dirname(normalizedPath);
    const fullDocumentPath = path.join(CONTENT_DIR, normalizedPath);
    
    try {
      // Check if the document exists
      await fs.access(fullDocumentPath);
    } catch (error) {
      console.warn(`[related] Document not found: ${fullDocumentPath}`);
      res.statusCode = 404;
      return res.json({ 
        error: 'Document not found', 
        details: `The document at path '${normalizedPath}' does not exist`,
        related: [] 
      });
    }
    
    // Get metadata from the current document
    let currentDocMetadata = {};
    try {
      const content = await fs.readFile(fullDocumentPath, 'utf-8');
      const { data } = matter(content);
      currentDocMetadata = data || {};
    } catch (error) {
      console.warn(`[related] Error reading current document metadata: ${error.message}`);
    }
    
    // Find related documents
    const relatedDocs = await findRelatedDocuments(
      normalizedPath,
      documentDir,
      currentDocMetadata,
      limit
    );
    
    console.log(`[related] Found ${relatedDocs.length} related documents`);
    
    // Cache the results
    cacheRelatedDocs(normalizedPath, relatedDocs);
    
    return res.json({
      related: relatedDocs,
      fromCache: false
    });
  } catch (error) {
    console.error('[related] Error getting related documents:', error);
    res.statusCode = 500;
    return res.json({ error: 'Failed to get related documents', details: error.message, related: [] });
  }
}

/**
 * Get cached related documents if available and not expired
 * @param {string} documentPath - Path of the document
 * @param {number} limit - Maximum number of related documents to return
 * @returns {Array|null} Array of related documents or null if not cached
 */
function getCachedRelatedDocs(documentPath, limit) {
  const cacheEntry = relatedDocsCache.get(documentPath);
  
  if (!cacheEntry) {
    return null;
  }
  
  // Check if cache entry has expired
  const now = Date.now();
  if (now - cacheEntry.timestamp > cacheEntry.ttl) {
    console.log(`[related] Cache expired for ${documentPath}`);
    relatedDocsCache.delete(documentPath);
    return null;
  }
  
  // Return cached data limited to requested limit
  return cacheEntry.data.slice(0, limit);
}

/**
 * Cache related documents for a document
 * @param {string} documentPath - Path of the document
 * @param {Array} relatedDocs - Array of related documents
 * @param {number} ttl - Time to live in milliseconds (optional)
 */
function cacheRelatedDocs(documentPath, relatedDocs, ttl = DEFAULT_CACHE_TTL) {
  relatedDocsCache.set(documentPath, {
    timestamp: Date.now(),
    data: relatedDocs,
    ttl: ttl
  });
  
  console.log(`[related] Cached ${relatedDocs.length} documents for ${documentPath}, TTL: ${ttl}ms`);
  
  // Cleanup old cache entries if cache is getting too large
  if (relatedDocsCache.size > 100) {
    cleanupCache();
  }
}

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [key, entry] of relatedDocsCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      relatedDocsCache.delete(key);
      expiredCount++;
    }
  }
  
  console.log(`[related] Cache cleanup: removed ${expiredCount} expired entries, remaining: ${relatedDocsCache.size}`);
}

/**
 * Find documents related to the current document based on directory proximity and metadata.
 * @param {string} currentPath - Path of the current document
 * @param {string} documentDir - Directory containing the current document
 * @param {Object} currentMetadata - Metadata of the current document
 * @param {number} limit - Maximum number of related documents to return
 * @returns {Promise<Array>} Array of related documents
 */
async function findRelatedDocuments(currentPath, documentDir, currentMetadata, limit) {
  try {
    // Get all markdown files in the same directory
    const relatedDocs = [];
    const candidates = [];
    
    // First, get files from the same directory
    const sameDirectoryFiles = await getMarkdownFilesInDirectory(documentDir);
    
    // Add files from the same directory to candidates with high relevance
    for (const file of sameDirectoryFiles) {
      const filePath = path.join(documentDir, file).replace(/\\/g, '/');
      
      // Skip the current document
      if (filePath === currentPath) {
        continue;
      }
      
      candidates.push({
        path: filePath,
        relevance: 10, // High relevance for same directory
        metadata: {}
      });
    }
    
    // If we're in a subdirectory, also check the parent directory
    if (documentDir !== '.') {
      const parentDir = path.dirname(documentDir);
      const parentDirFiles = await getMarkdownFilesInDirectory(parentDir);
      
      // Add files from parent directory with medium relevance
      for (const file of parentDirFiles) {
        const filePath = path.join(parentDir, file).replace(/\\/g, '/');
        
        // Skip directories
        if ((await fs.stat(path.join(CONTENT_DIR, filePath))).isDirectory()) {
          continue;
        }
        
        candidates.push({
          path: filePath,
          relevance: 5, // Medium relevance for parent directory
          metadata: {}
        });
      }
    }
    
    // Process candidates to get their metadata and calculate final relevance
    for (const candidate of candidates) {
      try {
        const fullPath = path.join(CONTENT_DIR, candidate.path);
        const content = await fs.readFile(fullPath, 'utf-8');
        const { data } = matter(content);
        
        // Extract title from metadata or filename
        let title = data.title;
        if (!title) {
          // Extract filename without extension
          const basename = path.basename(candidate.path, '.md');
          title = basename
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        }
        
        // Calculate tag relevance if both documents have tags
        let commonTags = [];
        let tagRelevance = 0;
        
        if (data.tags && currentMetadata.tags) {
          const candidateTags = Array.isArray(data.tags) ? data.tags : [data.tags];
          const currentTags = Array.isArray(currentMetadata.tags) ? currentMetadata.tags : [currentMetadata.tags];
          
          commonTags = candidateTags.filter(tag => currentTags.includes(tag));
          tagRelevance = commonTags.length * 3; // 3 points per common tag
        }
        
        // Calculate final relevance score
        const finalRelevance = candidate.relevance + tagRelevance;
        
        relatedDocs.push({
          path: candidate.path.replace(/\.md$/, ''), // Remove .md extension for frontend
          title: title,
          commonTags: commonTags,
          commonTagsCount: commonTags.length,
          relevance: finalRelevance
        });
      } catch (error) {
        console.warn(`[related] Error processing candidate ${candidate.path}:`, error);
      }
    }
    
    // Sort by relevance (highest first) and limit results
    return relatedDocs
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  } catch (error) {
    console.error('[related] Error finding related documents:', error);
    return [];
  }
}

/**
 * Get all markdown files in a directory.
 * @param {string} dirPath - Relative path to the directory
 * @returns {Promise<Array<string>>} Array of filenames
 */
async function getMarkdownFilesInDirectory(dirPath) {
  try {
    const fullPath = path.join(CONTENT_DIR, dirPath);
    const files = await fs.readdir(fullPath);
    
    // Filter for markdown files only
    return files.filter(file => 
      file.endsWith('.md') && 
      !file.startsWith('.')
    );
  } catch (error) {
    console.warn(`[related] Error reading directory ${dirPath}:`, error);
    return [];
  }
}