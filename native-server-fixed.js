const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Default configuration
const DEFAULT_PORT = 4201;
const DEFAULT_CONTENT_DIR = path.join(process.cwd(), 'src', 'assets', 'content');

// Function to extract command line arguments
function getArgValue(argName, defaultValue) {
    const arg = process.argv.find(arg => arg.startsWith(`--${argName}=`));
    return arg ? arg.split('=')[1] : defaultValue;
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('\nMarkdown Content API Server');
    console.log('Usage:');
    console.log(`  node ${path.basename(__filename)} [--port=PORT] [--content-dir=PATH]`);
    console.log('\nOptions:');
    console.log(`  --port=PORT           Server port (default: ${DEFAULT_PORT})`);
    console.log(`  --content-dir=PATH    Path to content directory (default: ${DEFAULT_CONTENT_DIR})`);
    console.log("  --help, -h            Show this help message\n");
    process.exit(0);
}

// Get command line arguments
const PORT = parseInt(getArgValue('port', DEFAULT_PORT), 10) || DEFAULT_PORT;
const CONTENT_DIR = path.resolve(process.cwd(), getArgValue('content-dir', DEFAULT_CONTENT_DIR));

// Check if content directory exists
if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Error: Content directory does not exist: ${CONTENT_DIR}`);
    process.exit(1);
}

// Function to extract front matter from markdown content
function extractFrontMatter(content) {
    const frontMatter = {};
    const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    
    if (frontMatterMatch) {
        const yamlContent = frontMatterMatch[1];
        const markdownContent = frontMatterMatch[2];
        
        // Simple YAML parsing (basic key: value)
        yamlContent.split('\n').forEach(line => {
            if (line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                
                // Handle array values (simple case)
                if (value.startsWith('[') && value.endsWith(']')) {
                    frontMatter[key.trim()] = value
                        .slice(1, -1)
                        .split(',')
                        .map(item => item.trim().replace(/^['"]|['"]$/g, ''));
                } else {
                    frontMatter[key.trim()] = value.replace(/^['"]|['"]$/g, '');
                }
            }
        });
        
        return {
            metadata: frontMatter,
            content: markdownContent
        };
    }
    
    return {
        metadata: {},
        content
    };
}

// Cache for document metadata to improve performance
const documentCache = new Map();

// MIME types for content files
const MIME_TYPES = {
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

// Create the HTTP server with CORS support
const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    // Handle preflight (OPTIONS) requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Content-Length': '0'
        });
        return res.end();
    }
    
    // Add CORS headers to all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    
    // API route for content
    if (parsedUrl.pathname.startsWith('/api/content') || parsedUrl.pathname.startsWith('/api/content/')) {
        console.log('Processing API content request:', parsedUrl.pathname);
        return handleContentRequest(parsedUrl, res);
    }
    
    // API route for related documents
    if (parsedUrl.pathname === '/api/related' && req.method === 'GET') {
        console.log('Processing related documents request:', parsedUrl.pathname);
        return handleRelatedRequest(parsedUrl, res);
    }
    
    // Root API route
    if (parsedUrl.pathname === '/api' || parsedUrl.pathname === '/api/') {
        console.log('API root request');
        return sendResponse(res, 200, {
            name: 'Markdown Content API',
            version: '1.0.0',
            endpoints: [
                'GET /api/content?path= - Get Markdown file content',
                'GET /api/content/ - Get Markdown file content (via URL path)'
            ]
        });
    }
    
    // For all other requests, return 404
    console.log('Endpoint not found:', parsedUrl.pathname);
    sendResponse(res, 404, { 
        error: 'Not Found',
        message: 'Endpoint not found.',
        availableEndpoints: [
            'GET /api/content?path= - Get content',
            'GET /api/related?path=&limit=5 - Get related documents'
        ]
    });
});

// Function to handle content requests
function handleContentRequest(parsedUrl, res) {
    try {
        console.log('=== NEW CONTENT REQUEST ===');
        console.log('Full URL:', parsedUrl.href);
        console.log('Requested path (pathname):', parsedUrl.pathname);
        console.log('Query parameters:', parsedUrl.query);
        
        // Get path from query parameter or URL path
        let requestedPath = parsedUrl.query.path || '';
        
        // If no query parameter, try to get it from URL path
        if (!requestedPath && parsedUrl.pathname.startsWith('/api/content/')) {
            requestedPath = parsedUrl.pathname.replace('/api/content/', '');
        }
        
        console.log('Processed requested path:', requestedPath || '(root)');
        
        // Basic path normalization
        let safePath = path.normalize(requestedPath)
            .replace(/^[\\/]+/, '') // Remove leading slashes
            .replace(/\/\.\.?\//g, '/') // Remove any ./ or ../
            .replace(/[\\/]+/g, '/'); // Always use forward slashes for consistency
            
        // Remove any remaining .. segments for security
        const parts = safePath.split(path.sep);
        const filteredParts = [];
        for (const part of parts) {
            if (part === '..') {
                filteredParts.pop();
            } else if (part && part !== '.') {
                filteredParts.push(part);
            }
        }
        safePath = filteredParts.join(path.sep);
            
        const fullPath = path.join(CONTENT_DIR, safePath);
        console.log('Full disk path:', fullPath);
        
        // Security check - prevent directory traversal
        if (!fullPath.startsWith(CONTENT_DIR)) {
            console.error('Unauthorized access attempt outside content directory');
            return sendResponse(res, 400, { error: 'Invalid path' });
        }
        
        // Check if path exists
        if (!fs.existsSync(fullPath)) {
            console.error('Path not found:', fullPath);
            return sendResponse(res, 404, { 
                error: 'Resource not found',
                path: requestedPath,
                fullPath: fullPath
            });
        }
        
        const stat = fs.statSync(fullPath);
        
        // If it's a directory, list its contents
        if (stat.isDirectory()) {
            console.log('Listing directory:', fullPath);
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            
            // Map entries with their metadata
            const mappedEntries = entries.map(entry => {
                const entryPath = path.join(requestedPath, entry.name).replace(/\\/g, '/');
                const extname = path.extname(entry.name).toLowerCase();
                const isMarkdown = extname === '.md';
                const isDirectory = entry.isDirectory();
                
                return {
                    name: entry.name,
                    path: entryPath,
                    isDirectory: isDirectory,
                    type: isDirectory ? 'directory' : 'file',
                    isMarkdown: isMarkdown
                };
            });

            // Sort entries: files first, then directories, both alphabetically by name
            const sortedEntries = [...mappedEntries].sort((a, b) => {
                // If one is a file and the other is a directory, sort files first
                if (!a.isDirectory && b.isDirectory) return -1;
                if (a.isDirectory && !b.isDirectory) return 1;
                
                // Otherwise, sort alphabetically by name
                return a.name.localeCompare(b.name);
            });
            
            
            return sendResponse(res, 200, sortedEntries);
        }
        
        // If it's a file, serve it
        console.log('Attempting to read file:', fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        // Special handling for markdown files
        if (ext === '.md') {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const { metadata, content: markdownContent } = extractFrontMatter(content);
                
                // Use the title from metadata if available, otherwise use the filename without extension
                const title = metadata.title || path.basename(requestedPath, '.md')
                    .replace(/[-_]/g, ' ') // Replace underscores and hyphens with spaces
                    .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word
                
                return sendResponse(res, 200, {
                    path: requestedPath,
                    name: path.basename(requestedPath),
                    content: markdownContent || content,
                    type: 'file',
                    isMarkdown: true,
                    metadata: {
                        title,
                        ...metadata
                    }
                });
            } catch (error) {
                console.error('Error reading Markdown file:', error);
                return sendResponse(res, 500, { 
                    error: 'File read error',
                    details: error.message 
                });
            }
        }
        
        // For other file types, serve them directly
        return serveFile(fullPath, contentType, res);
        
    } catch (error) {
        console.error('Error in handleContentRequest:', error);
        return sendResponse(res, 500, { 
            error: 'Internal server error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

// Utility function to serve a file with error handling
function serveFile(filePath, contentType, res) {
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Not Found',
                    message: `File ${path.basename(filePath)} does not exist.`
                }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Server Error',
                    message: 'Error reading file.'
                }));
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=300' // 5 minutes cache
            });
            res.end(content, 'utf-8');
        }
    });
}

// Function to handle related documents request
function handleRelatedRequest(parsedUrl, res) {
    try {
        const { path: docPath, limit = 5 } = parsedUrl.query;
        
        if (!docPath) {
            return sendResponse(res, 400, { 
                error: 'Bad Request',
                message: 'Path parameter is required' 
            });
        }
        
        // Decode the document path
        const decodedPath = decodeURIComponent(docPath);
        
        // Get the document to find related content for
        const fullPath = path.join(CONTENT_DIR, decodedPath);
        
        // Security check
        if (!fullPath.startsWith(CONTENT_DIR)) {
            return sendResponse(res, 400, { error: 'Invalid path' });
        }
        
        if (!fs.existsSync(fullPath)) {
            return sendResponse(res, 404, { error: 'Document not found' });
        }
        
        // Get source document metadata
        let sourceContent;
        try {
            sourceContent = fs.readFileSync(fullPath, 'utf8');
        } catch (error) {
            console.error(`Error reading file ${fullPath}:`, error);
            return sendResponse(res, 404, { 
                error: 'Document not found',
                details: `Unable to read file: ${fullPath}`
            });
        }

        const { metadata: sourceMetadata = {} } = extractFrontMatter(sourceContent);
        const sourceTags = new Set(
            ((sourceMetadata && sourceMetadata.tags) || []).map(t => String(t).toLowerCase())
        );
        
        if (sourceTags.size === 0) {
            return sendResponse(res, 200, { related: [] });
        }
        
        // Find all markdown files
        const allFiles = [];
        function scanDirectory(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
                    allFiles.push(fullPath);
                }
            }
        }
        
        scanDirectory(CONTENT_DIR);
        
        // Process files to find related content
        const related = [];
        
        for (const filePath of allFiles) {
            // Skip the source file
            if (path.normalize(filePath) === path.normalize(fullPath)) {
                continue;
            }
            
            let metadata;
            
            // Try to get from cache first
            if (documentCache.has(filePath)) {
                metadata = documentCache.get(filePath);
            } else {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const result = extractFrontMatter(content);
                    metadata = result.metadata || {};
                    
                    // Cache the metadata
                    documentCache.set(filePath, metadata);
                } catch (error) {
                    console.error(`Error reading file ${filePath}:`, error);
                    continue;
                }
            }
            
            const targetTags = new Set(
                ((metadata.tags || [])).map(t => t.toLowerCase())
            );
            
            // Find common tags
            const commonTags = [...sourceTags].filter(tag => targetTags.has(tag));
            
            if (commonTags.length > 0) {
                const relativePath = path.relative(CONTENT_DIR, filePath).replace(/\\/g, '/');
                
                related.push({
                    path: relativePath,
                    title: metadata.title || path.basename(filePath, '.md'),
                    commonTags,
                    commonTagsCount: commonTags.length
                });
            }
        }
        
        // Sort by number of common tags (descending) and limit results
        const sortedRelated = related
            .sort((a, b) => b.commonTagsCount - a.commonTagsCount)
            .slice(0, parseInt(limit, 10));
        
        return sendResponse(res, 200, { related: sortedRelated });
        
    } catch (error) {
        console.error('Error in handleRelatedRequest:', error);
        return sendResponse(res, 500, { 
            error: 'Internal server error',
            details: error.message 
        });
    }
}

// Function to send JSON responses
function sendResponse(res, statusCode, data) {
    try {
        const responseData = JSON.stringify(data);
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(responseData),
            'Connection': 'close',
            // CORS headers
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400' // 24 hours
        };
        
        res.writeHead(statusCode, headers);
        res.end(responseData);
    } catch (error) {
        console.error('Error sending response:', error);
        res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to process response'
        }));
    }
}

// Start the server
server.listen(PORT, () => {
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Content directory: ${CONTENT_DIR}`);
    console.log('\nAvailable endpoints:');
    console.log(`  GET  /api/content/*    - Get Markdown content`);
    console.log('\nUsage with ng serve:');
    console.log('  1. ng serve --port=4200');
    console.log('  2. node native-server-fixed.js --port=4201');
    console.log('  3. Configure proxy in proxy.conf.json');
    console.log(`\n=== API Server is running ===`);
});

// Handle errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1); // Exit process on unhandled error
});
