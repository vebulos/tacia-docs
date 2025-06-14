import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getRelatedDocuments(documentPath: string, limit: number = 5): Observable<{ related: RelatedDocument[] }> {
    console.log('getRelatedDocuments called with path:', documentPath, 'and limit:', limit);
    
    if (!documentPath) {
      console.error('No document path provided to getRelatedDocuments');
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
    console.log('Making API call to:', `${apiUrl}?path=${encodeURIComponent(cleanPath)}&limit=${limit}`);
    
    const headers = {
      'Accept': 'application/json'
      // Ne pas définir Content-Type pour les requêtes GET
      // car cela peut déclencher une pré-requête CORS (OPTIONS)
    };

    return this.http.get<{ related: RelatedDocument[] }>(
      apiUrl,
      { 
        params: { 
          path: cleanPath, 
          limit: limit.toString() 
        },
        headers: headers,
        withCredentials: true // Important pour les cookies d'authentification si nécessaire
      }
    ).pipe(
      tap(response => {
        console.log('Related documents API response:', response);
        console.log('Number of related documents:', response.related?.length || 0);
      }),
      catchError((error: any) => {
        console.error('API error:', error);
        return of({ related: [] });
      })
    );
  }
}
