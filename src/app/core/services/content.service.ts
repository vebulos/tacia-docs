import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';

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
  private contentPath = '/assets/content';
  private contentCache: Observable<ContentItem[]> | null = null;

  constructor(private http: HttpClient) {}

  getContentStructure(): Observable<ContentItem[]> {
    if (this.contentCache) {
      return this.contentCache;
    }

    this.contentCache = this.http.get<ContentItem[]>(`${this.contentPath}/structure.json`).pipe(
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
    const result: ContentItem[] = [];
    const itemMap = new Map<string, ContentItem>();
    
    // First pass: create all items
    items.forEach(item => {
      const path = item.path;
      const name = path.split('/').pop() || '';
      const isDirectory = item.type === 'directory';
      
      const contentItem: ContentItem = {
        name,
        path,
        isDirectory,
        metadata: item.metadata || {}
      };
      
      if (isDirectory) {
        contentItem.children = [];
      }
      
      itemMap.set(path, contentItem);
    });
    
    // Second pass: build the tree
    itemMap.forEach(item => {
      const pathParts = item.path.split('/').filter(Boolean);
      
      if (pathParts.length === 1) {
        // Root level item
        result.push(item);
      } else {
        // Child item, find its parent
        const parentPath = pathParts.slice(0, -1).join('/');
        const parent = itemMap.get(parentPath);
        
        if (parent && parent.isDirectory && parent.children) {
          parent.children.push(item);
        }
      }
    });
    
    // Sort directories first, then by name
    const sortItems = (items: ContentItem[]): ContentItem[] => {
      return [...items]
        .sort((a, b) => {
          // Directories first
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          
          // Then sort by name
          return a.name.localeCompare(b.name);
        })
        .map(item => {
          // Sort children recursively
          if (item.children) {
            item.children = sortItems(item.children);
          }
          return item;
        });
    };
    
    return sortItems(result);
  }
}
