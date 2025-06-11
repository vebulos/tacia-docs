import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError, tap } from 'rxjs/operators';

export interface ContentItem {
  name: string;
  path: string;
  fullPath?: string;
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

  constructor(private http: HttpClient) {}

  getContentStructure(): Observable<ContentItem[]> {
    if (this.contentCache) {
      return this.contentCache;
    }

    const structurePath = '/assets/content/structure.json';
    
    this.contentCache = this.http.get<any[]>(structurePath).pipe(
      map(items => this.transformStructure(items)),
      shareReplay(1),
      catchError(() => of([]))
    );
    
    return this.contentCache;
  }
  
  getContent(path: string): Observable<ContentItem[]> {
    // For now, we'll use the full structure and filter by path
    // In a real implementation, this would be an API call to get children of a specific path
    return this.getContentStructure().pipe(
      map(items => this.findItemsByPath(items, path))
    );
  }
  
  private findItemsByPath(items: ContentItem[], targetPath: string): ContentItem[] {
    if (!targetPath) {
      return items;
    }
    
    const pathSegments = targetPath.split('/').filter(segment => segment);
    let currentItems = items;
    
    for (const segment of pathSegments) {
      const found = currentItems.find(item => item.name === segment);
      if (!found || !found.children) {
        return [];
      }
      currentItems = found.children;
    }
    
    return currentItems;
  }
  
  private transformStructure(items: any[], parentPath = ''): ContentItem[] {
    if (!Array.isArray(items)) {
      return [];
    }
    
    return items.map(item => {
      // Use the item's path if it exists, otherwise use the item name
      let itemPath = item.path || item.name;
      
      // Remove any segments from itemPath that are already in parentPath to avoid duplication
      if (parentPath && itemPath.startsWith(parentPath)) {
        itemPath = itemPath.substring(parentPath.length).replace(/^\//, '');
      }
      
      // Build the full path by combining parentPath and itemPath
      const fullPath = parentPath 
        ? (itemPath ? `${parentPath}/${itemPath}` : parentPath)
        : itemPath;
     
      // Create the transformed item
      const transformedItem: any = {
        name: item.name,
        path: itemPath, // Store relative path
        fullPath: fullPath, // Store full path
        isDirectory: item.isDirectory ?? false,
        children: item.children ? this.transformStructure(item.children, fullPath) : undefined,
        metadata: item.metadata || {}
      };

      // Preserve filePath if it exists
      if (item.filePath) {
        transformedItem.filePath = item.filePath;
      }
      
      return transformedItem;
    });
  }

  /**
   * Get all content items that have a filePath property
   * @returns Observable of ContentItem[] containing only items with filePath
   */
  getContentWithFilePaths(): Observable<ContentItem[]> {
    return this.getContentStructure().pipe(
      map(items => {
        const itemsWithFilePaths: ContentItem[] = [];
        
        const collectItemsWithFilePath = (items: ContentItem[]) => {
          items.forEach(item => {
            if ('filePath' in item) {
              itemsWithFilePaths.push(item);
            }
            if (item.children) {
              collectItemsWithFilePath(item.children);
            }
          });
        };
        
        collectItemsWithFilePath(items);
        return itemsWithFilePaths;
      })
    );
  }
}
