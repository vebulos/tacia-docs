import { Observable } from 'rxjs';

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

export interface IContentService {
  getContent(path?: string): Observable<ContentItem[]>;
  getContentStructure(): Observable<ContentItem[]>;
}
