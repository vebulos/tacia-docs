import { Injectable, OnDestroy } from '@angular/core';
import { LOG } from './logging/bun-logger.service';

// Global configuration for supported markdown extensions (expand as needed)
const SUPPORTED_MARKDOWN_EXTENSIONS = ['.md'];

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, Subject } from 'rxjs';
import { map, catchError, tap, shareReplay, takeUntil } from 'rxjs/operators';

// Import environment
import { environment } from '../../../environments/environment';
import { LruCache } from '../utils/lru-cache';
import { PathUtils } from '../utils/path.utils';

// Interface for the backend API response for markdown content
export interface MarkdownApiResponse {
  markdown: string;
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
    LOG.info('MarkdownService initialized with backend-rendered markdown API');
  }
  
  /**
   * Loads a markdown file from the backend API (already parsed to HTML)
   * @param apiPath The path to the markdown file relative to the content directory
   */
  getMarkdownFile(apiPath: string, forceRefresh = false): Observable<MarkdownApiResponse> {
    // Normalize the path and ensure it has .md extension
    const pathWithExtension = apiPath.endsWith('.md') ? apiPath : `${apiPath}.md`;
    const normalizedPath = PathUtils.normalizePath(pathWithExtension);
    // Encode each segment to handle spaces and special characters
    const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
    const fullUrl = `${this.apiUrl}/${encodedPath}`;
    LOG.debug('Fetching markdown file', { url: fullUrl });

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = this.cache.get(normalizedPath);
      if (cached) {
        this.cacheHits++;
        LOG.debug('Cache hit', { 
          hits: this.cacheHits, 
          misses: this.cacheMisses,
          path: normalizedPath 
        });
        return cached;
      }
    }

    // Fetch from backend API (returns { html, metadata, headings, path, name })
    const apiUrl = `${this.apiUrl}/${encodeURIComponent(normalizedPath)}`;
    LOG.debug('Fetching from backend API', { apiUrl });
    
    const request$ = this.http.get<MarkdownApiResponse>(apiUrl, {
      headers: { 'Cache-Control': 'no-cache' }
    }).pipe(
      tap(() => {
        this.cacheMisses++;
        LOG.debug('Cache miss', { 
          hits: this.cacheHits, 
          misses: this.cacheMisses,
          path: normalizedPath 
        });
      }),
      tap(response => {
        LOG.debug('Successfully loaded markdown', {
          path: response.path,
          hasMetadata: !!response.metadata,
          metadataKeys: response.metadata ? Object.keys(response.metadata) : []
        });
      }),
      catchError((error: HttpErrorResponse) => {
        LOG.error('Error loading markdown', {
          url: apiUrl,
          status: error.status,
          statusText: error.statusText,
          error: error.message
        });
        
        // Create a more detailed error object that includes the status code
        const enhancedError = new Error(`Failed to load markdown: ${error.status} ${error.statusText}`);
        (enhancedError as any).status = error.status;
        (enhancedError as any).originalError = error;
        
        return throwError(() => enhancedError);
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
   * @returns Observable that completes when the cache is cleared
   */
  clearCache(path?: string): Observable<void> {
    return new Observable(subscriber => {
      try {
        if (path) {
          // Remove cache for the bare path (without extension)
          this.cache.delete(path);
          // Remove cache for all path+extension variants
          for (const ext of SUPPORTED_MARKDOWN_EXTENSIONS) {
            this.cache.delete(`${path}${ext}`);
          }
          LOG.debug('Cleared cache for path', { path, extensions: SUPPORTED_MARKDOWN_EXTENSIONS });
        } else {
          // Clear the entire cache
          this.cache.clear();
          this.cacheHits = 0;
          this.cacheMisses = 0;
          LOG.info('Cleared entire markdown cache');
        }
        subscriber.next();
        subscriber.complete();
      } catch (error) {
        LOG.error('Error clearing cache', { error });
        subscriber.error(error);
      }
    });
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
    LOG.debug('Current cache size', { size: this.cache.size });
    
    // If we're still over the limit, clear the entire cache
    if (this.cache.size >= this.maxCacheSize) {
      LOG.warn('Cache size exceeds maximum limit', { 
        currentSize: this.cache.size, 
        maxSize: this.maxCacheSize 
      });
      this.clearCache().subscribe({
        next: () => LOG.info('Cache cleared due to size limit'),
        error: (err) => LOG.error('Error clearing cache during cleanup', { error: err })
      });
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
    this.cache.clear();
    LOG.info('MarkdownService destroyed and cache cleared', {
      finalCacheSize: this.cache.size,
      totalHits: this.cacheHits,
      totalMisses: this.cacheMisses
    });
  }
}
