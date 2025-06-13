import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';
import { marked } from 'marked';

// Import highlight.js for syntax highlighting
import hljs from 'highlight.js';

// Import highlight.js styles
import 'highlight.js/styles/github.css';

// Import environment
import { environment } from '../../../environments/environment';

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
  
  // Chemin de base pour le contenu
  private contentBasePath: string;

  constructor(private http: HttpClient) {
    // Configuration du chemin de base
    const contentPath = environment.search?.contentBasePath || 'assets/content';
    this.contentBasePath = contentPath.replace(/^\/+|\/+$/g, '');
    console.log('[MarkdownService] Initialized with content path:', this.contentBasePath);
    
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
  
  private loadMarkdownFile(apiPath: string): Observable<string> {
    // Utiliser le chemin tel quel, sans nettoyage
    const url = `/api/content/${apiPath}`;
    console.log('[MarkdownService] Loading markdown from:', url);
    
    return this.http.get(url, { responseType: 'text' }).pipe(
      tap(() => console.log(`Successfully loaded markdown from API: ${url}`)),
      catchError(error => {
        console.error(`Error loading markdown from API: ${url}`, error);
        return throwError(() => new Error(`Failed to load markdown file from API: ${apiPath}`));
      })
    );
  }

  getMarkdownFile(path: string): Observable<MarkdownFile> {
    // Create a wrapper function to handle the async operation
    const loadMarkdown = async (): Promise<MarkdownFile> => {
      if (!path) {
        throw new Error('Path is required');
      }

      // Check cache first
      if (this.cache.has(path)) {
        return this.cache.get(path)!.toPromise() as Promise<MarkdownFile>;
      }

      console.log(`[MarkdownService] getMarkdownFile: ${path}`);
      
      try {
        const content = await this.loadMarkdownFile(path).toPromise();
        if (!content) {
          throw new Error('No content returned from loadMarkdownFile');
        }
        const result = await this.parseMarkdown(content, path);
        return result;
      } catch (error) {
        console.error(`Error loading markdown file: ${path}`, error);
        throw error;
      }
    };

    // Return an observable that will execute the async operation when subscribed to
    return new Observable<MarkdownFile>(subscriber => {
      loadMarkdown()
        .then(result => {
          subscriber.next(result);
          subscriber.complete();
        })
        .catch(error => {
          console.error('Error in markdown processing:', error);
          subscriber.error(error);
        });
    }).pipe(
      shareReplay(1) // Cache the result
    );
  }

  private async parseMarkdown(content: string, path: string): Promise<MarkdownFile> {
    try {
      let metadata = {};
      let markdownContent = content;
      
      // Check if content is a JSON string that needs to be parsed
      let parsedContent: any;
      try {
        parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
      } catch (e) {
        // Not a JSON string, treat as raw markdown
        parsedContent = content;
      }
      
      // Handle JSON response with content and metadata
      if (parsedContent && typeof parsedContent === 'object') {
        // Type guard to check if the object has a 'content' property
        if ('content' in parsedContent && typeof (parsedContent as any).content === 'string') {
          markdownContent = (parsedContent as any).content;
          // Create a copy of the parsed content without the content property
          const { content, ...rest } = parsedContent as any;
          // Merge any metadata from the response
          metadata = { ...metadata, ...rest };
        } else {
          // If it's an object but doesn't have a content property, stringify it
          markdownContent = JSON.stringify(parsedContent, null, 2);
        }
      }
      
      // Parse front matter if present in the markdown content
      const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
      const match = markdownContent.match(frontMatterRegex);
      
      if (match) {
        try {
          // Simple YAML front matter parsing (for basic key-value pairs)
          const frontMatter = match[1]
            .split('\n')
            .filter(line => line.trim() && line.includes(':'))
            .reduce((acc: Record<string, any>, line) => {
              const [key, ...valueParts] = line.split(':');
              const value = valueParts.join(':').trim();
              // Handle array values (simple case)
              if (value.startsWith('[') && value.endsWith(']')) {
                acc[key.trim()] = value
                  .slice(1, -1)
                  .split(',')
                  .map((item: string) => item.trim().replace(/^['"]|['"]$/g, ''));
              } else {
                acc[key.trim()] = value.replace(/^['"]|['"]$/g, '');
              }
              return acc;
            }, {});
          
          // Merge front matter with existing metadata
          metadata = { ...metadata, ...frontMatter };
          markdownContent = match[2];
        } catch (e) {
          console.warn('Failed to parse front matter', e);
        }
      }

      // Parse markdown to HTML (marked.parse returns a Promise)
      const html = await marked.parse(markdownContent);
      
      // Extract headings for TOC
      const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
      const headings: Array<{ text: string; level: number; id: string }> = [];
      let matchHeading;
      let htmlStr: string;
      
      // Convert html to string if it's a promise
      htmlStr = typeof html === 'string' ? html : await html;
      
      while ((matchHeading = headingRegex.exec(htmlStr)) !== null) {
        const level = parseInt(matchHeading[1], 10);
        const text = matchHeading[2].replace(/<[^>]*>?/gm, ''); // Remove HTML tags
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with a single one
          .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
        
        headings.push({ text, level, id });
      }

      return {
        content: markdownContent,
        metadata,
        html: await html, // Ensure html is resolved to a string
        path,
        headings
      };
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return {
        content: content,
        metadata: {},
        html: `<pre>${content}</pre>`,
        path,
        headings: []
      };
    }
  }
  
  /**
   * Clears the markdown cache
   */
  clearCache(path?: string): void {
    if (path) {
      this.cache.delete(path);
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Gets a cached markdown file or loads it if not in cache
   */
  getCachedOrLoad(path: string): Observable<MarkdownFile> {
    return this.getMarkdownFile(path);
  }
  
  /**
   * Preloads a markdown file into the cache
   */
  preloadMarkdown(path: string): Observable<void> {
    return this.getMarkdownFile(path).pipe(
      map(() => {}) // Convert to Observable<void>
    );
  }
}
