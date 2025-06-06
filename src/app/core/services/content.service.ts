import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';
import contentStructure from '../../../assets/content/structure.json';

export interface ContentItem {
  name: string;
  path: string;
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
export class ContentService {
  private contentCache: Observable<ContentItem[]> | null = null;

  constructor() {}

  getContentStructure(): Observable<ContentItem[]> {
    if (this.contentCache) {
      return this.contentCache;
    }

    this.contentCache = of(contentStructure).pipe(
      map(structure => this.transformStructure(structure)),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading content structure', error);
        return of([]);
      })
    );

    return this.contentCache;
  }

  private transformStructure(items: any[]): ContentItem[] {
    return items.map(item => ({
      name: item.name,
      path: item.path,
      isDirectory: item.type === 'directory',
      metadata: item.metadata || {},
      children: item.children ? this.transformStructure(item.children) : []
    }));
  }
}
