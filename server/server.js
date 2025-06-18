import http from 'http';
import url from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMarkdownContent } from './routes/content.routes.js';
import { getRelatedDocuments } from './routes/related.routes.js';
import { getContentStructure } from './routes/content-structure.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  if (key.startsWith('--')) {
    acc[key.slice(2)] = value || true;
  }
  return acc;
}, {});

const PORT = args.port || process.env.PORT || 4201;
export const CONTENT_DIR = args['content-dir'] 
  ? path.resolve(process.cwd(), args['content-dir'])
  : path.join(process.cwd(), 'src', 'assets', 'content');

console.log(`[server] Content directory: ${CONTENT_DIR}`);

/**
 * Minimal HTTP server for Markdown Content API
 */
const server = http.createServer(async (req, res) => {
  // Enable CORS for all API requests
  const allowedOrigins = ['http://localhost:4200', 'http://localhost:8080'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Cache-Control, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);

  // Patch res.json for convenience for all routes
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  // Route for markdown content API with path parameter
  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/api/content/')) {
    const pathParam = parsedUrl.pathname.substring('/api/content/'.length);
    req.params = { path: pathParam };
    
    // Parse query parameters properly
    const queryParams = {};
    for (const [key, value] of Object.entries(parsedUrl.query || {})) {
      queryParams[key] = value;
    }
    req.query = queryParams;
    
    // Log the request for debugging
    console.log(`[server] GET /api/content/${pathParam} with query:`, req.query);
    
    await getMarkdownContent(req, res);
    return;
  }

  // Route for related documents API
  if (req.method === 'GET' && parsedUrl.pathname === '/api/related') {
    // Parse query parameters properly
    const queryParams = {};
    for (const [key, value] of Object.entries(parsedUrl.query || {})) {
      queryParams[key] = value;
    }
    req.query = queryParams;
    
    // Log the request for debugging
    console.log('[server] GET /api/related with query:', req.query);
    
    await getRelatedDocuments(req, res);
    return;
  }

  // Route for content structure API (without path parameter)
  if (req.method === 'GET' && parsedUrl.pathname === '/api/content') {
    // Parse query parameters properly
    const queryParams = {};
    for (const [key, value] of Object.entries(parsedUrl.query || {})) {
      queryParams[key] = value;
    }
    req.query = queryParams;
    
    // Log the request for debugging
    console.log('[server] GET /api/content with query:', req.query);
    
    await getContentStructure(req, res);
    return;
  }

  // Fallback for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[server] Markdown Content API running at http://localhost:${PORT}`);
});
