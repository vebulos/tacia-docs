import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { IContentService, ContentItem } from './content.interface';

@Injectable({
  providedIn: 'root'
})
export class ApiContentService implements IContentService {
  private readonly API_BASE_URL = '/api';

  constructor(private http: HttpClient) {}

  getContent(path: string = ''): Observable<ContentItem[]> {
    return this.http.get<ContentItem[]>(`${this.API_BASE_URL}/content`, {
      params: { path }
    }).pipe(
      catchError(error => {
        console.error('API Error:', error);
        return of([]);
      })
    );
  }

  getContentStructure(): Observable<ContentItem[]> {
    return this.getContent('');
  }
}
