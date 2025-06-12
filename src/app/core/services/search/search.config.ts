/**
 * Configuration for the search service
 */
export const SEARCH_CONFIG = {
  // Maximum number of search results to return
  maxResults: 20,
  
  // Maximum number of recent searches to store
  maxRecentSearches: 10,
  
  // Base path for content
  contentBasePath: '/assets/content',
  
  // Number of context lines to show around matches
  contextLines: 1,
  
  // Search index configuration
  index: {
    // Whether to enable the search index
    enabled: true,
    
    // How often to rebuild the index (in milliseconds)
    interval: 60 * 60 * 1000, // 1 hour
    
    // Initial delay before building the index (in milliseconds)
    initialDelay: 5000, // 5 seconds
    
    // Whether to build the index on startup
    indexOnStartup: true
  }
} as const;
