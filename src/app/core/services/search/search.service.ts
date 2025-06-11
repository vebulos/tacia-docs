import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { SEARCH_CONFIG } from './search.config';
import { MarkdownService } from '../markdown.service';
import { IContentService, ContentItem } from '../content.interface';

export interface SearchResult {
  path: string;
  title: string;
  preview: string;
  score: number;
  matches: Array<{
    line: number;
    content: string;
    highlighted: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private readonly recentSearchesKey = 'recentSearches';
  private recentSearches: string[] = [];
  private searchResults = new BehaviorSubject<SearchResult[]>([]);
  private isLoading = new BehaviorSubject<boolean>(false);
  private error = new BehaviorSubject<string | null>(null);
  
  private contentCache: ContentItem[] = [];
  private searchIndex: SearchResult[] = [];
  private indexReady = false;
  
  constructor(
    private http: HttpClient,
    private markdownService: MarkdownService,
    @Inject('IContentService') private contentService: IContentService
  ) {
    console.log('[SearchService] Constructor called');
    this.loadRecentSearches();
    this.initializeSearchIndex();
  }
  
  searchResults$ = this.searchResults.asObservable();
  isLoading$ = this.isLoading.asObservable();
  error$ = this.error.asObservable();
  
  private initializeSearchIndex(): void {
    console.log('[SearchService] Initializing search index...');
    this.contentService.getContentStructure().pipe(
      tap(contentItems => {
        console.log('[SearchService] Got content items:', contentItems);
        this.contentCache = contentItems;
      }),
      switchMap(() => this.indexAllContent()),
      catchError(err => {
        console.error('[SearchService] Error initializing search index:', err);
        this.error.next('Failed to initialize search index: ' + (err?.message || err));
        return of(undefined);
      })
    ).subscribe({
      next: () => {
        console.log('[SearchService] Search index initialized with', this.searchIndex.length, 'documents');
        if (this.searchIndex.length > 0) {
          console.log('[SearchService] Sample of indexed documents:', 
            this.searchIndex.slice(0, 3).map(d => d.path));
        }
      },
      error: (err) => {
        console.error('[SearchService] Error in search index initialization:', err);
        this.error.next('Failed to initialize search index: ' + (err?.message || err));
      }
    });
  }
  
  private indexAllContent(): Observable<void> {
    console.log('[SearchService] indexAllContent called');
    
    return of(this.contentCache).pipe(
      tap(() => console.log('[SearchService] Starting to index content...')),
      map(items => this.flattenContentItems(items)),
      tap(flatItems => console.log('[SearchService] Flattened items:', flatItems.length)),
      map(flatItems => flatItems.filter(item => 
        !item.isDirectory && item.path?.toLowerCase().endsWith('.md')
      )),
      tap(mdFiles => {
        console.log(`[SearchService] Found ${mdFiles.length} markdown files to index`);
        if (mdFiles.length === 0) {
          console.warn('[SearchService] No markdown files found to index');
        }
      }),
      switchMap(mdFiles => {
        if (mdFiles.length === 0) {
          this.searchIndex = [];
          this.indexReady = true;
          return of(undefined);
        }

        const indexObservables = mdFiles.map(mdFile => 
          this.indexMarkdownFile(mdFile).pipe(
            catchError(err => {
              console.error(`Error indexing ${mdFile.path}:`, err);
              return of(null);
            })
          )
        );

        return forkJoin(indexObservables).pipe(
          tap(results => {
            const validResults = results.filter((result): result is SearchResult => result !== null);
            this.searchIndex = validResults;
            this.indexReady = true;
            console.log('[SearchService] Indexing complete. Total documents:', validResults.length);
          })
        );
      }),
      map(() => undefined)
    );
  }
  
  private indexMarkdownFile(mdFile: ContentItem): Observable<SearchResult | null> {
    if (!mdFile || !mdFile.path) {
      console.error('[SearchService] Invalid markdown file:', mdFile);
      return of(null);
    }

    const filePath = mdFile.path;
    console.log(`[SearchService] Indexing markdown file: ${filePath}`);

    // Clean up the path for the markdown service
    const cleanPath = filePath
      .replace(/^\/+|\/+$/g, '')
      .replace(/^assets\/content\//, '')
      .replace(/\.md$/i, '');

    return this.markdownService.getMarkdownFile(cleanPath).pipe(
      map(markdownContent => {
        if (!markdownContent) {
          console.warn(`[SearchService] No content for file: ${filePath}`);
          return null;
        }

        const title = mdFile.metadata?.title || 
                     filePath.split('/').pop()?.replace(/\.md$/i, '') || 
                     'Untitled';

        const preview = markdownContent.content.substring(0, 200) + 
                      (markdownContent.content.length > 200 ? '...' : '');

        return {
          path: filePath,
          title,
          preview,
          score: 0,
          matches: []
        };
      }),
      catchError(err => {
        console.error(`[SearchService] Error processing file ${filePath}:`, err);
        return of(null);
      })
    );
  }
  
  private flattenContentItems(items: ContentItem[]): ContentItem[] {
    return items.reduce<ContentItem[]>((acc, item) => {
      if (item.isDirectory && item.children) {
        return [...acc, item, ...this.flattenContentItems(item.children)];
      }
      return [...acc, item];
    }, []);
  }

  search(term: string): void {
    const searchTerm = term.trim().toLowerCase();
    
    if (!searchTerm) {
      this.searchResults.next([]);
      return;
    }

    console.log(`[SearchService] Searching for: "${searchTerm}"`);
    this.isLoading.next(true);
    this.error.next(null);
    
    this.addToRecentSearches(searchTerm);
    
    if (!this.indexReady) {
      this.searchResults.next([{
        path: '',
        title: 'Indexing in progress',
        preview: 'Search index is not ready yet. Please try again in a moment.',
        score: 0,
        matches: []
      }]);
      this.isLoading.next(false);
      return;
    }
    
    try {
      const results = this.searchIndex
        .map(item => this.calculateRelevance(item, searchTerm))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, SEARCH_CONFIG.maxResults);
      
      console.log(`[SearchService] Search complete. Found ${results.length} results`);
      this.searchResults.next(results);
    } catch (error) {
      console.error('[SearchService] Error during search:', error);
      this.error.next('An error occurred during search');
      this.searchResults.next([]);
    } finally {
      this.isLoading.next(false);
    }
  }
  
  private calculateRelevance(item: SearchResult, searchTerm: string): SearchResult {
    let score = 0;
    const matches: Array<{ line: number; content: string; highlighted: string }> = [];
    const regex = new RegExp(`(${this.escapeRegExp(searchTerm)})`, 'gi');
    
    // Title matches (higher weight)
    if (item.title.toLowerCase().includes(searchTerm)) {
      score += 3;
      matches.push({
        line: 0,
        content: item.title,
        highlighted: item.title.replace(regex, '<mark>$1</mark>')
      });
    }
    
    // Content matches (lower weight)
    const content = item.preview.toLowerCase();
    if (content.includes(searchTerm)) {
      score += 1;
      
      const lines = item.preview.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(searchTerm)) {
          matches.push({
            line: index + 1,
            content: line,
            highlighted: line.replace(regex, '<mark>$1</mark>')
          });
        }
      });
    }
    
    return { ...item, score, matches };
  }
  
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  private loadRecentSearches(): void {
    try {
      const saved = localStorage.getItem(this.recentSearchesKey);
      this.recentSearches = saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading recent searches:', error);
      this.recentSearches = [];
    }
  }
  
  private saveRecentSearches(): void {
    try {
      localStorage.setItem(this.recentSearchesKey, JSON.stringify(this.recentSearches));
    } catch (error) {
      console.error('Error saving recent searches:', error);
    }
  }
  
  addToRecentSearches(term: string): void {
    if (!term.trim()) return;
    
    this.recentSearches = this.recentSearches
      .filter(t => t.toLowerCase() !== term.toLowerCase())
      .slice(0, SEARCH_CONFIG.maxRecentSearches - 1);
    
    this.recentSearches.unshift(term);
    this.saveRecentSearches();
  }
  
  getRecentSearches(): string[] {
    return [...this.recentSearches];
  }
  
  clearRecentSearches(): void {
    this.recentSearches = [];
    this.saveRecentSearches();
  }
}
