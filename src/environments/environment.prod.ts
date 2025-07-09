import { EnvironmentConfig, defaultConfig } from './environment.types';

/**
 * Production environment configuration
 */
export const environment: EnvironmentConfig = {
  production: true,
  // apiUrl: 'https://votre-api-production.com/api',
  apiUrl: '/api',
  search: {
    maxResults: 50,
    maxRecentSearches: 10,
    debounceTime: 300,
    // Content is now managed by the backend API
    contentBasePath: '',
    contextLines: 1,
    index: {
      enabled: true,
      interval: 300000, // 5 minutes
      initialDelay: 10000, // 10 seconds
      indexOnStartup: true
    }
  },
  content: {
    ...defaultConfig.content,
    // Content is now managed by the backend API
    basePath: '',
    cacheTtl: 5 * 60 * 1000, // 5 minutes
    hoverDelay: 300,
    maxRetries: 3,
    retryDelay: 1000
  }
};
