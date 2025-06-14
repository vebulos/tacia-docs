import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
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

interface CachedItem {
  data: Observable<MarkdownFile>;
  lastAccessed: number;
}

@Injectable({
  providedIn: 'root'
})
export class MarkdownService {
  private cache = new Map<string, CachedItem>();
  private apiUrl = '/api/content';
  private maxCacheSize = 50; // Nombre maximum d'éléments en cache
  private cacheHits = 0;
  private cacheMisses = 0;
  
  // Base path for content files
  private contentBasePath: string;

  constructor(private http: HttpClient) {
    // Configure the base content path
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
  
  /**
   * Loads a markdown file from the API
   * @param apiPath The path to the markdown file relative to the content directory
   */
  getMarkdownFile(apiPath: string): Observable<MarkdownFile> {
    // Normalize the path and add .md extension if not present
    const normalizedPath = apiPath.endsWith('.md') ? apiPath : `${apiPath}.md`;
    
    // Check cache first
    const cached = this.cache.get(normalizedPath);
    if (cached) {
      // Mettre à jour le dernier accès
      cached.lastAccessed = Date.now();
      this.cacheHits++;
      console.log(`[MarkdownService] Cache hit (${this.cacheHits} hits, ${this.cacheMisses} misses)`);
      return cached.data;
    }
    this.cacheMisses++;
    console.log(`[MarkdownService] Cache miss (${this.cacheHits} hits, ${this.cacheMisses} misses)`);

    console.log(`[MarkdownService] Loading markdown file: ${normalizedPath}`);
    
    // Create the API URL
    const url = `${this.apiUrl}/${normalizedPath}`.replace(/\/+/g, '/');
    
    // Make the HTTP request
    const request$ = this.http.get<{content: string, path: string}>(url).pipe(
      tap(() => console.log(`[MarkdownService] Successfully loaded markdown from: ${url}`)),
      map(response => {
        // Use the content and path from the response
        return this.parseMarkdown(response.content, response.path);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error(`[MarkdownService] Error loading markdown from ${url}:`, error);
        return throwError(() => new Error(`Failed to load markdown from ${apiPath}. Status: ${error.status} ${error.statusText}`));
      }),
      shareReplay(1) // Cache the result for subsequent subscribers
    );
    
    // Cache the request
    this.addToCache(apiPath, request$);
    
    return request$;
  }
  
  /**
   * Parses markdown content and extracts metadata and headings
   */
  private parseMarkdown(content: string, path: string): MarkdownFile {
    const result: MarkdownFile = {
      content,
      metadata: {},
      html: '',
      path,
      headings: []
    };
    
    try {
      // Parse front matter if present
      const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      
      if (frontMatterMatch) {
        const frontMatter = frontMatterMatch[1];
        const markdownContent = frontMatterMatch[2];
        
        // Simple YAML front matter parsing
        frontMatter.split('\n').forEach((line: string) => {
          if (line.includes(':')) {
            const [key, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();
            
            // Handle array values (simple case)
            if (value.startsWith('[') && value.endsWith(']')) {
              result.metadata[key.trim()] = value
                .slice(1, -1)
                .split(',')
                .map((item: string) => item.trim().replace(/^['"]|['"]$/g, ''));
            } else {
              result.metadata[key.trim()] = value.replace(/^['"]|['"]$/g, '');
            }
          }
        });
        
        result.content = markdownContent;
      }
      
      // Parse markdown to HTML
      result.html = marked.parse(result.content) as string;
      
      // Extract headings for TOC
      const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
      let match;
      
      while ((match = headingRegex.exec(result.html)) !== null) {
        const level = parseInt(match[1], 10);
        const text = match[2].replace(/<[^>]*>?/gm, ''); // Remove HTML tags
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with a single one
          .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
        
        result.headings.push({ text, level, id });
      }
      
      return result;
    } catch (error) {
      console.error('Error parsing markdown:', error);
      // Return a basic response with the raw content on error
      return {
        content,
        metadata: {},
        html: `<pre>${content}</pre>`,
        path,
        headings: []
      };
    }
  }
  
  /**
   * Clears the markdown cache
   * @param path Optional path to clear a specific entry
   */
  clearCache(path?: string): void {
    if (path) {
      this.cache.delete(path);
      console.log(`[MarkdownService] Cleared cache for path: ${path}`);
    } else {
      this.cache.clear();
      this.cacheHits = 0;
      this.cacheMisses = 0;
      console.log('[MarkdownService] Cache cleared');
    }
  }
  
  /**
   * Gets a cached markdown file or loads it if not in cache
   * @deprecated Use getMarkdownFile directly
   */
  getCachedOrLoad(path: string): Observable<MarkdownFile> {
    return this.getMarkdownFile(path);
  }
  
  /**
   * Preloads a markdown file into the cache
   * @param path Path to the markdown file to preload
   */
  preloadMarkdown(path: string): Observable<void> {
    return this.getMarkdownFile(path).pipe(
      map(() => undefined) // Convert to Observable<void>
    );
  }

  /**
   * Add an item to the cache, removing the least recently used items if needed
   */
  private addToCache(key: string, data: Observable<MarkdownFile>): void {
    // Clean up cache if it's too big
    if (this.cache.size >= this.maxCacheSize) {
      // Convert to array, sort by last accessed time, and remove the oldest 20%
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const itemsToRemove = Math.max(1, Math.floor(this.maxCacheSize * 0.2)); // Remove 20% or at least 1
      
      for (let i = 0; i < itemsToRemove; i++) {
        if (entries[i]) {
          this.cache.delete(entries[i][0]);
        }
      }
      
      console.log(`[MarkdownService] Cache cleaned, removed ${itemsToRemove} old items`);
    }
    
    this.cache.set(key, {
      data,
      lastAccessed: Date.now()
    });
  }



  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(2) : '0.00';
    
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`
    };
  }
}
