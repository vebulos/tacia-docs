import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, retryWhen, switchMap, tap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { contentConfig } from '../config/content.config';

export interface ContentItem {
  name: string;
  path: string;
  fullPath?: string;
  isDirectory: boolean;
  children?: ContentItem[];
  metadata?: {
    title?: string;
    categories?: string[];
    tags?: string[];
    [key: string]: any;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LazyContentService {
  private readonly cacheKey = (path: string) => `content_${path || 'root'}`;
  private loadingStates = new Map<string, Observable<ContentItem[]>>();

  constructor(
    private http: HttpClient,
    private storage: StorageService
  ) {}

  /**
   * Get content for a specific path
   */
  getContent(path: string = ''): Observable<ContentItem[]> {
    const cacheKey = this.cacheKey(path);
    
    // Return in-progress request if exists
    if (this.loadingStates.has(cacheKey)) {
      return this.loadingStates.get(cacheKey)!;
    }

    // Try to get from cache first
    const request$ = this.storage.get<ContentItem[]>(cacheKey).pipe(
      switchMap(cached => {
        if (cached) {
          return of(cached);
        }
        return this.fetchContent(path);
      }),
      // Cache the result
      tap(items => {
        this.storage.set(cacheKey, items, contentConfig.cacheTtl).subscribe();
      }),
      // Handle errors
      catchError(error => {
        console.error('Failed to load content:', error);
        return throwError(() => new Error('Failed to load content'));
      }),
      // Clean up
      tap({
        finalize: () => this.loadingStates.delete(cacheKey)
      }),
      // Make it hot
      shareReplay(1)
    );

    this.loadingStates.set(cacheKey, request$);
    return request$;
  }

  /**
   * Preload content for a path
   */
  preloadContent(path: string = ''): void {
    if (!this.loadingStates.has(this.cacheKey(path))) {
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
          if (count >= contentConfig.maxRetries - 1) {
            return throwError(() => error);
          }
          return timer(contentConfig.retryDelay);
        })
      ))
    );
  }

  private transformStructure(items: any[], parentPath: string = ''): ContentItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map(item => {
      const path = item.path || item.name;
      const fullPath = parentPath ? `${parentPath}/${path}`.replace(/\/+/g, '/') : path;
      
      return {
        name: item.name,
        path,
        fullPath,
        isDirectory: item.isDirectory ?? false,
        children: item.children ? this.transformStructure(item.children, fullPath) : undefined,
        metadata: item.metadata || {}
      };
    });
  }
}
