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
 * Search result
 */
export interface SearchResult<T> {
  // The matching item
  item: T;
  // Match score (0 = perfect, 1 = no match)
  score?: number;
  // Match details
  matches?: Array<{
    indices: [number, number][];
    key?: string;
    refIndex?: number;
    value?: string;
  }>;
  // Unique identifier of the item (optional)
  id?: string | number;
}
