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
        console.log('Requête sur la racine de l\'API');
        return sendResponse(res, 200, {
            name: 'API de contenu Markdown',
            version: '1.0.0',
            endpoints: [
                'GET /api/content?path= - Récupère le contenu d\'un fichier Markdown',
                'GET /api/content/ - Récupère le contenu d\'un fichier Markdown (via chemin URL)'
            ]
        });
    }
    
    // For all other requests, return 404
    console.log('Endpoint non trouvé:', parsedUrl.pathname);
    sendResponse(res, 404, { 
        error: 'Not Found',
        message: 'Endpoint non trouvé. Essayez /api/content?path='
    });
});

// Function to handle content requests
function handleContentRequest(parsedUrl, res) {
    try {
        console.log('=== NOUVELLE REQUÊTE CONTENT ===');
        console.log('URL complète:', parsedUrl.href);
        console.log('Chemin demandé (pathname):', parsedUrl.pathname);
        console.log('Paramètres de requête:', parsedUrl.query);
        
        // Get path from query parameter or URL path
        let requestedPath = parsedUrl.query.path || '';
        
        // If no query parameter, try to get it from URL path
        if (!requestedPath && parsedUrl.pathname.startsWith('/api/content/')) {
            requestedPath = parsedUrl.pathname.replace('/api/content/', '');
        }
        
        console.log('Chemin demandé après traitement:', requestedPath || '(racine)');
        
        // Basic path normalization
        let safePath = path.normalize(requestedPath)
            .replace(/^[\\/]+/, '') // Remove leading slashes
            .replace(/\/\.\.?\//g, '/') // Remove any ./ or ../
            .replace(/[\\/]+/g, path.sep); // Normalize path separators
            
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
        console.log('Chemin complet sur le disque:', fullPath);
        
        // Security check - prevent directory traversal
        if (!fullPath.startsWith(CONTENT_DIR)) {
            console.error('Tentative d\'accès non autorisé en dehors du répertoire de contenu');
            return sendResponse(res, 400, { error: 'Chemin invalide' });
        }
        
        // Check if path exists
        if (!fs.existsSync(fullPath)) {
            console.error('Chemin introuvable:', fullPath);
            return sendResponse(res, 404, { 
                error: 'Ressource non trouvée',
                path: requestedPath,
                fullPath: fullPath
            });
        }
        
        const stat = fs.statSync(fullPath);
        
        // If it's a directory, list its contents
        if (stat.isDirectory()) {
            console.log('Listage du répertoire:', fullPath);
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
        console.log('Tentative de lecture du fichier:', fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        // Special handling for markdown files
        if (ext === '.md') {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                return sendResponse(res, 200, {
                    path: requestedPath,
                    name: path.basename(requestedPath),
                    content: content,
                    type: 'file',
                    isMarkdown: true
                });
            } catch (error) {
                console.error('Erreur de lecture du fichier Markdown:', error);
                return sendResponse(res, 500, { 
                    error: 'Erreur de lecture du fichier',
                    details: error.message 
                });
            }
        }
        
        // For other file types, serve them directly
        return serveFile(fullPath, contentType, res);
        
    } catch (error) {
        console.error('Erreur dans handleContentRequest:', error);
        return sendResponse(res, 500, { 
            error: 'Erreur interne du serveur',
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
                    message: `Le fichier ${path.basename(filePath)} n'existe pas.`
                }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Server Error',
                    message: 'Erreur lors de la lecture du fichier.'
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
    console.log(`=== API Server is running ===`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Content directory: ${CONTENT_DIR}`);
    console.log('\nAvailable endpoints:');
    console.log(`  GET  /api/content/*    - Get Markdown content`);
    console.log(`  GET  /api/directory/*  - List directory contents`);
    console.log('\nUsage with ng serve:');
    console.log('  1. ng serve --port=4200');
    console.log('  2. node native-server-fixed.js --port=4201');
    console.log('  3. Configure proxy in proxy.conf.json');
});

// Handle errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1); // Quitte le processus en cas d'erreur non gérée
});
