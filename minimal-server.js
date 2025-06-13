const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4201;
const DIST_DIR = path.join(__dirname, 'dist', 'frontend');
const CONTENT_DIR = path.join(DIST_DIR, 'assets', 'content');

// Middleware de base
app.use(express.json());

// API endpoint simplifié
app.get('/api/directory', (req, res) => {
    try {
        const requestedPath = req.query.path || '';
        const safePath = path.normalize(requestedPath).replace(/^(\/|\\)+/, '');
        const fullPath = path.join(CONTENT_DIR, safePath);
        
        // Vérification de sécurité
        if (!fullPath.startsWith(CONTENT_DIR)) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        
        // Vérification du dossier
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
            return res.status(404).json({ error: 'Directory not found' });
        }
        
        // Lecture du contenu du dossier
        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        const result = entries.map(entry => ({
            name: entry.name,
            path: path.join(requestedPath, entry.name).replace(/\\/g, '/'),
            isDirectory: entry.isDirectory(),
            type: entry.isDirectory() ? 'directory' : 'file'
        }));
        
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Servir les fichiers statiques
app.use(express.static(DIST_DIR));

// Toutes non gérées renvoient vers index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving from: ${DIST_DIR}`);
});
