import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, retryWhen, shareReplay, switchMap, tap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { environment } from '../../../environments/environment';
import { ContentItem } from './content.interface';
import { PathUtils } from '../utils/path.utils';
import { getLogger } from './logging/logger';
const LOG = getLogger('ContentService');

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
  
  // BehaviorSubject to share current document tags
  private currentTagsSubject = new BehaviorSubject<string[]>([]);
  currentTags$ = this.currentTagsSubject.asObservable();
  
  // Method to update current tags
  updateCurrentTags(tags: string[]): void {
    this.currentTagsSubject.next(tags || []);
  }

  constructor(
    private http: HttpClient,
    private storage: StorageService
  ) {
    // Initialize with empty tags
    this.updateCurrentTags([]);
    this.config = environment?.content || {};
    LOG.info('ContentService initialized', { 
      config: {
        ...this.config,
        // Don't log sensitive info like API keys
        apiKey: this.config.apiKey ? '***' : undefined
      } 
    });
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
      LOG.debug('Returning existing loading state', { path });
      return this.loadingStates.get(cacheKey)!;
    }

    // If skipCache is true, skip cache check
    let cached$ = of<ContentItem[] | null>(null);
    
    // Check cache only if skipCache is false
    if (!skipCache) {
      LOG.debug('Checking cache', { path });
      cached$ = this.storage.get<CacheItem<ContentItem[]>>(cacheKey).pipe(
        map(cachedData => {
          if (cachedData) {
            const isExpired = Date.now() > cachedData.expires;
            LOG.debug('Cache status', {
              path,
              hasCache: true,
              isExpired,
              expiresIn: `${Math.max(0, Math.round((cachedData.expires - Date.now()) / 1000))}s`,
              cacheSize: JSON.stringify(cachedData.data).length
            });
            
            if (!isExpired) {
              return cachedData.data;
            }
          }
          return null;
        }),
        catchError(() => of<ContentItem[] | null>(null))
      );
    } else {
      LOG.debug('Skipping cache', { path });
    }
    
    // Create the request observable when cache is not available or skipped
    const request$ = cached$.pipe(
      switchMap(cachedData => {
        // Return cached data if available, not expired, and not skipping cache
        if (!skipCache && cachedData) {
          return of<ContentItem[]>(cachedData);
        }
        
        // Fetch from source when no valid cache exists
        LOG.debug('Fetching fresh content', { path });
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
        LOG.error('Error loading content', { error });
        return throwError(() => error);
      }),
      // Clean up loading state when complete or on error
      tap({
        finalize: () => this.loadingStates.delete(cacheKey)
      }),
      // Share the observable to prevent duplicate requests
      shareReplay(1)
    );

    LOG.debug('Loading state check', {
      path,
      hasLoadingState: this.loadingStates.has(cacheKey)
    });

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
    // Encode the path in pieces to handle spaces and special characters
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    
    LOG.debug('Fetching content structure', { path });
    
    // Use environment.apiUrl for the base URL with the new structure endpoint
    const url = `${environment.apiUrl}/structure/${path || ''}`;
    LOG.debug('Making API request', { 
      path,
      url: url.replace(/\?.*$/, '') // Remove query params from URL in logs
    });
    
    return this.http.get<{path: string, items: ContentItem[], count: number}>(url).pipe(
      tap(response => {
        LOG.debug('Received API response', { 
          path,
          itemCount: response?.items?.length || 0,
          hasItems: !!(response?.items?.length)
        });
      }),
      map(response => {
        const items = response?.items || [];
        if (items.length > 0) {
          const firstItem = items[0];
          LOG.debug('Successfully fetched items', { 
            path,
            itemCount: items.length,
            firstItem: {
              name: firstItem.name,
              path: firstItem.path,
              isDirectory: firstItem.isDirectory,
              hasMetadata: !!firstItem.metadata,
              hasTags: !!(firstItem.metadata?.tags && firstItem.metadata.tags.length > 0)
            }
          });
        } else {
          LOG.warn('No items returned from API', { path });
        }
        return this.transformStructure(items, path);
      }),
      catchError((error: HttpErrorResponse) => {
        // Log detailed error information
        LOG.error('Error fetching content', { 
          path, 
          status: error.status,
          statusText: error.statusText,
          message: error.message 
        });
        
        // Handle 404 specifically for non-existent paths
        if (error.status === 404) {
          LOG.warn('Content not found', { path });
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
          
          LOG.warn(`Retry attempt ${count + 1}/${retryAttempts}`, { 
            path,
            error: error.message || 'Unknown error' 
          });
          
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
  private transformStructure(items: any[], parentPath: string = '', depth: number = 0, callId: string = Math.random().toString(36).substring(2, 8)): ContentItem[] {
    LOG.info('[transformStructure] CALLED', { parentPath, itemCount: items?.length, depth, callId });
    const logPrefix = `[${callId}]`.padEnd(8);
    
    LOG.debug(`${logPrefix} [Depth:${depth}] Starting transformStructure`, { 
      itemCount: items?.length || 0,
      parentPath: parentPath || '(root)',
      callId,
      depth
    });
    
    if (!items) {
      LOG.error(`${logPrefix} transformStructure called with null/undefined items`);
      return [];
    }
    
    if (!Array.isArray(items)) {
      LOG.error(`${logPrefix} transformStructure called with non-array items:`, { 
        type: typeof items,
        value: items 
      });
      return [];
    }

    const transformedItems = items.map((item, index) => {
      const isDirectory = item.isDirectory ?? false;
      let path = item.path || item.name;
      const itemId = `${callId}-${index}`;
      
      LOG.debug(`${logPrefix} [${itemId}] Processing item`, {
        name: item.name,
        originalPath: item.path,
        itemType: isDirectory ? 'directory' : 'file',
        parentPath: parentPath || '(root)',
        itemId,
        hasChildren: !!item.children?.length
      });

      // Robust path prefix check (decode and compare by segments)
      const decode = (p: string) => decodeURIComponent(p || '');
      const parentPathDecoded = decode(parentPath);
      const pathDecoded = decode(path);
      const parentSegments = parentPathDecoded.split('/').filter(Boolean);
      const pathSegments = pathDecoded.split('/').filter(Boolean);
      const pathHasParentPrefix = parentSegments.length > 0 && parentSegments.every((seg, i) => seg === pathSegments[i]);
      const needsPathConcatenation = parentPath && !pathHasParentPrefix;
      
      LOG.debug(`${logPrefix} [${itemId}] Path analysis`, {
        path,
        parentPath: parentPath || '(none)',
        parentPathDecoded,
        pathDecoded,
        parentSegments,
        pathSegments,
        pathHasParentPrefix,
        needsPathConcatenation,
        pathLength: path.length,
        parentPathLength: parentPath.length
      });

      // Construct full path with proper formatting
      const fullPath = needsPathConcatenation 
        ? `${parentPath}/${path}`.replace(/\/+/g, '/') 
        : path;
      
      LOG.debug(`${logPrefix} [${itemId}] Path construction result`, {
        originalPath: path,
        fullPath,
        pathChanged: path !== fullPath,
        fullPathParts: fullPath.split('/'),
        parentPathParts: parentPath ? parentPath.split('/') : []
      });

      // Process children recursively if they exist
      let processedChildren: ContentItem[] | undefined;
      if (item.children) {
        LOG.debug(`${logPrefix} [${itemId}] Processing children`, {
          childCount: item.children.length,
          fullPath
        });
        
        processedChildren = this.transformStructure(
          item.children, 
          fullPath, 
          depth + 1, 
          `${callId}-${index}`
        );
        
        LOG.debug(`${logPrefix} [${itemId}] Processed children`, {
          childCount: processedChildren.length,
          fullPath
        });
      }

      // Create the item with all properties
      const transformedItem: ContentItem = {
        name: item.name,
        path: fullPath,
        isDirectory: isDirectory,
        children: processedChildren,
        metadata: item.metadata || {}
      };

      // If we have a title in metadata, use it as the display name
      if (item.metadata?.name) {
        const oldName = transformedItem.name;
        transformedItem.name = item.metadata.name;
        LOG.debug(`${logPrefix} [${itemId}] Using title from metadata`, {
          oldName,
          newName: transformedItem.name
        });
      } else if (!isDirectory) {
        // For files without a title, generate a nice display name from the filename
        const pathParts = fullPath.split(/[\\/]/);
        let baseName = pathParts[pathParts.length - 1];
        
        // Remove extension which is supposed to be available
        const oldBaseName = baseName;
        baseName = PathUtils.removeFileExtension(baseName);
      
        const formattedName = baseName
          .replace(/[-_]/g, ' ') // Replace underscores and hyphens with spaces
          .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Capitalize first letter of each word
        
        LOG.debug(`${logPrefix} [${itemId}] Generated display name`, {
          original: oldBaseName,
          withoutExtension: baseName,
          formatted: formattedName
        });
        
        transformedItem.name = formattedName;
      }
      
      return transformedItem;
    });

    // Log summary of processed items
    const summary = {
      path: parentPath || '/',
      itemCount: transformedItems.length,
      directoryCount: transformedItems.filter(item => item.isDirectory).length,
      fileCount: transformedItems.filter(item => !item.isDirectory).length,
      allPaths: transformedItems.map(item => item.path),
      callId,
      depth
    };
    
    // Only log full details for small sets or in development
    if (transformedItems.length <= 5 || !environment.production) {
      LOG.debug(`${logPrefix} [Depth:${depth}] Processed items (detailed)`, summary);
    } else {
      LOG.debug(`${logPrefix} [Depth:${depth}] Processed items`, {
        ...summary,
        allPaths: '[truncated]',
        _message: `Processed ${transformedItems.length} items (${summary.directoryCount} directories, ${summary.fileCount} files)`
      });
    }
    
    // Log potential path duplication issues
    const pathCounts = transformedItems.reduce((acc, item) => {
      acc[item.path] = (acc[item.path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const duplicatePaths = Object.entries(pathCounts)
      .filter(([_, count]) => count > 1)
      .map(([path]) => path);
      
    if (duplicatePaths.length > 0) {
      LOG.warn(`${logPrefix} [Depth:${depth}] Found duplicate paths in results`, {
        duplicatePaths,
        callId,
        depth,
        parentPath
      });
    }
    
    LOG.info('[transformStructure] RETURN', { parentPath, itemCount: transformedItems.length, depth, callId });
    return transformedItems;
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
