/**
 * Search configuration
 */
export interface SearchConfig<T> {
  // Properties to search in
  keys: Array<keyof T | { name: keyof T; weight: number }>;
  // Match threshold (0.0 - 1.0)
  threshold?: number;
  // Enable case-sensitive search
  isCaseSensitive?: boolean;
  // Maximum number of results
  limit?: number;
  // Enable fuzzy search
  useExtendedSearch?: boolean;
}

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
  
  /** Array of tags for categorization and filtering */
  tags?: string[];
  
  /** Array of matches with line numbers and highlighted content */
  matches: Array<{
    line: number;
    content: string;
    isTag: boolean;
    highlighted: string;
  }>;
  
  /** Optional metadata for debugging and additional information */
  metadata?: Record<string, any>;
}
