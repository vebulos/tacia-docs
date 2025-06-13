const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 4201;
const DIST_DIR = path.join(__dirname, 'dist', 'frontend', 'browser');
const CONTENT_DIR = path.join(DIST_DIR, 'assets', 'content');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
    '.md': 'text/markdown'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    
    // Handle API request
    if (parsedUrl.pathname === '/api/directory') {
        console.log('API Request - Query:', parsedUrl.query);
        handleApiRequest(parsedUrl, res);
        return;
    }
    
    // Handle static files
    serveStaticFile(parsedUrl.pathname, res);
});

            return;
        }
        
        // Check if path exists and is a directory
        if (!fs.existsSync(fullPath)) {
            sendResponse(res, 404, { error: 'Directory not found' });
            return;
        }
        
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) {
            sendResponse(res, 400, { error: 'Path is not a directory' });
            return;
        }
        
        // Read directory contents
        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = entries.map(entry => ({
            name: entry.name,
            path: path.join(requestedPath, entry.name).replace(/\\/g, '/'),
            isDirectory: entry.isDirectory(),
            type: entry.isDirectory() ? 'directory' : 'file'
        }));
        
        sendResponse(res, 200, result);
    } catch (error) {
        console.error('API Error:', error);
        sendResponse(res, 500, { error: 'Internal server error' });
    }
}

function serveStaticFile(pathname, res) {
    // Default to index.html for SPA routing
    if (pathname === '/' || !path.extname(pathname)) {
        pathname = '/index.html';
    }
    
    // Remove query string
    pathname = pathname.split('?')[0];
    
    const filePath = path.join(DIST_DIR, pathname);
    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found, serve index.html for SPA routing
                if (extname === '.html') {
                    sendResponse(res, 404, 'File not found');
                } else {
                    serveStaticFile('/index.html', res);
                }
            } else {
                // Server error
                console.error('Error reading file:', error);
                sendResponse(res, 500, 'Server error');
            }
        } else {
            // Success
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': extname === '.html' ? 'no-cache' : 'public, max-age=86400'
            });
            res.end(content, 'utf-8');
        }
    });
}

function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data), 'utf-8');
}

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving static files from: ${DIST_DIR}`);
    console.log(`Content directory: ${CONTENT_DIR}`);
});

// Handle errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
