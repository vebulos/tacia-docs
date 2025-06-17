import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownService from '../services/markdown.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default content directory (can be replaced with config)
const CONTENT_DIR = path.join(process.cwd(), 'src', 'assets', 'content');

/**
 * Handler for fetching and parsing markdown content.
 * @param {Request} req - HTTP request object
 * @param {Response} res - HTTP response object
 */
export async function getMarkdownContent(req, res) {
  try {
    // Get markdown path from query or params
    let requestedPath = req.query?.path || req.params?.path || '';
    if (!requestedPath && req.url.startsWith('/api/content/')) {
      requestedPath = req.url.replace('/api/content/', '');
    }
    requestedPath = decodeURIComponent(requestedPath);

    // Normalize and secure the path
    let safePath = path.normalize(requestedPath)
      .replace(/^([\\/])+/, '')
      .replace(/\/\.\.\//g, '/')
      .replace(/[\\/]+/g, '/');
    const fullPath = path.join(CONTENT_DIR, safePath);
    if (!fullPath.startsWith(CONTENT_DIR)) {
      res.statusCode = 400;
      return res.json({ error: 'Invalid path' });
    }

    // Read the markdown file
    const fileContent = await fs.readFile(fullPath, 'utf8');
    const { html, metadata, headings } = MarkdownService.parseMarkdownFile(fileContent);
    const name = path.basename(safePath);
    return res.json({
      html,
      metadata,
      headings,
      path: safePath,
      name
    });
  } catch (error) {
    res.statusCode = 500;
    return res.json({ error: 'Failed to process markdown', details: error.message });
  }
}
