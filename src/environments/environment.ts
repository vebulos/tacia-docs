import { EnvironmentConfig, defaultConfig } from './environment.types';

/**
 * Development environment configuration
 */
export const environment: EnvironmentConfig = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
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
    basePath: ''
  }
};
