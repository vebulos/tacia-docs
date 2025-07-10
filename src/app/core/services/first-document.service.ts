import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { PathUtils } from '../utils/path.utils';

interface FirstDocumentResponse {
  path: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class FirstDocumentService {
  private cachedPaths: { [directory: string]: Observable<string | null> } = {};

  constructor(private http: HttpClient) {}

  /**
   * Gets the path of the first document in the specified directory
   * @param directory The directory to search in (default: '' for root)
   * @returns Observable with the path of the first document or null if none found
   */
  getFirstDocumentPath(directory: string = ''): Observable<string | null> {
    // Normalize directory path (remove leading/trailing slashes)
    const normalizedDir = directory.replace(/^\/+|\/+$/g, '');
    const cacheKey = normalizedDir || 'root';

    // Return cached observable if available
    if (this.cachedPaths[cacheKey]) {
      return this.cachedPaths[cacheKey];
    }

    // Create and cache the observable
    const apiUrl = `${PathUtils.API_BASE_PATH}/first-document/${normalizedDir}`;
    
    this.cachedPaths[cacheKey] = this.http.get<FirstDocumentResponse>(apiUrl).pipe(
      map(response => {
        if (response.path) {
          return PathUtils.removeFileExtension(response.path);
        }
        return null;
      }),
      catchError(error => {
        console.error(`Error fetching first document path for directory '${directory}':`, error);
        return of(null);
      }),
      shareReplay(1) // Cache the result
    );

    return this.cachedPaths[cacheKey];
  }

  /**
   * Clears the cached first document path for a specific directory or all directories
   * @param directory Optional directory to clear cache for. If not provided, clears all caches.
   */
  clearCache(directory?: string): void {
    if (directory) {
      const normalizedDir = directory.replace(/^\/+|\/+$/g, '');
      const cacheKey = normalizedDir || 'root';
      delete this.cachedPaths[cacheKey];
    } else {
      this.cachedPaths = {};
    }
  }
}
