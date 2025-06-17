import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, retryWhen, shareReplay, switchMap, tap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { environment } from '../../../environments/environment';
import { ContentItem } from './content.interface';

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
   * @returns Observable of ContentItem array
   */
  getContent(path: string = ''): Observable<ContentItem[]> {
    const cacheKey = this.cacheKey(path);
    
    // Return existing observable if this path is already being loaded
    if (this.loadingStates.has(cacheKey)) {
      return this.loadingStates.get(cacheKey)!;
    }

    // Check if we have a cached version
    const cached$ = this.storage.get<CacheItem<ContentItem[]>>(cacheKey).pipe(
      map(cachedData => {
        if (cachedData) {
          const now = Date.now();
          const isExpired = now > cachedData.expires;
          if (!isExpired) {
            return cachedData.data;
          }
        }
        return null;
      }),
      catchError(() => of(null))
    );
    
    // Create the request observable when cache is not available
    const request$ = cached$.pipe(
      switchMap(cachedData => {
        // Return cached data if available and not expired
        if (cachedData) {
          return of(cachedData);
        }
        
        // Fetch from source when no valid cache exists
        return this.fetchContent(path).pipe(
          // Cache the result with expiration
          tap(items => {
            const expires = Date.now() + (this.config.cacheTtl || 300000);
            this.storage.set(cacheKey, { data: items, expires }).subscribe();
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
    
    // Use the encoded path in the request with full backend URL
    return this.http.get<ContentItem[]>(`http://localhost:4201/api/content?path=${encodedPath}`).pipe(
      map(items => this.transformStructure(items, path)),
      // Retry logic for failed requests
      retryWhen(errors => errors.pipe(
        switchMap((error, count) => {
          const retryAttempts = this.config.maxRetries || 3;
          const retryDelay = this.config.retryDelay || 1000;
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
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map(item => {
      const isDirectory = item.isDirectory ?? false;
      let path = item.path || item.name;
      
      // Ensure files have .md extension
      if (!isDirectory && !path.endsWith('.md')) {
        path = `${path}.md`;
      }
      
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
        
        // Remove .md extension if present
        if (baseName.endsWith('.md')) {
          baseName = baseName.slice(0, -3);
        }
        
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
