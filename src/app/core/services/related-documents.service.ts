import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    // Encode the path but keep the forward slashes
    const encodedPath = documentPath.split('/').map(encodeURIComponent).join('/');
    return this.http.get<{ related: RelatedDocument[] }>(
      `${this.baseUrl}/related`,
      { 
        params: { 
          path: encodedPath, 
          limit: limit.toString() 
        } 
      }
    );
  }
}
