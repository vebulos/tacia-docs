import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { getLogger } from '../logging/logger';
const LOG = getLogger('SearchService');
import { BehaviorSubject, Observable, of, forkJoin, firstValueFrom, throwError, from, concat } from 'rxjs';
import { map, catchError, switchMap, tap, finalize, concatMap, delay, toArray } from 'rxjs/operators';
import { MarkdownService } from '../markdown.service';
import { SearchResult } from '../../interfaces/search.interface';
import { ContentItem } from '../content.interface';

// Type for tags that can be either strings or objects with a name property
type TagType = string | { name: string; [key: string]: any };

// Type for search results
type SearchResultType = {
  title: string;
  path: string;
  matches: { line: number; content: string; isTag: boolean; highlighted: string }[];
};

// Fonction utilitaire pour extraire la valeur d'un tag
function getTagValue(tag: any): string {
  if (typeof tag === 'string') {
    return tag;
  }
  if (tag && typeof tag === 'object' && 'name' in tag) {
    return (tag as { name: string }).name || '';
  }
  return '';
}

import { ContentService } from '../content.service';
import { environment } from '../../../../environments/environment';
import { StorageService } from '../storage.service';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  // Storage keys
  private readonly recentSearchesKey = 'recentSearches';
  private readonly searchIndexKey = 'searchIndex';
  private readonly indexTimestampKey = 'searchIndexTimestamp';
  
  // Subjects for reactive state
  private recentSearches: string[] = [];
  private searchResults = new BehaviorSubject<SearchResult[]>([]);
  private isLoading = new BehaviorSubject<boolean>(false);
  private error = new BehaviorSubject<string | null>(null);
  
  // Search index and state
  private contentCache: ContentItem[] = [];
  private searchIndex: SearchResult[] = [];
  private indexReady = false;
  private lastIndexTimestamp: number = 0;
  
  // Performance configuration
  private readonly batchSize = 5; // Number of files to process in parallel
  private readonly batchDelay = 100; // Milliseconds between batches
  private readonly indexTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  // Public observables
  searchResults$ = this.searchResults.asObservable();
  isLoading$ = this.isLoading.asObservable();
  error$ = this.error.asObservable();

  constructor(
    private http: HttpClient,
    private markdownService: MarkdownService,
    private contentService: ContentService,
    private storageService: StorageService
  ) {
    this.loadRecentSearches();
    this.loadSearchIndexFromStorage();
    
    // Check if we need to rebuild the index
    if (this.shouldRebuildIndex()) {
      this.initializeSearchIndex().subscribe();
    } else {
      this.indexReady = true;
    }
  }
  
  /**
   * Rebuild the search index
   */
  /**
   * Rebuilds the search index and returns a Promise
   * @deprecated Use refreshIndex() for Observable-based approach
   */
  async rebuildIndex(): Promise<void> {
    LOG.info('Rebuilding search index...');
    this.isLoading.next(true);
    this.error.next(null);
    
    try {
      await firstValueFrom(this.initializeSearchIndex());
      LOG.info('Index rebuilt successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error while rebuilding index';
      LOG.error('Error rebuilding index', { error: errorMsg });
      this.error.next(`Error rebuilding index: ${errorMsg}`);
      throw err;
    } finally {
      this.isLoading.next(false);
    }
  }

  /**
   * Refreshes the search index and returns an Observable
   * @returns Observable that completes when the index is refreshed
   */
  refreshIndex(): Observable<void> {
    LOG.info('Refreshing search index...');
    this.isLoading.next(true);
    this.error.next(null);
    
    return this.initializeSearchIndex().pipe(
      tap({
        next: () => LOG.info('Index refreshed successfully'),
        error: (err) => {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error while refreshing index';
          LOG.error('Error refreshing index', { error: errorMsg });
          this.error.next(`Error refreshing index: ${errorMsg}`);
        }
      }),
      finalize(() => this.isLoading.next(false)),
      map(() => {}) // Convert to Observable<void>
    );
  }

  /**
   * Initialize the search index
   * @returns Observable that completes when the index is ready
   */
  private initializeSearchIndex(): Observable<void> {
    LOG.debug('Initializing search index...');
    
    if (!this.contentService) {
      const errorMsg = 'Content service is not injected!';
      LOG.error('Content service not available', { error: errorMsg });
      this.error.next(errorMsg);
      return throwError(() => new Error(errorMsg));
    }
    
    this.isLoading.next(true);
    this.error.next(null);
    
    return this.contentService.getContentStructure().pipe(
      tap({
        next: (contentItems) => {
          LOG.info(`Indexing ${contentItems.length} content items`);
          this.contentCache = contentItems;
        },
        error: (err) => {
          LOG.error('Error getting content structure', { error: err });
        }
      }),
      switchMap((contentItems) => this.indexContent(contentItems)),
      tap({
        next: () => {
          LOG.info('Indexing completed successfully');
          this.indexReady = true;
          
          // Save the index to storage
          this.saveSearchIndexToStorage();
        },
        error: (err) => {
          LOG.error('Error during indexing', { error: err });
          this.error.next('Error while indexing content');
        }
      }),
      finalize(() => this.isLoading.next(false))
    );
  }
  
  /**
   * Load search index from storage
   */
  private loadSearchIndexFromStorage(): void {
    // Load the search index from storage
    this.storageService.get<SearchResult[]>(this.searchIndexKey).subscribe({
      next: (storedIndex) => {
        if (storedIndex && storedIndex.length > 0) {
          this.searchIndex = storedIndex;
          LOG.info(`Loaded ${storedIndex.length} items from cached index`);
        }
      },
      error: (err) => {
        LOG.error('Error loading search index from storage', { error: err });
        this.searchIndex = [];
      }
    });
    
    // Load the timestamp
    this.storageService.get<number>(this.indexTimestampKey).subscribe({
      next: (timestamp) => {
        if (timestamp) {
          this.lastIndexTimestamp = timestamp;
          LOG.debug('Index timestamp loaded', { 
            timestamp: new Date(timestamp).toISOString() 
          });
        }
      },
      error: (err) => {
        LOG.error('Error loading timestamp from storage', { error: err });
        this.lastIndexTimestamp = 0;
      }
    });
  }
  
  /**
   * Save search index to storage
   */
  private saveSearchIndexToStorage(): void {
    const now = Date.now();
    this.lastIndexTimestamp = now;
    
    // Save the search index to storage with a TTL of 24 hours
    this.storageService.set(this.searchIndexKey, this.searchIndex, this.indexTTL).subscribe({
      next: () => {
        LOG.info(`Saved ${this.searchIndex.length} items to index cache`);
        
        // Save the timestamp after the index is successfully saved
        this.storageService.set(this.indexTimestampKey, now).subscribe({
          next: () => LOG.debug('Updated index timestamp', { timestamp: new Date(now).toISOString() }),
          error: (err) => LOG.error('Error saving timestamp', { error: err })
        });
      },
      error: (err) => LOG.error('Error saving search index to storage', { error: err })
    });
  }
  
  /**
   * Determine if the index should be rebuilt
   */
  private shouldRebuildIndex(): boolean {
    // If there's no index, rebuild it
    if (!this.searchIndex || this.searchIndex.length === 0) {
      return true;
    }
    
    // If the index is too old, rebuild it
    const now = Date.now();
    const indexAge = now - this.lastIndexTimestamp;
    if (indexAge > this.indexTTL) {
      LOG.info('Index is outdated, rebuilding', { 
        ageHours: Math.round(indexAge / (60 * 60 * 1000)),
        maxAgeHours: Math.round(this.indexTTL / (60 * 60 * 1000))
      });
      return true;
    }
    
    return false;
  }

  /**
   * Index content items
   * @param items Content items to index
   */
  private indexContent(items: ContentItem[]): Observable<void> {
    LOG.debug('Starting content indexing process');
    
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
          LOG.warn('No valid markdown files found to index');
          return of(undefined);
        }
        
        LOG.info('Starting markdown file indexing', { 
          fileCount: itemsToIndex.length,
          batchSize: this.batchSize 
        });
        
        // Track progress
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        this.searchIndex = [];
        
        // Process items in batches to avoid overwhelming the server
        return from(itemsToIndex).pipe(
          // Process in batches
          concatMap((item, index) => {
            // Add a delay between batches
            const shouldDelay = index > 0 && index % this.batchSize === 0;
            const source = shouldDelay ? of(item).pipe(delay(this.batchDelay)) : of(item);
            
            // Process the item
            return source.pipe(
              tap(() => {
                // Log progress every 5 items or for the first/last item
                if (index === 0 || index === itemsToIndex.length - 1 || index % 5 === 0) {
                  LOG.debug('Indexing progress', { 
                    current: index + 1, 
                    total: itemsToIndex.length,
                    percentage: Math.round((index + 1) / itemsToIndex.length * 100)
                  });
                }
              }),
              switchMap(item => this.indexMarkdownFile(item).pipe(
                catchError(err => {
                  LOG.error('Error indexing file', { 
                path: item.path, 
                error: err.message || 'Unknown error' 
              });
                  errorCount++;
                  return of(null);
                })
              )),
              tap(result => {
                processedCount++;
                if (result) {
                  successCount++;
                  this.searchIndex.push(result);
                }
              })
            );
          }),
          // Collect all results
          toArray(),
          tap(() => {
            LOG.info('Batch indexing completed', {
              successful: successCount,
              failed: errorCount,
              total: processedCount
            });
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
      LOG.warn('No items to flatten or invalid items array');
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
      LOG.warn('Invalid item or missing path for indexing');
      return throwError(() => new Error('Invalid item or missing path for indexing'));
    }

    // Use metadata.title if available, otherwise extract from path
    const title = item.metadata?.['title'] || item.name || item.path.split('/').pop() || 'Untitled';
    
    // Extract tags from metadata
    const tags = item.metadata?.['tags'] || [];
    LOG.debug('Indexing file', {
      path: item.path,
      title,
      hasMetadata: !!item.metadata,
      tagCount: tags.length
    });
    
    // Create the search result with basic information
    const searchResult: SearchResult = {
      path: item.path, // Path already includes the .md extension for files
      title: title,
      preview: item.metadata?.['description'] || '',
      tags: tags, // Include tags from metadata
      score: 0,
      matches: [],
      metadata: item.metadata // Include full metadata for debugging
    };
    
    LOG.debug('Created search result', {
      path: item.path,
      hasMetadata: !!item.metadata,
      metadataKeys: item.metadata ? Object.keys(item.metadata) : [],
      hasTags: !!tags && tags.length > 0,
      tagCount: tags.length
    });

    // Only process markdown files
    if (!item.path.endsWith('.md')) {
      return of(searchResult);
    }

    // Clean and format the path
    const cleanPath = item.path.startsWith('/') ? item.path.substring(1) : item.path;
    
    LOG.debug('Loading markdown file for indexing', {
      path: cleanPath,
      hasMetadata: !!item.metadata,
      hasTags: !!item.metadata?.tags,
      tagCount: item.metadata?.tags?.length || 0
    });
    
    return this.markdownService.getMarkdownFile(cleanPath).pipe(
      map(markdownFile => {
        LOG.debug('Successfully loaded markdown file', {
          path: cleanPath,
          hasMetadata: !!markdownFile.metadata,
          hasTags: !!markdownFile.metadata?.tags,
          tagCount: markdownFile.metadata?.tags?.length || 0
        });
        
        // Extract text content from markdown for full-text search
        const textContent = this.cleanMarkdownForSearch(markdownFile.markdown);
        searchResult.content = textContent;
        
        // Update tags from the markdown file metadata if available
        if (markdownFile.metadata?.tags?.length) {
          LOG.debug('Updating tags from markdown metadata', { 
            tagCount: markdownFile.metadata.tags.length 
          });
          searchResult.tags = markdownFile.metadata.tags;
        } else if (item.metadata?.tags?.length) {
          // Fallback to item metadata if markdown file metadata doesn't have tags
          LOG.debug('Using tags from item metadata', { 
            tagCount: item.metadata.tags.length 
          });
          searchResult.tags = item.metadata.tags;
        }
        
        // If we don't have a preview from metadata, create one from content
        if (!searchResult.preview) {
          searchResult.preview = this.createPreview(textContent);
        }
        
        return searchResult;
      }),
      catchError(error => {
        LOG.error('Error loading markdown file', { 
          path: item.path, 
          error: error.message || 'Unknown error' 
        });
        
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
   * @param content Source content (plain text)
   * @param maxLength Maximum preview length
   * @returns Formatted preview
   */
  private createPreview(content: string, maxLength: number = 200): string {
    if (!content) return '';
    
    // Clean up content
    let preview = content
      .replace(/\s+/g, ' ') // Replace multiple spaces
      .trim();
    
    // Truncate if necessary
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...';
    }
    
    return preview;
  }
  
  /**
   * Extract plain text from HTML content
   * @param html HTML content
   * @returns Plain text content
   */
  private extractTextFromHtml(html: string): string {
    if (!html) return '';
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get text content
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    return textContent
      .replace(/\s+/g, ' ') // Replace multiple spaces
      .trim();
  }

  /**
   * Load recent searches from local storage
   */
  private loadRecentSearches(): void {
    try {
      const savedSearches = localStorage.getItem(this.recentSearchesKey);
      if (savedSearches) {
        this.recentSearches = JSON.parse(savedSearches);
        LOG.debug('Loaded recent searches', { count: this.recentSearches.length });
      }
    } catch (err) {
      LOG.error('Error loading recent searches', { error: err });
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
      LOG.error('Error saving recent searches', { error });
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
  /**
   * Search the indexed content with support for both full-text and tag-based search
   * @param query Search term to look for in titles, paths, previews, content, or tags
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
    
    // Check if this is a tag search (starts with #)
    const isTagSearch = queryLower.startsWith('#');
    
    // Ensure all items have a tags array
    this.searchIndex = this.searchIndex.map(item => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags : []
    }));
    
    // Process the query terms
    let tagTerms: string[] = [];
    let textTerms: string[] = [];
    let queryTerms: string[] = [];
    
    if (isTagSearch) {
      // Split the query into tags, handling both #tag1 #tag2 and #tag1 tag2 formats
      const parts = queryLower.split(/(\s+)/);
      let currentTerm = '';
      
      for (const part of parts) {
        if (part.trim() === '') continue;
        
        if (part.startsWith('#')) {
          // If we have a current term that's not a tag, add it to text terms
          if (currentTerm) {
            textTerms.push(currentTerm.toLowerCase());
            currentTerm = '';
          }
          
          // Add the tag (without the #)
          const tag = part.substring(1).trim();
          if (tag) {
            tagTerms.push(tag.toLowerCase());
          }
        } else if (part.trim().includes(' ')) {
          // If the part contains spaces, it's a text term
          const trimmedPart = part.trim();
          if (trimmedPart) {
            textTerms.push(trimmedPart.toLowerCase());
          }
        } else {
          // Otherwise, it might be part of a tag or a text term
          currentTerm = currentTerm ? `${currentTerm} ${part}` : part;
        }
      }
      
      // Add any remaining current term to text terms
      if (currentTerm) {
        textTerms.push(currentTerm.toLowerCase());
      }
      
      LOG.debug('Search terms', { 
        tagTerms,
        textTerms,
        totalTagTerms: tagTerms.length,
        totalTextTerms: textTerms.length
      });
      
      // If there are no tags or text terms, return empty results
      if (tagTerms.length === 0 && textTerms.length === 0) {
        this.isLoading.next(false);
        return of([]);
      }
      
      LOG.debug('Processing search with terms', { 
        tagTerms,
        textTerms
      });
      
      const allTags = new Set<string>();
      const allTagsWithDocuments: Record<string, string[]> = {};
      
      // First pass: collect all tags and their documents
      this.searchIndex.forEach(item => {
        if (item.tags) {
          // Normalize tags during collection
          item.tags.forEach(tagObj => {
            // Use the utility function to get tag value
            const tagValue = getTagValue(tagObj);
              
            const normalizedTag = tagValue.toLowerCase().trim();
            if (normalizedTag) {  // Only process non-empty tags
              allTags.add(normalizedTag);
              if (!allTagsWithDocuments[normalizedTag]) {
                allTagsWithDocuments[normalizedTag] = [];
              }
              allTagsWithDocuments[normalizedTag].push(item.path);
            }
          });
        }
      });
      
      // Log tag statistics
      const tagStatistics = Array.from(allTags).sort().map(tag => ({
        tag,
        count: allTagsWithDocuments[tag]?.length || 0
      }));
      
      LOG.debug('Tag statistics', {
        totalUniqueTags: allTags.size,
        mostCommonTags: tagStatistics
          .sort((a, b) => b.count - a.count)
          .slice(0, 5) // Top 5 most common tags
      });
      
      // Log search term matches
      const termMatches = queryTerms.map(term => {
        const normalizedTerm = term.toLowerCase();
        const exists = allTags.has(normalizedTerm);
        return {
          term: normalizedTerm,
          exists,
          documentCount: exists ? (allTagsWithDocuments[normalizedTerm]?.length || 0) : 0
        };
      });
      
      LOG.debug('Search term matches', { termMatches });
      
      // Log documents that have all the requested tags
      if (tagTerms.length > 0) {
        const docsWithAllTags = this.searchIndex.filter(item => {
          const itemTags = new Set(item.tags?.map(t => getTagValue(t).toLowerCase()) || []);
          return tagTerms.every(term => 
            Array.from(itemTags).some(tag => tag.includes(term))
          );
        });
        
        LOG.debug('Documents matching all tags', {
          matchingDocumentCount: docsWithAllTags.length,
          requiredTags: tagTerms,
          sampleDocuments: docsWithAllTags.slice(0, 3).map(d => ({
            path: d.path,
            title: d.title,
            tagCount: d.tags?.length || 0
          }))
        });
      }
    } else {
      // For regular search, split by spaces
      queryTerms = queryLower.split(/\s+/).filter((term: string) => term.length > 0);
      textTerms = queryTerms;
      tagTerms = [];
    }
    
    if (tagTerms.length === 0 && textTerms.length === 0) {
      this.isLoading.next(false);
      return of([]);
    }
    
    LOG.debug('Processing search against index', {
      totalItems: this.searchIndex.length,
      searchType: isTagSearch ? 'tag' : 'fulltext',
      tagTermCount: tagTerms.length,
      textTermCount: textTerms.length
    });
    
    // Process each item in the search index
    const results = this.searchIndex
      .map(item => {
        const titleLower = item.title.toLowerCase();
        const pathLower = item.path.toLowerCase();
        const previewLower = item.preview.toLowerCase();
        const contentLower = item.content?.toLowerCase() || '';
        const itemTags = new Set(item.tags?.map(t => getTagValue(t).toLowerCase()) || []);
        
        // If no search terms, include all items
        if (tagTerms.length === 0 && textTerms.length === 0) {
          return {
            ...item,
            score: 0,
            preview: item.preview,
            matches: []
          };
        }
        
        // Track which terms are found and their individual scores
        const tagScores = tagTerms.map(term => {
          let termScore = 0;
          let isFound = false;
          
          // For tag search, only check against tags
          const normalizedTerm = term.trim().toLowerCase();
          
          // Check for exact match first, then partial match (case insensitive)
          const exactMatch = Array.from(itemTags).some(tag => 
            tag === normalizedTerm
          );
          
          // Only check for partial matches if no exact match found
          const partialMatch = !exactMatch && Array.from(itemTags).some(tag => 
            tag.includes(normalizedTerm)
          );
          
          const inTags = exactMatch || partialMatch;
          
          if (inTags) {
            // Higher score for exact matches
            termScore += exactMatch ? 30 : 15;
            isFound = true;
            LOG.debug(`Found ${exactMatch ? 'exact' : 'partial'} matching tag '${normalizedTerm}' in item ${item.path}`);
          }
          
          return { score: termScore, isFound };
        });
        
        // Check text terms in content
        const textTermScores = textTerms.map(term => {
          let termScore = 0;
          let isFound = false;
          
          const inTitle = titleLower.includes(term);
          const inPath = pathLower.includes(term);
          const inPreview = previewLower.includes(term);
          const inContent = contentLower.includes(term);
          
          isFound = inTitle || inPath || inPreview || inContent;
          
          if (isFound) {
            // Exact match in title (highest priority)
            if (titleLower === term) termScore += 100;
            
            // Term appears in title
            if (inTitle) termScore += 10;
            
            // Term appears in path
            if (inPath) termScore += 5;
            
            // Term appears in preview
            if (inPreview) termScore += 3;
            
            // Term appears in content
            if (inContent) {
              termScore += 1;
              // Additional points for multiple occurrences in content
              const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
              termScore += Math.min(occurrences, 5);
            }
          }
          
          return { score: termScore, isFound };
        });
        
        // Combine tag and text term scores
        const allTermScores = [...tagScores, ...textTermScores];
        const allTerms = [...tagTerms, ...textTerms];
        
        // Check if all required terms were found
        const allTermsFound = allTermScores.every(term => term.isFound);
        
        // Calculate total score (sum of all term scores)
        const totalScore = allTermScores.reduce((sum, term) => sum + (term.score || 0), 0);
        
        // Log the results of the term matching for debugging
        LOG.debug(`Item ${item.path} - All terms found: ${allTermsFound}`, {
          title: item.title,
          path: item.path,
          totalTerms: allTerms.length,
          foundTerms: allTermScores.filter(t => t.isFound).length,
          termScores: allTermScores.map((t, i) => ({
            term: allTerms[i],
            isFound: t.isFound,
            score: t.score,
            // Add more details about why a term wasn't found
            details: !t.isFound ? {
              hasTags: !!item.tags && item.tags.length > 0,
              itemTags: item.tags || [],
              normalizedItemTags: item.tags ? item.tags.map(t => t.trim().toLowerCase()) : [],
              searchTerm: allTerms[i].toLowerCase(),
              // Check if the term exists in any tags at all (even if not in this item)
              termExistsInIndex: this.searchIndex.some(si => 
                si.tags?.some(tag => 
                  getTagValue(tag).toLowerCase().includes(allTerms[i].toLowerCase())
                )
              )
            } : undefined
          })),
          hasTags: !!item.tags && item.tags.length > 0,
          itemTags: item.tags || [],
          // Show a sample of items that do have all the terms (for debugging)
          sampleMatchingItems: this.searchIndex
            .filter(si => {
              // Check if item has all required tags
              const hasAllTags = tagTerms.length === 0 || tagTerms.every(term => 
                si.tags?.some(tag => 
                  getTagValue(tag).toLowerCase().includes(term.toLowerCase())
                )
              );
              
              // Check if item contains all text terms
              const hasAllTextTerms = textTerms.length === 0 || 
                (si.content && textTerms.every(term => 
                  si.content!.toLowerCase().includes(term.toLowerCase())
                ));
              
              return hasAllTags && hasAllTextTerms;
            })
            .slice(0, 3)
            .map(si => ({
              path: si.path,
              title: si.title,
              tags: si.tags
            }))
        });

        // Skip items that don't match all required terms
        if (!allTermsFound) {
          LOG.debug('Excluding item', {
            path: item.path,
            reason: 'Missing terms'
          });
          return null;
        }
        
        // Log the final score for the item
        LOG.debug(`Item ${item.path} - Total score: ${totalScore}`, {
          title: item.title,
          path: item.path,
          tags: item.tags,
          termScores: allTermScores.map((t, i) => ({
            term: allTerms[i],
            score: t.score,
            isFound: t.isFound
          }))
        });
        
        // Generate preview with highlighted terms
        let preview = item.preview;
        
        if (tagTerms.length > 0 && item.tags) {
          // For tag searches, show the tags in the preview
          const tagValues = item.tags.map(tag => getTagValue(tag));
          preview = `Tags: ${tagValues.join(', ')}`;
        } else if (item.content) {
          const contentLower = item.content.toLowerCase();
          // For regular searches, show content preview with highlighted terms
          const firstMatch = allTerms
            .map((term: string) => ({
              term,
              index: contentLower.indexOf(term)
            }))
            .filter((match: { index: number }) => match.index >= 0)
            .sort((a: { index: number }, b: { index: number }) => a.index - b.index)[0];
          
          if (firstMatch) {
            const start = Math.max(0, firstMatch.index - 50);
            const end = Math.min(contentLower.length, firstMatch.index + firstMatch.term.length + 100);
            let snippet = item.content.substring(start, end);
            
            // Add ellipsis if we're not at the start/end
            if (start > 0) snippet = `...${snippet}`;
            if (end < item.content.length) snippet = `${snippet}...`;
            
            // Highlight search terms in the snippet
            [...tagTerms, ...textTerms].forEach(term => {
              const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
              snippet = snippet.replace(regex, '<mark>$1</mark>');
            });
            
            preview = snippet;
          }
        }
        
        return {
          ...item,
          score: totalScore,
          preview: preview,
          matches: [...tagTerms, ...textTerms].map(term => ({
            line: 0, // Line numbers not available without parsing
            content: term,
            isTag: tagTerms.includes(term),
            highlighted: `<mark>${term}${tagTerms.includes(term) ? ' (tag)' : ''}</mark>`
          }))
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (item === null) return false;
        
        // Log filtered items for debugging
        LOG.debug('Including item in results', {
          path: item.path,
          title: item.title,
          score: item.score,
          tags: item.tags,
          hasContent: !!item.content
        });
        
        return true;
      })
      .sort((a, b) => {
        // Sort by score (descending)
        if (a.score !== b.score) return b.score - a.score;
        
        // For tag searches, prioritize items with more matching tags
        if (isTagSearch) {
          const aTagCount = a.tags?.length || 0;
          const bTagCount = b.tags?.length || 0;
          if (aTagCount !== bTagCount) return bTagCount - aTagCount;
        }
        
        // Then prefer shorter paths (more specific matches)
        if (a.path.length !== b.path.length) return a.path.length - b.path.length;
        
        // Finally, sort alphabetically by title
        return a.title.localeCompare(b.title);
      }) as SearchResult[];
    
    // Log all results before limiting
    LOG.debug('All matching items', {
      query,
      matchCount: results.length,
      sample: results.slice(0, 3).map(r => r.path)
    });
    
    // Limit results
    const maxResults = environment.search?.maxResults || 50;
    const limitedResults = results.slice(0, maxResults);
    
    LOG.debug('Returning results', {
      query,
      resultCount: limitedResults.length,
      topScores: limitedResults.slice(0, 3).map(r => r.score)
    });
    
    this.isLoading.next(false);
    this.searchResults.next(limitedResults);
    
    return of(limitedResults as SearchResult[]);
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
      LOG.error('Error clearing recent searches', error);
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
        LOG.error('Error ensuring index is ready', error);
        return throwError(() => new Error('Failed to initialize search index'));
      })
    );
  }

  /**
   * Clean markdown content for search indexing
   * Removes markdown syntax while preserving text content
   * @param markdown Markdown content to clean
   * @returns Cleaned text content
   */
  private cleanMarkdownForSearch(markdown: string): string {
    if (!markdown) return '';
    
    // Remove code blocks (```code```)
    let cleaned = markdown.replace(/```[\s\S]*?```/g, '');
    
    // Remove inline code (`code`)
    cleaned = cleaned.replace(/`[^`]+`/g, '');
    
    // Remove headers (#, ##, etc.)
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    
    // Remove emphasis (*, **, _)
    cleaned = cleaned.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
    
    // Remove images and links
    cleaned = cleaned.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
    
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    
    // Remove extra whitespace and normalize
    return cleaned
      .replace(/\s+/g, ' ')
      .trim();
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
