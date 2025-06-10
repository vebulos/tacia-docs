import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError, tap } from 'rxjs/operators';

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

  constructor(private http: HttpClient) {}

  getContentStructure(): Observable<ContentItem[]> {
    if (this.contentCache) {
      console.log('[ContentService] Returning cached content structure');
      return this.contentCache;
    }

    const structurePath = '/assets/content/structure.json';
    console.log(`[ContentService] Loading content structure from: ${structurePath}`);
    
    this.contentCache = this.http.get<any[]>(structurePath).pipe(
      tap(structure => {
        console.log(`[ContentService] Successfully loaded structure.json (${structure?.length || 0} items)`);
        console.log('[ContentService] Raw structure.json content (first 2 items):', 
          JSON.stringify(structure?.slice(0, 2), null, 2));
        
        // Log all file paths for debugging
        if (Array.isArray(structure)) {
          const allPaths: string[] = [];
          const collectPaths = (items: any[], path = '') => {
            items.forEach(item => {
              const itemPath = path ? `${path}/${item.path || item.name}` : (item.path || item.name);
              if (!item.isDirectory) {
                allPaths.push(itemPath);
              }
              if (item.children) {
                collectPaths(item.children, itemPath);
              }
            });
          };
          
          collectPaths(structure);
          console.log('[ContentService] All file paths in structure:', allPaths);
        }
      }),
      map(items => {
        const transformed = this.transformStructure(items);
        console.log(`[ContentService] Transformed ${transformed.length} content items`);
        return transformed;
      }),
      tap(transformed => {
        // Log the first few items to verify structure
        const sample = transformed.slice(0, 3);
        console.log(`[ContentService] Sample content items (${sample.length} of ${transformed.length}):`, 
          sample.map(item => ({
            name: item.name,
            path: item.path,
            isDirectory: item.isDirectory,
            childrenCount: item.children?.length || 0
          }))
        );
      }),
      shareReplay(1),
      catchError(error => {
        console.error('[ContentService] Error loading content structure:', error);
        console.error('[ContentService] Error details:', {
          status: error.status,
          message: error.message,
          url: error.url || structurePath,
          error: error.error || 'No error details'
        });
        return of([]);
      })
    );
    
    return this.contentCache;
  }
  
  private transformStructure(items: any[], parentPath = ''): ContentItem[] {
    if (!Array.isArray(items)) {
      console.error('transformStructure: items is not an array', items);
      return [];
    }
    
    return items.map(item => {

      const itemPath = parentPath 
        ? `${parentPath}/${item.path || item.name}`
        : (item.path || item.name);
     
      console.log(`[ContentService] Transforming item: ${itemPath} (isDir: ${item.isDirectory ?? false})`);
      
      return {
        name: item.name,
        path: itemPath, // Use the full path
        isDirectory: item.isDirectory ?? false,
        children: item.children ? this.transformStructure(item.children, itemPath) : undefined,
        metadata: item.metadata || {}
      };
    });
  }
}
