export const SEARCH_CONFIG = {
  // Number of results to show initially
  initialResultsLimit: 10,
  // Maximum number of search results to return
  maxResults: 20,
  // Maximum number of recent searches to store
  maxRecentSearches: 5,
  // Debounce time for search input in milliseconds
  debounceTime: 300,
  // Base path for content files
  contentBasePath: '/assets/content',
  // Number of context lines to show around matches
  contextLines: 1
} as const;
