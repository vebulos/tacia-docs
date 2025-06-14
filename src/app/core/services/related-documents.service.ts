import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private readonly baseUrl = '/api';

  constructor(private http: HttpClient) {}

  getRelatedDocuments(documentPath: string, limit: number = 5): Observable<{ related: RelatedDocument[] }> {
    // Encode the path to handle special characters and spaces
    const encodedPath = encodeURIComponent(documentPath);
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
