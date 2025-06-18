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
  private cachedPath$: Observable<string | null> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Gets the path of the first document from the API
   * Returns null if no document is found or if the API call fails
   */
  getFirstDocumentPath(): Observable<string | null> {
    // Return cached observable if available
    if (this.cachedPath$) {
      return this.cachedPath$;
    }

    // Create and cache the observable
    const apiUrl = `${PathUtils.API_BASE_PATH}/first-document`;
    
    this.cachedPath$ = this.http.get<FirstDocumentResponse>(apiUrl).pipe(
      map(response => {
        if (response.path) {
          // Remove .md extension if present
          return PathUtils.removeFileExtension(response.path);
        }
        // Return null if no path is found
        return null;
      }),
      catchError(error => {
        console.error('Error fetching first document path:', error);
        // Return null on error
        return of(null);
      }),
      shareReplay(1) // Cache the result
    );

    return this.cachedPath$;
  }

  /**
   * Clears the cached path
   */
  clearCache(): void {
    this.cachedPath$ = null;
  }
}
