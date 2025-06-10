import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap, debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { SEARCH_CONFIG } from './search.config';
import { MarkdownService } from '../markdown.service';
import { ContentService } from '../content.service';

export interface ContentItem {
  name: string;
  path: string;
  filePath?: string; // Relative path to the markdown file
  isDirectory: boolean;
  children?: ContentItem[];
  metadata?: {
    title?: string;
    categories?: string[];
    tags?: string[];
    [key: string]: any;
  };
}

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
    private contentService: ContentService
  ) {
    console.log('[SearchService] Constructor called');
    this.loadRecentSearches();
    console.log('[SearchService] Calling initializeSearchIndex()...');
    this.initializeSearchIndex();
  }
  
  private initializeSearchIndex(): void {
    console.log('[SearchService] Initializing search index...');
    this.contentService.getContentWithFilePaths().pipe(
      tap(contentItems => {
        console.log('[SearchService] Received', contentItems.length, 'items with file paths');
        this.contentCache = contentItems;
      }),
      switchMap(() => {
        console.log('[SearchService] Starting to index all content...');
        return this.indexAllContent();
      }),
      catchError(err => {
        console.error('[SearchService] Error in observable chain before subscribe:', err);
        this.error.next('Failed to initialize search index: ' + (err?.message || err));
        return of(undefined);
      })
    ).subscribe({
      next: () => {
        this.indexReady = true;
        console.log('[SearchService] Search index initialized with', this.searchIndex.length, 'documents');
        if (this.searchIndex.length > 0) {
          console.log('[SearchService] Sample of indexed documents:', this.searchIndex.slice(0, 3).map(d => d.path));
        } else {
          console.warn('[SearchService] Search index is EMPTY after initialization!');
        }
      },
      error: (err) => {
        console.error('[SearchService] Error initializing search index in subscribe', err);
        this.error.next('Failed to initialize search index (subscribe): ' + (err?.message || err));
      }
    });
  }
  
  private flattenContentItems(items: ContentItem[]): ContentItem[] {
    return items.reduce<ContentItem[]>((acc, item) => {
      if (item.isDirectory && item.children) {
        return [...acc, item, ...this.flattenContentItems(item.children)];
      }
      return [...acc, item];
    }, []);
  }
  
  private indexAllContent(): Observable<void> {
    console.log('[SearchService] Content cache items:', this.contentCache);
    
    const markdownFiles = this.contentCache.filter(item => {
      // Skip directories and items without a filePath
      if (item.isDirectory || !item.filePath) {
        if (!item.isDirectory) {
          console.log(`[SearchService] Skipping item without filePath:`, item);
        }
        return false;
      }
      
      // Check if it's a markdown file using the filePath
      const isMarkdown = item.filePath.endsWith('.md') || item.filePath.endsWith('.markdown');
      
      if (isMarkdown) {
        console.log(`[SearchService] Found markdown file: ${item.filePath}`);
      } else {
        console.log(`[SearchService] Skipping non-markdown file: ${item.filePath}`);
      }
      
      return isMarkdown;
    });
    
    console.log(`[SearchService] Found ${markdownFiles.length} markdown files to index`);
    
    if (markdownFiles.length === 0) {
      console.warn('[SearchService] No markdown files found in content cache. Content cache:', 
        this.contentCache.map(item => ({
          name: item.name,
          path: item.path,
          isDirectory: item.isDirectory,
          childrenCount: item.children?.length || 0
        }))
      );
    }
    
    // Only process a few files initially for testing
    const filesToProcess = markdownFiles.slice(0, 5);
    console.log(`[SearchService] Will process ${filesToProcess.length} markdown files for indexing`);
    
    if (filesToProcess.length === 0) {
      console.warn('[SearchService] No files to process. Check if content structure is loaded correctly.');
      return of(undefined);
    }
    
    return forkJoin(
      filesToProcess.map(file => {
        // Use the filePath from the content structure
        const filePath = file.filePath;
        if (!filePath) {
          console.error('[SearchService] File has no filePath:', file);
          return of(null);
        }
        
        // Clean up the path before passing to markdown service
        const cleanPath = filePath
          .replace(/^\/+|\/+$/g, '')  // Remove leading/trailing slashes
          .replace(/^assets\/content\//, '')  // Remove any assets/content/ prefix
          .replace(/\.md$/i, '');  // Remove .md extension if present
        
        console.log(`[SearchService] Attempting to index file: ${cleanPath}`);
        
        return this.markdownService.getMarkdownFile(cleanPath).pipe(
          tap(mdFile => {
            console.log(`[SearchService] Successfully loaded markdown file: ${filePath} (${mdFile.content?.length || 0} chars)`);
          }),
          map(mdFile => {
            const result = this.indexMarkdownFile(mdFile);
            if (result) {
              console.log(`[SearchService] Successfully indexed: ${result.path} (${result.matches?.length || 0} matches)`);
            } else {
              console.warn(`[SearchService] Failed to index file (null result): ${filePath}`);
            }
            return result;
          }),
          catchError((error) => {
            console.error(`[SearchService] Error indexing file: ${filePath}`, {
              error: error.message,
              status: error.status,
              url: error.url,
              stack: error.stack
            });
            return of(null);
          })
        );
      })
    ).pipe(
      tap(results => {
        const successful = results.filter(Boolean);
        console.log(`[SearchService] Indexing complete. Successfully indexed ${successful.length} of ${results.length} files`);
        
        if (successful.length === 0 && results.length > 0) {
          console.warn('[SearchService] No documents were successfully indexed. Check the logs for errors.');
        } else if (successful.length > 0) {
          console.log('[SearchService] Sample of indexed documents:', 
            successful.slice(0, 3).filter((d): d is SearchResult => d !== null).map(d => ({
              path: d?.path || 'unknown',
              matches: d?.matches?.length || 0,
              score: d?.score || 0
            }))
          );
        }
      }),
      map(results => {
        this.searchIndex = results.filter(Boolean) as SearchResult[];
        console.log(`[SearchService] Search index now contains ${this.searchIndex.length} documents`);
      }),
      catchError(error => {
        console.error('[SearchService] Fatal error in indexAllContent:', {
          message: error.message,
          stack: error.stack,
          error: error
        });
        this.error.next('Failed to index content: ' + (error?.message || 'Unknown error'));
        return of(undefined);
      })
    )
  }
  
  private indexMarkdownFile(mdFile: any): SearchResult | null {
    if (!mdFile?.content) {
      console.warn('[SearchService] No content in markdown file:', mdFile.path || mdFile.filePath);
      return null;
    }
    
    // Clean up the path to prevent duplication
    let cleanPath = mdFile.path || '';
    if (mdFile.filePath) {
      // Use the filePath but remove any .md extension and clean up the path
      cleanPath = mdFile.filePath.replace(/\.md$/i, '');
      // Remove any duplicate segments in the path
      const segments = cleanPath.split('/').filter(Boolean);
      cleanPath = segments.join('/');
    }
    
    try {
      // Extract text content from HTML, stripping tags
      const textContent = mdFile.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      return {
        path: cleanPath,
        title: (mdFile.metadata?.title as string) || 'Untitled',
        preview: textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''),
        score: 0, // Will be calculated during search
        matches: [] // Will be populated during search
      };
    } catch (error) {
      console.error('Error indexing markdown file', mdFile.path, error);
      return null;
    }
  }
  
  // Public method to add a term to recent searches
  addRecentSearch(term: string): void {
    if (!term.trim()) return;
    
    // Remove if already exists
    this.recentSearches = this.recentSearches.filter(
      t => t.toLowerCase() !== term.toLowerCase()
    );
    
    // Add to beginning
    this.recentSearches.unshift(term);
    
    // Limit the number of recent searches
    if (this.recentSearches.length > SEARCH_CONFIG.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(0, SEARCH_CONFIG.maxRecentSearches);
    }
    
    // Save to storage
    this.saveRecentSearches();
  }

  searchResults$ = this.searchResults.asObservable();
  isLoading$ = this.isLoading.asObservable();
  error$ = this.error.asObservable();

  search(term: string): void {
    const searchTerm = term.trim().toLowerCase();
    
    if (!searchTerm) {
      console.log('Empty search term, clearing results');
      this.searchResults.next([]);
      return;
    }

    console.log(`Initiating search for: "${searchTerm}"`);
    this.isLoading.next(true);
    this.error.next(null);
    
    // Add to recent searches
    this.addRecentSearch(searchTerm);
    
    // Log the search term and available files
    console.log(`Searching for: "${searchTerm}"`);
    console.log('Search index contains', this.searchIndex.length, 'documents');
    
    if (this.searchIndex.length === 0) {
      console.warn('Search index is empty!');
    } else {
      console.log('Sample of indexed documents:', this.searchIndex.slice(0, 3).map(d => d.path));
    }
    
    if (!this.indexReady) {
      console.warn('Search index is not ready yet');
      this.searchResults.next([{
        path: '',
        title: 'Indexing content...',
        preview: 'Please wait while we index the documentation content for searching.',
        score: 0,
        matches: []
      }]);
      this.isLoading.next(false);
      return;
    }
    
    // Simple in-memory search implementation
    console.log('Performing search across', this.searchIndex.length, 'documents');
    
    try {
      const results = this.searchIndex
        .map(item => {
          try {
            const scoredItem = this.calculateRelevance(item, searchTerm);
            if (scoredItem.score > 0) {
              console.log(`Match found in: ${item.path} (score: ${scoredItem.score})`);
            }
            return scoredItem;
          } catch (error) {
            console.error(`Error calculating relevance for ${item.path}:`, error);
            return { ...item, score: 0 };
          }
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, SEARCH_CONFIG.maxResults);
      
      console.log('Search complete. Found', results.length, 'results');
      this.searchResults.next(results);
    } catch (error) {
      console.error('Error during search:', error);
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
    
    // Check title matches (higher weight)
    if (item.title.toLowerCase().includes(searchTerm)) {
      score += 3;
      matches.push({
        line: 0,
        content: item.title,
        highlighted: item.title.replace(regex, '<mark>$1</mark>')
      });
    }
    
    // Check content matches (lower weight)
    const content = item.preview.toLowerCase();
    if (content.includes(searchTerm)) {
      score += 1;
      
      // Find all matches in preview
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

  getRecentSearches(): string[] {
    return [...this.recentSearches];
  }
  
  clearRecentSearches(): void {
    this.recentSearches = [];
    this.saveRecentSearches();
  }

  private addToRecentSearches(term: string): void {
    if (!term.trim()) return;

    // Remove if already exists
    this.recentSearches = this.recentSearches.filter(t => t.toLowerCase() !== term.toLowerCase());
    
    // Add to beginning
    this.recentSearches.unshift(term);
    
    // Limit the number of recent searches
    if (this.recentSearches.length > SEARCH_CONFIG.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(0, SEARCH_CONFIG.maxRecentSearches);
    }
    
    // Save to storage
    this.saveRecentSearches();
  }

  private loadRecentSearches(): void {
    try {
      const saved = localStorage.getItem(this.recentSearchesKey);
      this.recentSearches = saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load recent searches:', error);
      this.recentSearches = [];
    }
  }

  private saveRecentSearches(): void {
    try {
      localStorage.setItem(
        this.recentSearchesKey, 
        JSON.stringify(this.recentSearches.slice(0, SEARCH_CONFIG.maxRecentSearches))
      );
    } catch (error) {
      console.error('Failed to save recent searches:', error);
    }
  }
}
