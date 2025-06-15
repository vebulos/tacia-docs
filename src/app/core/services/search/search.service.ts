import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, forkJoin, firstValueFrom, throwError } from 'rxjs';
import { map, catchError, switchMap, tap, finalize } from 'rxjs/operators';
import { MarkdownService } from '../markdown.service';
import { ContentItem } from '../content.interface';
import { ContentService } from '../content.service';
import { environment } from '../../../../environments/environment';

/**
 * Represents a search result item with content and match information
 */
export interface SearchResult {
  /** Full path including parent directories and .md extension for files */
  path: string;
  
  /** Display title of the document */
  title: string;
  
  /** Short preview text */
  preview: string;
  
  /** Relevance score for search results */
  score: number;
  
  /** Raw content of the document for full-text search */
  content?: string;
  
  /** Array of matches with line numbers and highlighted content */
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
  
  // Public observables
  searchResults$ = this.searchResults.asObservable();
  isLoading$ = this.isLoading.asObservable();
  error$ = this.error.asObservable();

  constructor(
    private http: HttpClient,
    private markdownService: MarkdownService,
    private contentService: ContentService
  ) {
    console.log('[SearchService] Constructor called');
    this.loadRecentSearches();
    this.initializeSearchIndex().subscribe();
  }
  
  /**
   * Rebuild the search index
   */
  async rebuildIndex(): Promise<void> {
    console.log('[SearchService] Rebuilding index...');
    this.isLoading.next(true);
    this.error.next(null);
    
    try {
      await firstValueFrom(this.initializeSearchIndex());
      console.log('[SearchService] Index rebuilt successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error while rebuilding index';
      console.error('[SearchService] Error rebuilding index:', errorMsg);
      this.error.next(`Error rebuilding index: ${errorMsg}`);
      throw err;
    } finally {
      this.isLoading.next(false);
    }
  }

  /**
   * Initialize the search index
   * @returns Observable that completes when the index is ready
   */
  private initializeSearchIndex(): Observable<void> {
    console.log('[SearchService] Initializing search index...');
    
    if (!this.contentService) {
      const errorMsg = 'Content service is not injected!';
      console.error('[SearchService]', errorMsg);
      this.error.next(errorMsg);
      return throwError(() => new Error(errorMsg));
    }
    
    this.isLoading.next(true);
    this.error.next(null);
    
    return this.contentService.getContentStructure().pipe(
      tap({
        next: (contentItems) => {
          console.log(`[SearchService] Indexing ${contentItems.length} content items`);
          this.contentCache = contentItems;
        },
        error: (err) => console.error('[SearchService] Error getting content structure:', err)
      }),
      switchMap((contentItems) => this.indexContent(contentItems)),
      tap({
        next: () => {
          console.log('[SearchService] Indexing completed successfully');
          this.indexReady = true;
        },
        error: (err) => {
          console.error('[SearchService] Error during indexing:', err);
          this.error.next('Error while indexing content');
        }
      }),
      finalize(() => this.isLoading.next(false))
    );
  }

  /**
   * Index content items
   * @param items Content items to index
   */
  private indexContent(items: ContentItem[]): Observable<void> {
    console.log('[SearchService] Indexing content...');
    
    // First, load all content recursively
    return this.loadAllContentRecursively(items).pipe(
      switchMap(allItems => {
        // Flatten the hierarchical structure
        const flatItems = this.flattenContentItems(allItems);
        
        // Filter items that have a file path and are not directories
        const itemsToIndex = flatItems.filter(item => 
          item.path && !item.isDirectory && item.path.endsWith('.md')
        );
        
        if (itemsToIndex.length === 0) {
          console.warn('[SearchService] No valid markdown files found to index');
          return of(undefined);
        }
        
        console.log(`[SearchService] Indexing ${itemsToIndex.length} markdown files`);
        
        // Create an array of observables to index each file
        const indexOperations = itemsToIndex.map(item => 
          this.indexMarkdownFile(item).pipe(
            catchError(err => {
              console.error(`[SearchService] Error indexing ${item.path}:`, err);
              return of(null);
            })
          )
        );
        
        // Execute all indexing operations in parallel
        return forkJoin(indexOperations).pipe(
          tap(results => {
            // Filter out null results (errors)
            const validResults = results.filter((r): r is SearchResult => r !== null);
            this.searchIndex = validResults;
            console.log(`[SearchService] Successfully indexed ${validResults.length} files`);
          }),
          map(() => {}) // Convert to Observable<void>
        );
      })
    );
  }
  
  /**
   * Recursively load all content items
   * @param items Root items to start loading from
   */
  private loadAllContentRecursively(items: ContentItem[]): Observable<ContentItem[]> {
    if (!items || items.length === 0) {
      return of([]);
    }
    
    // For each directory, load its children and process them recursively
    const loadOperations = items.map(item => {
      if (item.isDirectory) {
        return this.contentService.getContent(item.path).pipe(
          switchMap(children => 
            this.loadAllContentRecursively(children).pipe(
              map(processedChildren => ({
                ...item,
                children: processedChildren
              }))
            )
          )
        );
      }
      return of(item);
    });
    
    return forkJoin(loadOperations);
  }

  /**
   * Flatten the hierarchical content structure into a flat list
   * @param items Content items to flatten
   * @returns Flattened list of content items
   */
  private flattenContentItems(items: ContentItem[]): ContentItem[] {
    if (!items || !Array.isArray(items)) {
      console.warn('[SearchService] No items to flatten or invalid items array');
      return [];
    }
    
    const result: ContentItem[] = [];
    
    const flatten = (items: ContentItem[]) => {
      items.forEach(item => {
        if (item) {
          result.push(item);
          if (item.children && item.children.length > 0) {
            flatten(item.children);
          }
        }
      });
    };
    
    flatten(items);
    return result;
  }

  /**
   * Index a single Markdown file
   * @param item Content item representing the Markdown file
   * @returns Observable of the indexing result with content
   */
  private indexMarkdownFile(item: ContentItem): Observable<SearchResult> {
    if (!item?.path) {
      console.warn('[SearchService] Invalid item or missing path for indexing');
      return throwError(() => new Error('Invalid item or missing path for indexing'));
    }

    // Use metadata.title if available, otherwise extract from path
    const title = item.metadata?.['title'] || item.name || item.path.split('/').pop() || 'Untitled';
    
    // Create the search result with basic information
    const searchResult: SearchResult = {
      path: item.path, // Path already includes the .md extension for files
      title: title,
      preview: item.metadata?.['description'] || '',
      score: 0,
      matches: []
    };

    // Only process markdown files
    if (!item.path.endsWith('.md')) {
      return of(searchResult);
    }

    // Load the markdown file content
    return this.markdownService.getMarkdownFile(item.path).pipe(
      map(markdownFile => {
        // Store the raw content for full-text search
        searchResult.content = markdownFile.content;
        
        // If we don't have a preview from metadata, create one from content
        if (!searchResult.preview) {
          searchResult.preview = this.createPreview(markdownFile.content);
        }
        
        return searchResult;
      }),
      catchError(error => {
        console.error(`[SearchService] Error loading markdown file ${item.path}:`, error);
        
        // If we can't load the content, try to create a basic preview from metadata
        if (!searchResult.preview) {
          searchResult.preview = `Documentation page for ${title}`;
        }
        
        return of(searchResult);
      })
    );
  }

  /**
   * Create a preview from content
   * @param content Source content
   * @param maxLength Maximum preview length
   * @returns Formatted preview
   */
  private createPreview(content: string, maxLength: number = 200): string {
    if (!content) return '';
    
    // Clean up content
    let preview = content
      .replace(/<[^>]*>/g, '') // Remove HTML
      .replace(/[#*_`\[\]]/g, '') // Remove Markdown syntax
      .replace(/\s+/g, ' ') // Replace multiple spaces
      .trim();
    
    // Truncate if necessary
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...';
    }
    
    return preview;
  }

  /**
   * Load recent searches from local storage
   */
  private loadRecentSearches(): void {
    try {
      const savedSearches = localStorage.getItem(this.recentSearchesKey);
      if (savedSearches) {
        this.recentSearches = JSON.parse(savedSearches);
        console.log(`[SearchService] Loaded ${this.recentSearches.length} recent searches`);
      }
    } catch (err) {
      console.error('[SearchService] Error loading recent searches:', err);
      this.recentSearches = [];
    }
  }

  /**
   * Save recent searches to local storage
   */
  private saveRecentSearches(): void {
    try {
      localStorage.setItem(this.recentSearchesKey, JSON.stringify(this.recentSearches));
    } catch (error) {
      console.error('[SearchService] Error saving recent searches:', error);
    }
  }

  /**
   * Add a search to recent searches
   * @param query Search term to add
   */
  public addToRecentSearches(query: string): void {
    const newTerm = query.trim();
    if (!newTerm) return;
    
    const newTermLower = newTerm.toLowerCase();
    
    // Check if a longer term already exists
    const longerTermExists = this.recentSearches.some(
      term => term.toLowerCase() !== newTermLower && 
             term.toLowerCase().startsWith(newTermLower)
    );
    
    if (longerTermExists) {
      // Do nothing if a longer term already exists
      return;
    }
    
    // Check and remove shorter terms that are prefixes of the new term
    this.recentSearches = this.recentSearches.filter(
      term => !newTermLower.startsWith(term.toLowerCase()) || term.toLowerCase() === newTermLower
    );
    
    // Remove duplicates (case-insensitive)
    this.recentSearches = this.recentSearches.filter(
      (term, index, self) => self.findIndex(t => t.toLowerCase() === term.toLowerCase()) === index
    );
    
    // Add the new term at the beginning
    this.recentSearches = this.recentSearches.filter(term => term.toLowerCase() !== newTermLower);
    this.recentSearches.unshift(newTerm);
    
    // Limit number of entries
    if (this.recentSearches.length > (environment.search?.maxRecentSearches || 10)) {
      this.recentSearches = this.recentSearches.slice(0, environment.search?.maxRecentSearches || 10);
    }
    
    // Save to storage
    this.saveRecentSearches();
  }

  /**
   * Search the indexed content with support for full-text search
   * @param query Search term to look for in titles, paths, previews, and content
   * @returns Observable of search results sorted by relevance
   */
  search(query: string): Observable<SearchResult[]> {
    if (!query || !query.trim()) {
      return of([]);
    }

    this.isLoading.next(true);
    this.error.next(null);
    
    // Add to recent searches
    this.addToRecentSearches(query);
    
    const queryLower = query.trim().toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);
    
    if (queryTerms.length === 0) {
      this.isLoading.next(false);
      return of([]);
    }
    
    // Process each item in the search index
    const results = this.searchIndex
      .map(item => {
        const titleLower = item.title.toLowerCase();
        const pathLower = item.path.toLowerCase();
        const previewLower = item.preview.toLowerCase();
        const contentLower = item.content?.toLowerCase() || '';
        
        // Calculate scores for each search term
        const scores = queryTerms.map(term => {
          let score = 0;
          
          // Exact match in title (highest priority)
          if (titleLower === term) score += 100;
          
          // Term appears in title
          if (titleLower.includes(term)) score += 10;
          
          // Term appears in path
          if (pathLower.includes(term)) score += 5;
          
          // Term appears in preview
          if (previewLower.includes(term)) score += 3;
          
          // Term appears in content
          if (contentLower.includes(term)) {
            score += 1;
            
            // Additional points for multiple occurrences in content
            const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
            score += Math.min(occurrences, 5); // Cap at 5 additional points
          }
          
          return score;
        });
        
        // Calculate total score (average of term scores)
        const totalScore = scores.reduce((sum, score) => sum + score, 0) / queryTerms.length;
        
        // Generate preview with highlighted terms if there's a match
        let preview = item.preview;
        if (totalScore > 0 && item.content) {
          // Find the first occurrence of any search term in the content
          const firstMatch = queryTerms
            .map(term => ({
              term,
              index: contentLower.indexOf(term)
            }))
            .filter(match => match.index >= 0)
            .sort((a, b) => a.index - b.index)[0];
          
          if (firstMatch) {
            const start = Math.max(0, firstMatch.index - 50);
            const end = Math.min(contentLower.length, firstMatch.index + firstMatch.term.length + 100);
            let snippet = item.content.substring(start, end);
            
            // Add ellipsis if we're not at the start/end
            if (start > 0) snippet = `...${snippet}`;
            if (end < item.content.length) snippet = `${snippet}...`;
            
            // Highlight search terms in the snippet
            queryTerms.forEach(term => {
              const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
              snippet = snippet.replace(regex, '<mark>$1</mark>');
            });
            
            preview = snippet;
          }
        }
        
        return {
          ...item,
          score: totalScore,
          preview: totalScore > 0 ? preview : item.preview,
          matches: queryTerms
            .filter(term => contentLower.includes(term))
            .map(term => ({
              line: 0, // Line numbers not available without parsing
              content: term,
              highlighted: `<mark>${term}</mark>`
            }))
        };
      })
      .filter(item => item.score > 0) // Only include items with matches
      .sort((a, b) => {
        // Sort by score (descending)
        if (a.score !== b.score) return b.score - a.score;
        
        // If scores are equal, prefer shorter paths (more specific matches)
        if (a.path.length !== b.path.length) return a.path.length - b.path.length;
        
        // Finally, sort alphabetically by title
        return a.title.localeCompare(b.title);
      });
    
    // Limit results
    const limitedResults = results.slice(0, environment.search?.maxResults || 50);
    
    this.isLoading.next(false);
    this.searchResults.next(limitedResults);
    
    return of(limitedResults);
  }

  /**
   * Get recent searches
   * @returns List of recent search terms
   */
  getRecentSearches(): string[] {
    return [...this.recentSearches];
  }

  /**
   * Clear search history
   */
  clearRecentSearches(): void {
    this.recentSearches = [];
    try {
      localStorage.removeItem(this.recentSearchesKey);
    } catch (error) {
      console.error('[SearchService] Error clearing recent searches:', error);
    }
  }

  /**
   * Ensure the search index is ready
   * @returns Observable that completes when the index is ready
   */
  private ensureIndexReady(): Observable<void> {
    if (this.indexReady) {
      return of(undefined);
    }
    
    return this.initializeSearchIndex().pipe(
      catchError(error => {
        console.error('[SearchService] Error ensuring index is ready:', error);
        return throwError(() => new Error('Failed to initialize search index'));
      })
    );
  }

  /**
   * Escape special characters for regular expressions
   * @param string String to escape
   * @returns Escaped string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
