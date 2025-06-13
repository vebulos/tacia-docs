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

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    
    // API route for content
    if (parsedUrl.pathname.startsWith('/api/content') || parsedUrl.pathname.startsWith('/api/content/')) {
        console.log('Processing API content request:', parsedUrl.pathname);
        return handleContentRequest(parsedUrl, res);
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
        message: 'Endpoint not found.'
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
            
            const result = entries.map(entry => {
                const entryPath = path.join(requestedPath, entry.name).replace(/\\/g, '/');
                const extname = path.extname(entry.name).toLowerCase();
                const isMarkdown = extname === '.md';
                
                return {
                    name: entry.name,
                    path: entryPath,
                    isDirectory: entry.isDirectory(),
                    type: entry.isDirectory() ? 'directory' : 'file',
                    isMarkdown: isMarkdown
                };
            });
            
            return sendResponse(res, 200, result);
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

function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data), 'utf-8');
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
