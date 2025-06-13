const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 4201;

// Configuration
const DIST_DIR = path.join(__dirname, 'dist', 'frontend');
const CONTENT_DIR = path.join(DIST_DIR, 'assets', 'content');

// Middleware
app.use(cors());
app.use(express.json());

// Simple API endpoint to list directory contents
app.get('/api/directory', (req, res) => {
    try {
        const requestedPath = req.query.path || '';
        
        // Basic path normalization
        const safePath = path.normalize(requestedPath)
            .replace(/^(\/|\\)+/, '') // Remove leading slashes
            .replace(/\.\.\//g, '') // Remove any ../
            .replace(/\.\\/g, '') // Remove any .\
            .replace(/\/\//g, '/'); // Replace double slashes
            
        const fullPath = path.join(CONTENT_DIR, safePath);
        
        // Security check to prevent directory traversal
        if (!fullPath.startsWith(CONTENT_DIR)) {
            console.error('Security alert: Attempted directory traversal');
            return res.status(400).json({ error: 'Invalid path' });
        }
        
        // Check if path exists and is a directory
        if (!fs.existsSync(fullPath)) {
            console.error('Path not found:', fullPath);
            return res.status(404).json({ error: 'Directory not found' });
        }
        
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) {
            console.error('Path is not a directory:', fullPath);
            return res.status(400).json({ error: 'Path is not a directory' });
        }
        
        // Read directory contents
        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        
        // Map directory entries to a simpler format
        const result = entries.map(entry => ({
            name: entry.name,
            path: path.join(requestedPath, entry.name).replace(/\\/g, '/'),
            isDirectory: entry.isDirectory(),
            type: entry.isDirectory() ? 'directory' : 'file'
        }));
        
        res.json(result);
    } catch (error) {
        console.error('Error in /api/directory:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Serve static files from the dist directory
app.use(express.static(DIST_DIR, {
    dotfiles: 'ignore',
    etag: true,
    extensions: ['html', 'js', 'css', 'json'],
    index: 'index.html',
    maxAge: '1d',
    redirect: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// For all other routes, serve the Angular app
app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'), {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An unexpected error occurred' 
    });
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving static files from: ${DIST_DIR}`);
    console.log(`Content directory: ${CONTENT_DIR}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    server.close(() => process.exit(1));
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
