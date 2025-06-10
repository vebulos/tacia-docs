import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';
import { marked } from 'marked';

// Import highlight.js for syntax highlighting
import hljs from 'highlight.js';

// Import highlight.js styles
import 'highlight.js/styles/github.css';

export interface MarkdownFile {
  content: string;
  metadata: {
    title?: string;
    categories?: string[];
    tags?: string[];
    [key: string]: any;
  };
  html: string;
  path: string;
  headings: Array<{ text: string; level: number; id: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class MarkdownService {
  private cache = new Map<string, Observable<MarkdownFile>>();
  
  constructor(private http: HttpClient) {
    // Configure marked with highlight.js
    const markedOptions: any = {
      highlight: (code: string, lang: string) => {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        try {
          return hljs.highlight(code, { language }).value;
        } catch (err) {
          return code; // Return as-is if highlighting fails
        }
      },
      langPrefix: 'hljs language-',
      gfm: true,
      breaks: true,
      silent: true // Don't throw on errors
    };
    
    marked.setOptions(markedOptions);
  }
  
  private loadMarkdownFile(path: string): Observable<string> {
    // Log the original path for debugging
    console.log(`[MarkdownService] Original path: ${path}`);
    
    // Normalize the path - remove leading/trailing slashes and any 'assets/content' prefix
    let normalizedPath = path
      .replace(/^\/+|\/+$/g, '')  // Remove leading/trailing slashes
      .replace(/^assets\/content\//, '')  // Remove any assets/content/ prefix
      .replace(/\/+/g, '/');  // Replace multiple slashes with a single one
    
    console.log(`[MarkdownService] Normalized path: ${normalizedPath}`);
    
    // Don't add .md extension if it's already there
    const filePath = normalizedPath.endsWith('.md') 
      ? normalizedPath 
      : `${normalizedPath}.md`;
    
    // Ensure the path uses forward slashes and doesn't have duplicate segments
    const pathSegments = filePath.split('/').filter(Boolean);
    const uniqueSegments: string[] = [];
    
    // Remove duplicate consecutive segments
    for (const segment of pathSegments) {
      if (segment !== uniqueSegments[uniqueSegments.length - 1]) {
        uniqueSegments.push(segment);
      }
    }
    
    const cleanPath = uniqueSegments.join('/');
    const url = `/assets/content/${cleanPath}`;
    
    console.log(`Attempting to load markdown from URL: ${url}`);
    
    return this.http.get(url, { responseType: 'text' }).pipe(
      tap(() => console.log(`Successfully loaded markdown from: ${url}`)),
      catchError(error => {
        console.error(`Error loading markdown file: ${url}`, error);
        console.error('Error details:', {
          status: error.status,
          message: error.message,
          url: error.url
        });
        return throwError(() => new Error(`Failed to load markdown file: ${path}`));
      })
    );
  }

  getMarkdownFile(path: string): Observable<MarkdownFile> {
    if (!path) {
      const error = new Error('Path is required');
      console.error('[MarkdownService] Error in getMarkdownFile: Path is required');
      return of({
        content: '',
        metadata: {},
        html: '<p>Error: No path provided</p>',
        path: '',
        headings: []
      });
    }
    
    // Normalize the path
    const normalizedPath = path
      .replace(/^\/+|\/+$/g, '')  // Remove leading/trailing slashes
      .replace(/^assets\/content\//, '')  // Remove any assets/content/ prefix
      .replace(/\/+/g, '/');  // Replace multiple slashes with a single one
    
    console.log('[MarkdownService] Getting markdown file:', normalizedPath);
    
    // Check cache first
    if (this.cache.has(normalizedPath)) {
      console.log('Returning from cache:', normalizedPath);
      return this.cache.get(normalizedPath)!;
    }
    
    console.log('Loading markdown file for the first time:', normalizedPath);
    
    // Load and parse the markdown
    const markdown$ = this.loadMarkdownFile(normalizedPath).pipe(
      tap(content => console.log(`Successfully loaded markdown content for: ${normalizedPath} (${content.length} chars)`)),
      map(markdownContent => this.parseMarkdown(markdownContent, normalizedPath)),
      tap(parsed => console.log(`Successfully parsed markdown for: ${normalizedPath}`)),
      shareReplay(1),
      catchError(error => {
        console.error(`Error loading markdown file: ${normalizedPath}`, error);
        const errorMessage = error.message || 'Unknown error loading content';
        return of({
          content: '',
          metadata: { title: 'Error loading content' },
          html: `<p>Error loading content: ${this.escapeHtml(errorMessage)}</p>`,
          path: normalizedPath,
          headings: []
        });
      })
    );
    
    // Cache the result
    this.cache.set(normalizedPath, markdown$);
    
    return markdown$;
  }

  private parseMarkdown(markdown: string, path: string): MarkdownFile {
    // Parse frontmatter if present
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    let content = markdown;
    const metadata: Record<string, any> = {};
    let html = '';
    const headings: Array<{ text: string; level: number; id: string }> = [];

    // Extract frontmatter if it exists
    const frontMatterMatch = markdown.match(frontMatterRegex);
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];
      content = frontMatterMatch[2];
      
      // Parse YAML frontmatter (simplified example)
      frontMatter.split('\n').forEach(line => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value: any = match[2].trim();
          
          // Handle array values
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value
              .slice(1, -1)
              .split(',')
              .map((item: string) => item.trim())
              .filter(Boolean);
          }
          
          metadata[key] = value;
        }
      });
    }

    // Ensure required metadata fields have default values
    if (!metadata['title']) {
      // Try to extract title from the first heading if not in frontmatter
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        metadata['title'] = headingMatch[1].trim();
      } else {
        metadata['title'] = path.split('/').pop() || 'Untitled';
      }
    }

    // Extract headings from markdown content first
    const headingRegex = /^(#{1,6})\s+(.+?)(?:\s*\{#[^}]+\})?\s*$/gm;
    let match: RegExpExecArray | null;
    let headingText: string;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length; // Number of # characters
      headingText = match[2].trim();
      
      // Remove markdown formatting like **bold** from heading text
      headingText = headingText.replace(/\*\*([^*]+)\*\*/g, '$1');
      
      // Generate an ID from the heading text (matching the document component's logic)
      const umlautMap: {[key: string]: string} = {
        'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss',
        'Ä': 'A', 'Ö': 'O', 'Ü': 'U',
        'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
        'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
        'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
        'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
        'ù': 'u', 'ú': 'u', 'û': 'u',
        'ý': 'y', 'ÿ': 'y',
        'ñ': 'n', 'ç': 'c', 'æ': 'ae', 'œ': 'oe'
      };
      
      const id = headingText
        .toLowerCase()
        .replace(/[äöüßáàâãåéèêëíìîïóòôõøúùûýÿñçæœ]/g, match => umlautMap[match] || match)
        .replace(/[^\w\s-]/g, '')  // Remove any remaining special chars
        .replace(/\s+/g, '-')      // Replace spaces with -
        .replace(/-+/g, '-')       // Replace multiple - with single -
        .replace(/^-+|-+$/g, '');  // Remove leading/trailing -
      
      headings.push({
        level,
        id,
        text: headingText
      });
    }
    
    // Parse markdown to HTML
    try {
      // Configure marked options
      const markedOptions: any = {
        highlight: (code: string, lang: string) => {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          try {
            return hljs.highlight(code, { language }).value;
          } catch (err) {
            return code;
          }
        },
        gfm: true,
        breaks: true,
        smartypants: true,
      };

      // Set options and parse
      marked.setOptions(markedOptions);
      
      // Parse the markdown synchronously
      const parseResult = marked.parse(content);
      
      // Handle both string and Promise<string> return types
      if (typeof parseResult === 'string') {
        html = parseResult;
      } else {
        // If it's a Promise, we'll handle it asynchronously
        console.warn('Marked returned a Promise, but synchronous parsing was expected');
        html = 'Error: Asynchronous parsing not supported';
      }
    } catch (error) {
      console.error('Error parsing markdown:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      html = `<div class="markdown-error">Error parsing markdown: ${errorMessage}</div>`;
    }

    return {
      content,
      metadata,
      html,
      path,
      headings,
    };
  }
  
  /**
   * Escapes HTML special characters to prevent XSS
   * @param unsafe Unsafe HTML string
   * @returns Escaped HTML string
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
