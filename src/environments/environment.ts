import { EnvironmentConfig } from '../app/core/config/app.config';

/**
 * Development environment configuration
 */
export const environment: EnvironmentConfig = {
  production: false,
  apiUrl: 'http://localhost:4200/api',
  search: {
    maxResults: 50,
    maxRecentSearches: 10,
    debounceTime: 300,
    contentBasePath: '/assets/content',
    contextLines: 1,
    index: {
      enabled: true,
      interval: 300000, // 5 minutes
      initialDelay: 10000, // 10 seconds
      indexOnStartup: true
    }
  }
};
