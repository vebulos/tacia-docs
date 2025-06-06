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
    // Remove leading/trailing slashes
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');
    // Don't add .md extension if it's already there
    const filePath = normalizedPath.endsWith('.md') 
      ? normalizedPath 
      : `${normalizedPath}.md`;
    // Ensure the path uses forward slashes
    const url = `/assets/content/${filePath.replace(/\\/g, '/')}`;
    
    return this.http.get(url, { responseType: 'text' }).pipe(
      tap(() => console.log(`Loading markdown from: ${url}`)),
      catchError(error => {
        console.error(`Error loading markdown file: ${url}`, error);
        return throwError(() => new Error(`Failed to load markdown file: ${path}`));
      })
    );
  }

  getMarkdownFile(path: string): Observable<MarkdownFile> {
    // Normalize the path (remove leading/trailing slashes)
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');
    
    console.log('Getting markdown file:', normalizedPath);
    
    // Check cache first
    if (this.cache.has(normalizedPath)) {
      console.log('Returning from cache:', normalizedPath);
      return this.cache.get(normalizedPath)!;
    }
    
    // Load and parse the markdown
    const markdown$ = this.loadMarkdownFile(normalizedPath).pipe(
      map(markdownContent => this.parseMarkdown(markdownContent, normalizedPath)),
      shareReplay(1),
      catchError(error => {
        console.error(`Error loading markdown: ${normalizedPath}`, error);
        return of({
          content: '',
          metadata: {},
          html: `<p>Error loading content: ${error.message}</p>`,
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

      // Extract headings
      const headingRegex = /<h([1-6])[^>]*id="([^"]+)"[^>]*>(.*?)<\/h[1-6]>/g;
      let match: RegExpExecArray | null;
      while ((match = headingRegex.exec(html)) !== null) {
        headings.push({
          level: parseInt(match[1], 10),
          id: match[2],
          text: match[3].replace(/<[^>]*>/g, ''), // Remove HTML tags from heading text
        });
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
}
