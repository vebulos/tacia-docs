import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, retryWhen, shareReplay, switchMap, tap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { environment } from '../../../environments/environment';
import { ContentItem } from './content.interface';
import { LOG } from './logging/bun-logger.service';

export interface CacheItem<T> {
  data: T;
  expires: number;
}

@Injectable({
  providedIn: 'root'
})
export class StructureService {
  private readonly cacheKey = (path: string) => `structure_${path || 'root'}`;
  private loadingStates = new Map<string, Observable<ContentItem[]>>();
  private config: any;
  
  constructor(
    private http: HttpClient,
    private storage: StorageService
  ) {
    this.config = environment?.content || {};
    LOG.info('StructureService initialized');
  }

  /**
   * Get directory structure for a specific path
   * @param path The directory path to retrieve (defaults to root)
   * @param skipCache Whether to skip the cache and force a fresh request
   * @returns Observable of ContentItem array
   */
  getDirectory(path: string = '', skipCache: boolean = false): Observable<ContentItem[]> {
    const cacheKey = this.cacheKey(path);
    
    if (!skipCache && this.loadingStates.has(cacheKey)) {
      LOG.debug('Returning existing loading state for directory', { path });
      return this.loadingStates.get(cacheKey)!;
    }

    // Check cache only if skipCache is false
    const cached$ = skipCache 
      ? of<ContentItem[] | null>(null)
      : this.storage.get<CacheItem<ContentItem[]>>(cacheKey).pipe(
          map(cachedData => {
            if (cachedData) {
              const isExpired = Date.now() > cachedData.expires;
              LOG.debug('Directory cache status', {
                path,
                hasCache: true,
                isExpired,
                expiresIn: `${Math.max(0, Math.round((cachedData.expires - Date.now()) / 1000))}s`
              });
              
              if (!isExpired) {
                return cachedData.data;
              }
            }
            return null;
          }),
          catchError(() => of<ContentItem[] | null>(null))
        );

    const request$ = cached$.pipe(
      switchMap(cachedData => {
        if (!skipCache && cachedData) {
          return of<ContentItem[]>(cachedData);
        }
        
        LOG.debug('Fetching directory structure', { path });
        return this.fetchDirectory(path).pipe(
          tap(items => {
            if (!skipCache) {
              const expires = Date.now() + (this.config.cacheTtl || 300000);
              this.storage.set(cacheKey, { data: items, expires }).subscribe();
            }
          })
        );
      }),
      catchError((error: HttpErrorResponse) => {
        LOG.error('Error loading directory structure', { error });
        return throwError(() => error);
      }),
      tap({
        finalize: () => this.loadingStates.delete(cacheKey)
      }),
      shareReplay(1)
    );

    this.loadingStates.set(cacheKey, request$);
    return request$;
  }

  /**
   * Preload directory structure for a path
   */
  preloadDirectory(path: string = ''): void {
    const cacheKey = this.cacheKey(path);
    if (!this.loadingStates.has(cacheKey)) {
      this.getDirectory(path).subscribe();
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
    
    // Clear all structure-related cache by getting all keys and removing matching ones
    return new Observable<void>(subscriber => {
      // First, clear any in-memory loading states
      this.loadingStates.clear();
      
      // Then clear storage keys with the structure_ prefix
      if ('keys' in this.storage && typeof this.storage['keys'] === 'function') {
        const storageWithKeys = this.storage as unknown as { keys: () => Promise<string[]> };
        storageWithKeys.keys().then((keys: string[]) => {
          const structureKeys = keys.filter((key: string) => key.startsWith('structure_'));
          const removePromises = structureKeys.map((key: string) => this.storage.remove(key));
          Promise.all(removePromises)
            .then(() => {
              subscriber.next(undefined);
              subscriber.complete();
            })
            .catch((error: unknown) => subscriber.error(error));
        }).catch((error: unknown) => subscriber.error(error));
      } else {
        // Fallback to just clearing everything if we can't filter keys
        this.storage.clear().subscribe({
          next: () => {
            subscriber.next(undefined);
            subscriber.complete();
          },
          error: (err: unknown) => subscriber.error(err)
        });
      }
      
      return () => {
        // Cleanup function if the observable is unsubscribed
        subscriber.complete();
      };
    });
  }

  /**
   * Fetch directory structure from the API
   * @param path The directory path to fetch
   * @returns Observable of ContentItem array
   */
  private fetchDirectory(path: string): Observable<ContentItem[]> {
    const url = `${environment.apiUrl}/structure/${path || ''}`.replace(/\/+$/, '');
    
    LOG.debug('Making structure API request', { 
      path,
      url
    });
    
    return this.http.get<{path: string, items: ContentItem[], count: number}>(url).pipe(
      tap(response => {
        LOG.debug('Received structure API response', { 
          path,
          itemCount: response?.items?.length || 0
        });
      }),
      map(response => response?.items || []),
      catchError((error: HttpErrorResponse) => {
        LOG.error('Error fetching directory structure', { 
          error: error.message,
          status: error.status,
          path
        });
        return throwError(() => new Error(`Failed to load directory: ${error.message}`));
      })
    );
  }
}
