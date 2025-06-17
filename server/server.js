import http from 'http';
import url from 'url';
import { getMarkdownContent } from './routes/content.routes.js';

const PORT = process.env.PORT || 4201;

/**
 * Minimal HTTP server for Markdown Content API
 */
const server = http.createServer(async (req, res) => {
  // Enable CORS for all API requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);

  // Route for markdown content API
  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/api/content')) {
    // Attach query and params for route handler compatibility
    req.query = parsedUrl.query;
    req.params = { path: parsedUrl.pathname.replace('/api/content/', '') };
    // Patch res.json for convenience
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    await getMarkdownContent(req, res);
    return;
  }

  // Fallback for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[server] Markdown Content API running at http://localhost:${PORT}`);
});
