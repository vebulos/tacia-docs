import { EnvironmentConfig, defaultConfig } from './environment.types';

/**
 * Development environment configuration
 */
export const environment: EnvironmentConfig = {
  production: false,
  apiUrl: '/api',
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
  },
  content: {
    ...defaultConfig.content,
    basePath: '/assets/content'
  },
  docs: {
    basePath: '/docs',
    defaultPath: 'getting-started/introduction'
  }
};
