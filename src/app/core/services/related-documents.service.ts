import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LOG } from './logging/bun-logger.service';

export interface RelatedDocument {
  path: string;
  title: string;
  commonTags: string[];
  commonTagsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class RelatedDocumentsService {
  private readonly baseUrl = 'http://localhost:4201/api';

  constructor(private http: HttpClient) {}

  getRelatedDocuments(documentPath: string, limit: number = 5): Observable<{ related: RelatedDocument[] }> {
    LOG.debug('Getting related documents', { 
      path: documentPath, 
      limit,
      hasPath: !!documentPath 
    });
    
    if (!documentPath) {
      LOG.error('No document path provided to getRelatedDocuments');
      return of({ related: [] });
    }
    
    // Remove leading slash if present and ensure .md extension
    let cleanPath = documentPath.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }
    if (!cleanPath.endsWith('.md')) {
      cleanPath += '.md';
    }
    
    const apiUrl = `${this.baseUrl}/related`;
    
    LOG.debug('Making API request for related documents', { 
      url: apiUrl,
      path: cleanPath,
      limit,
      fullUrl: `${apiUrl}?path=${encodeURIComponent(cleanPath)}&limit=${limit}`.replace(/\?.*$/, '') // Clean URL for logs
    });
    
    const headers = {
      'Accept': 'application/json'
      // Don't set Content-Type for GET requests
      // as it can trigger a CORS preflight (OPTIONS) request
    };

    return this.http.get<{ related: RelatedDocument[] }>(
      apiUrl,
      { 
        params: { 
          path: cleanPath, 
          limit: limit.toString() 
        },
        headers: headers,
        withCredentials: true // Important for authentication cookies if needed
      }
    ).pipe(
      tap(response => {
        LOG.debug('Received related documents', { 
          documentCount: response.related?.length || 0,
          sampleDocuments: response.related?.slice(0, 3).map(doc => ({
            path: doc.path,
            commonTagsCount: doc.commonTagsCount
          }))
        });
      }),
      catchError((error: any) => {
        LOG.error('Error fetching related documents', { 
          path: cleanPath,
          error: error.message || 'Unknown error',
          status: error.status
        });
        return of({ related: [] });
      })
    );
  }
}
