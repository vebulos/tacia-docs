import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, Subject } from 'rxjs';
import { map, catchError, tap, shareReplay, takeUntil } from 'rxjs/operators';

// Import environment
import { environment } from '../../../environments/environment';
import { LruCache } from '../utils/lru-cache';

// Interface for the backend API response for markdown content
export interface MarkdownApiResponse {
  html: string;
  metadata: {
    title?: string;
    categories?: string[];
    tags?: string[];
    [key: string]: any;
  };
  headings: Array<{ text: string; level: number; id: string }>;
  path: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class MarkdownService implements OnDestroy {
  private readonly cache: LruCache<Observable<MarkdownApiResponse>>;
  private readonly apiUrl = 'http://localhost:4201/api/content';
  private readonly destroy$ = new Subject<void>();
  private readonly contentBasePath: string;

  // Track cache statistics and configuration
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly maxCacheSize = 50; // Maximum number of items in cache

  constructor(private http: HttpClient) {
    // Content is now fully managed by the backend API, no need for a content path
    this.contentBasePath = '';
    // Initialize LRU cache with max 50 items and 5 minutes TTL by default
    this.cache = new LruCache<Observable<MarkdownApiResponse>>(50, 5 * 60 * 1000);
    console.log('[MarkdownService] Initialized with backend-rendered markdown API');
  }
  
  /**
   * Loads a markdown file from the backend API (already parsed to HTML)
   * @param apiPath The path to the markdown file relative to the content directory
   */
  getMarkdownFile(apiPath: string, forceRefresh = false): Observable<MarkdownApiResponse> {
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

    // Fetch from backend API (returns { html, metadata, headings, path, name })
    const apiUrl = `${this.apiUrl}/${encodeURIComponent(normalizedPath)}`;
    console.log(`[MarkdownService] Fetching from backend API: ${apiUrl}`);
    
    const request$ = this.http.get<MarkdownApiResponse>(apiUrl, {
      headers: { 'Cache-Control': 'no-cache' }
    }).pipe(
      tap(() => {
        this.cacheMisses++;
        console.log(`[MarkdownService] Cache miss (${this.cacheHits} hits, ${this.cacheMisses} misses)`);
      }),
      tap(response => {
        console.log(`[MarkdownService] Successfully loaded markdown from backend: ${response.path}`);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error(`[MarkdownService] Error loading markdown from ${apiUrl}:`, error.status, error.statusText);
        return throwError(() => new Error(`Failed to load markdown: ${error.status} ${error.statusText}`));
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    
    // Cache the observable
    this.cache.set(normalizedPath, request$);
    
    return request$.pipe(takeUntil(this.destroy$));
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
  getCachedOrLoad(path: string): Observable<MarkdownApiResponse> {
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
   * Add an item to the cache
   */
  private addToCache(key: string, data: Observable<MarkdownApiResponse>): void {
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
