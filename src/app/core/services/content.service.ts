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
   */
  getContent(path: string = ''): Observable<ContentItem[]> {
    const cacheKey = this.cacheKey(path);
    
    // If we're already loading this path, return the existing observable
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
    
    // Create the request observable that will be used if cache is not available
    const request$ = cached$.pipe(
      switchMap(cachedData => {
        // Return cached data if available and not expired
        if (cachedData) {
          return of(cachedData);
        }
        
        // Otherwise fetch from source
        return this.fetchContent(path).pipe(
          // Cache the result
          tap(items => {
            const expires = Date.now() + (this.config.cacheTtl || 300000);
            this.storage.set(cacheKey, { data: items, expires }).subscribe();
          })
        );
      }),
      // Handle errors
      catchError(error => {
        console.error('Error loading content:', error);
        return throwError(() => error);
      }),
      // Clean up
      tap({
        finalize: () => this.loadingStates.delete(cacheKey)
      }),
      // Share the observable to avoid duplicate requests
      shareReplay(1)
    );

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
   */
  clearCache(path?: string): Observable<void> {
    if (path) {
      return this.storage.remove(this.cacheKey(path));
    }
    return this.storage.clear();
  }

  private fetchContent(path: string): Observable<ContentItem[]> {
    return this.http.get<ContentItem[]>('/api/content', { params: { path } }).pipe(
      map(items => this.transformStructure(items, path)),
      // Retry logic
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

  private transformStructure(items: any[], parentPath: string = ''): ContentItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map(item => {
      const isDirectory = item.isDirectory ?? false;
      let path = item.path || item.name;
      
      // For files, ensure the path includes the .md extension
      if (!isDirectory && !path.endsWith('.md')) {
        path = `${path}.md`;
      }
      
      // Build the full path
      const fullPath = parentPath && !path.startsWith(parentPath) 
        ? `${parentPath}/${path}`.replace(/\/+/g, '/')
        : path;

      return {
        name: item.name,
        path: fullPath, // Full path including parent and extension for files
        isDirectory: isDirectory,
        children: item.children ? this.transformStructure(item.children, fullPath) : undefined,
        metadata: item.metadata || {}
      };
    });
  }

  /**
   * Get the complete content structure
   */
  getContentStructure(): Observable<ContentItem[]> {
    return this.getContent('');
  }

  /**
   * Get content items with file paths
   */
  getContentWithFilePaths(): Observable<ContentItem[]> {
    return this.getContent('').pipe(
      map(items => {
        const itemsWithFilePaths: ContentItem[] = [];
        
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
        
        collectItemsWithFilePath(items);
        return itemsWithFilePaths;
      })
    );
  }
}
