/**
 * Configuration for content loading and caching
 */
export const contentConfig = {
  // Cache TTL in milliseconds (5 minutes)
  cacheTtl: 5 * 60 * 1000,
  // Delay before loading on hover (ms)
  hoverDelay: 300,
  // Maximum number of retry attempts
  maxRetries: 3,
  // Delay between retries (ms)
  retryDelay: 1000,
};
