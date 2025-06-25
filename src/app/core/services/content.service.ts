import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, retryWhen, shareReplay, switchMap, tap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { environment } from '../../../environments/environment';
import { ContentItem } from './content.interface';
import { PathUtils } from '../utils/path.utils';

export interface CacheItem<T> {
  data: T;
  expires: number;
}

@Injectable({
  providedIn: 'root'
})
export class ContentService {
  private readonly cacheKey = (path: string) => `content_${path || 'root'}`;
  private loadingStates = new Map<string, Observable<ContentItem[]>>();
  private config: any;

  constructor(
    private http: HttpClient,
    private storage: StorageService
  ) {
    this.config = environment?.content || {};
    console.log('[ContentService] Initialized with config:', this.config);
  }

  /**
   * Get content for a specific path
   * @param path The content path to retrieve (defaults to root)
   * @param skipCache Whether to skip the cache and force a fresh request
   * @returns Observable of ContentItem array
   */
  getContent(path: string = '', skipCache: boolean = false): Observable<ContentItem[]> {
    const cacheKey = this.cacheKey(path);
    
    // If skipCache is true, we don't check loading states
    if (!skipCache && this.loadingStates.has(cacheKey)) {
      console.log(`[ContentService] Returning existing loading state for path: ${path}`);
      return this.loadingStates.get(cacheKey)!;
    }

    // If skipCache is true, skip cache check
    let cached$ = of<ContentItem[] | null>(null);
    
    // Check cache only if skipCache is false
    if (!skipCache) {
      console.log(`[ContentService] Checking cache for path: ${path}`);
      cached$ = this.storage.get<CacheItem<ContentItem[]>>(cacheKey).pipe(
        map(cachedData => {
          if (cachedData) {
            const now = Date.now();
            const isExpired = now > cachedData.expires;
            if (!isExpired) {
              console.log(`[ContentService] Using cached data for path: ${path}`);
              return cachedData.data;
            }
          }
          return null;
        }),
        catchError(() => of<ContentItem[] | null>(null))
      );
    } else {
      console.log(`[ContentService] Skipping cache for path: ${path}`);
    }
    
    // Create the request observable when cache is not available or skipped
    const request$ = cached$.pipe(
      switchMap(cachedData => {
        // Return cached data if available, not expired, and not skipping cache
        if (!skipCache && cachedData) {
          return of<ContentItem[]>(cachedData);
        }
        
        // Fetch from source when no valid cache exists
        console.log(`[ContentService] Fetching fresh content for path: ${path}`);
        return this.fetchContent(path).pipe(
          // Cache the result with expiration
          tap(items => {
            // Don't cache if skipCache is true
            if (!skipCache) {
              const expires = Date.now() + (this.config.cacheTtl || 300000);
              this.storage.set(cacheKey, { data: items, expires }).subscribe();
            }
          })
        );
      }),
      // Handle any errors during content loading
      catchError(error => {
        console.error('Error loading content:', error);
        return throwError(() => error);
      }),
      // Clean up loading state when complete or on error
      tap({
        finalize: () => this.loadingStates.delete(cacheKey)
      }),
      // Share the observable to prevent duplicate requests
      shareReplay(1)
    );

    // Store the observable to track loading state
    this.loadingStates.set(cacheKey, request$);
    return request$;
  }

  /**
   * Preload content for a path
   */
  preloadContent(path: string = ''): void {
    const cacheKey = this.cacheKey(path);
    if (!this.loadingStates.has(cacheKey)) {
      this.getContent(path).subscribe();
    }
  }

  /**
   * Clear cache for a specific path or all paths
   * @param path Optional path to clear (clears all paths if not provided)
   * @returns Observable that completes when cache is cleared
   */
  clearCache(path?: string): Observable<void> {
    if (path) {
      return this.storage.remove(this.cacheKey(path));
    }
    return this.storage.clear();
  }

  /**
   * Fetch content from the API for a given path
   * @param path The content path to fetch
   * @returns Observable of ContentItem array
   */
  private fetchContent(path: string): Observable<ContentItem[]> {
    // Encode the path to handle spaces and special characters
    const encodedPath = encodeURIComponent(path);
    
    console.log(`[ContentService] Fetching content structure for path: ${path}`);
    
    // Use the new URL format with path in the URL only
    const url = `http://localhost:4201/api/content/${path || ''}`;
    console.log(`[ContentService] Making request to URL: ${url}`);
    
    return this.http.get<{path: string, items: ContentItem[], count: number}>(url).pipe(
      tap(response => {
        console.log(`[ContentService] Raw API response for path ${path}:`, response);
      }),
      map(response => {
        const items = response?.items || [];
        console.log(`[ContentService] Successfully fetched ${items.length} items for path: ${path}`);
        if (items.length > 0) {
          console.log('[ContentService] First item structure:', JSON.stringify(items[0], null, 2));
        } else {
          console.warn('[ContentService] No items returned from API for path:', path);
        }
        return this.transformStructure(items, path);
      }),
      catchError((error: HttpErrorResponse) => {
        // Log detailed error information
        console.error(`[ContentService] Error fetching content for path: ${path}`, error);
        
        // Handle 404 specifically for non-existent paths
        if (error.status === 404) {
          console.warn(`[ContentService] Content not found for path: ${path}`);
          // Return empty array to prevent breaking the UI
          return of([]);
        }
        
        // Create user-friendly error message based on HTTP status
        let errorMessage = 'Failed to load content. Please try again later.';
        
        if (error.status === 403) {
          errorMessage = 'You do not have permission to access this content.';
        } else if (error.status === 0) {
          errorMessage = 'Unable to connect to the content server. Please check your network connection.';
        } else if (error.status >= 500) {
          errorMessage = 'The content server is currently unavailable. Please try again later.';
        }
        
        // For other errors, throw the error to be handled by retry logic
        return throwError(() => new Error(errorMessage));
      }),
      retryWhen(errors => errors.pipe(
        switchMap((error, count) => {
          const retryAttempts = this.config.maxRetries || 3;
          const retryDelay = this.config.retryDelay || 1000;
          
          console.log(`[ContentService] Retry attempt ${count + 1}/${retryAttempts} for path: ${path}`);
          
          if (count >= retryAttempts - 1) {
            return throwError(() => error);
          }
          return timer(retryDelay);
        })
      ))
    );
  }

  /**
   * Transform raw content items into the standardized ContentItem structure
   * @param items Raw content items to transform
   * @param parentPath Parent path for building full paths
   * @returns Array of transformed ContentItem objects
   */
  private transformStructure(items: any[], parentPath: string = ''): ContentItem[] {
    console.log('[ContentService] Transforming items:', { items, parentPath });
    if (!items) {
      console.error('[ContentService] transformStructure called with null/undefined items');
      return [];
    }
    if (!Array.isArray(items)) {
      console.error('[ContentService] transformStructure called with non-array items:', items);
      return [];
    }

    return items.map(item => {
      const isDirectory = item.isDirectory ?? false;
      let path = item.path || item.name;
      
      // Construct full path with proper formatting
      const fullPath = parentPath && !path.startsWith(parentPath) 
        ? `${parentPath}/${path}`.replace(/\/+/g, '/')
        : path;

      // Create the item with all properties
      const transformedItem: ContentItem = {
        name: item.name,
        path: fullPath, // Complete path including parent and file extension
        isDirectory: isDirectory,
        children: item.children ? this.transformStructure(item.children, fullPath) : undefined,
        metadata: item.metadata || {}
      };

      // If we have a title in metadata, use it as the display name
      if (item.metadata?.title) {
        transformedItem.name = item.metadata.title;
      } else if (!isDirectory) {
        // For files without a title, generate a nice display name from the filename
        // Extract the base name from the path (handles both / and \ separators)
        const pathParts = fullPath.split(/[\\/]/);
        let baseName = pathParts[pathParts.length - 1];
        
        // Remove extension which supposed to be available
        baseName = PathUtils.removeFileExtension(baseName);
      
        transformedItem.name = baseName
          .replace(/[-_]/g, ' ') // Replace underscores and hyphens with spaces
          .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Capitalize first letter of each word
      }
      
      return transformedItem;
    });
  }

  /**
   * Get the complete content structure starting from root
   * @returns Observable of the complete content structure
   */
  getContentStructure(): Observable<ContentItem[]> {
    return this.getContent('');
  }

  /**
   * Get a flat list of all content items that have file paths
   * @returns Observable of ContentItem array with file paths
   */
  getContentWithFilePaths(): Observable<ContentItem[]> {
    return this.getContent('').pipe(
      map(items => {
        const itemsWithFilePaths: ContentItem[] = [];
        
        // Recursively collect all items with file paths
        const collectItemsWithFilePath = (items: ContentItem[]) => {
          items.forEach(item => {
            if (item.path) {
              itemsWithFilePaths.push(item);
            }
            if (item.children) {
              collectItemsWithFilePath(item.children);
            }
          });
        };
        
        // Start collection from root items
        collectItemsWithFilePath(items);
        return itemsWithFilePaths;
      })
    );
  }
}
