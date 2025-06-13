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

// API endpoint to list directory contents
app.get('/api/directory', (req, res) => {
    try {
        const requestedPath = req.query.path || '';
        
        // Prevent directory traversal
        const safePath = path.normalize(requestedPath).replace(/^(\/|\\)+/, '');
        const fullPath = path.join(CONTENT_DIR, safePath);
        
        // Security check to prevent directory traversal
        if (!fullPath.startsWith(CONTENT_DIR)) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        
        // Check if path exists and is a directory
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Directory not found' });
        }
        
        if (!fs.statSync(fullPath).isDirectory()) {
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
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Serve static files from the dist directory
app.use(express.static(DIST_DIR));

// For all other routes, serve the Angular app
app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving static files from: ${DIST_DIR}`);
    console.log(`Content directory: ${CONTENT_DIR}`);
});
