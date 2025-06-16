import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, Subject } from 'rxjs';
import { map, catchError, tap, shareReplay, takeUntil } from 'rxjs/operators';
import { marked } from 'marked';

// Import highlight.js for syntax highlighting
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';

// Import environment
import { environment } from '../../../environments/environment';
import { LruCache } from '../utils/lru-cache';

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
export class MarkdownService implements OnDestroy {
  private readonly cache: LruCache<Observable<MarkdownFile>>;
  private readonly apiUrl = '/api/content';
  private readonly destroy$ = new Subject<void>();
  private readonly contentBasePath: string;
  private readonly markedOptions: any;

  // Track cache statistics and configuration
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly maxCacheSize = 50; // Maximum number of items in cache

  constructor(private http: HttpClient) {
    // Configure the base content path
    const contentPath = environment.search?.contentBasePath || 'assets/content';
    this.contentBasePath = contentPath.replace(/^\/+|\/+$/g, '');
    
    // Initialize LRU cache with max 50 items and 5 minutes TTL by default
    this.cache = new LruCache<Observable<MarkdownFile>>(50, 5 * 60 * 1000);
    
    // Register languages for syntax highlighting
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('json', json);
    hljs.registerLanguage('xml', xml);
    hljs.registerLanguage('bash', bash);
    
    // Configure marked with highlight.js
    this.markedOptions = {
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
    
    marked.setOptions(this.markedOptions);
    
    console.log('[MarkdownService] Initialized with LRU cache and optimized syntax highlighting');
  }
  
  /**
   * Loads a markdown file from the API
   * @param apiPath The path to the markdown file relative to the content directory
   */
  getMarkdownFile(apiPath: string, forceRefresh = false): Observable<MarkdownFile> {
    // Normalize the path and add .md extension if not present
    const normalizedPath = apiPath.endsWith('.md') ? apiPath : `${apiPath}.md`;
    
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = this.cache.get(normalizedPath);
      if (cached) {
        this.cacheHits++;
        console.log(`[MarkdownService] Cache hit (${this.cacheHits} hits, ${this.cacheMisses} misses)`);
        return cached;
      }
    }
    
    this.cacheMisses++;
    console.log(`[MarkdownService] Cache miss (${this.cacheHits} hits, ${this.cacheMisses} misses)`);

    console.log(`[MarkdownService] Loading markdown file: ${normalizedPath}`);
    
    // Create the API URL by encoding each path segment
    const pathSegments = normalizedPath.split('/').map(segment => encodeURIComponent(segment));
    const encodedPath = pathSegments.join('/');
    const url = `${this.apiUrl}/${encodedPath}`.replace(/\/+/g, '/');
    
    console.log(`[MarkdownService] Requesting markdown from: ${url}`);
    
    // Make the HTTP request
    const request$ = this.http.get<{content: string, path: string}>(url, { 
      headers: { 'Cache-Control': 'no-cache' } 
    }).pipe(
      tap(() => console.log(`[MarkdownService] Successfully loaded markdown from: ${url}`)),
      map(response => {
        // Use the content and path from the response
        return this.parseMarkdown(response.content, response.path);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error(`[MarkdownService] Error loading markdown from ${url}:`, error.status, error.statusText);
        return throwError(() => new Error(`Failed to load markdown: ${error.status} ${error.statusText}`));
      }),
      tap({
        next: (result) => {
          // Cache the successful response
          this.cache.set(normalizedPath, of(result));
        },
        error: (error) => {
          console.error('[MarkdownService] Error processing markdown:', error);
          // Optionally cache error responses for a short time
          this.cache.set(normalizedPath, throwError(() => error), 30 * 1000); // Cache errors for 30s
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    
    // Cache the observable
    this.cache.set(normalizedPath, request$);
    
    return request$.pipe(takeUntil(this.destroy$));
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
   * Clean up old cache entries when cache size exceeds the limit
   */
  private cleanupOldCacheEntries(): void {
    // The LRU cache handles its own cleanup, but we can add additional logic here if needed
    console.log(`[MarkdownService] Current cache size: ${this.cache.size}`);
    
    // If we're still over the limit, clear the entire cache
    if (this.cache.size >= this.maxCacheSize) {
      console.log(`[MarkdownService] Cache size (${this.cache.size}) exceeds max (${this.maxCacheSize}), clearing cache`);
      this.clearCache();
    }
  }

  /**
   * Add an item to the cache, removing the least recently used items if needed
   */
  /**
   * Add an item to the cache
   */
  private addToCache(key: string, data: Observable<MarkdownFile>): void {
    // Clean up cache if it's too big
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanupOldCacheEntries();
    }
    
    // Add to cache
    this.cache.set(key, data);
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

  /**
   * Clean up resources when the service is destroyed
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearCache();
    console.log('[MarkdownService] Destroyed and cache cleared');
  }
}
