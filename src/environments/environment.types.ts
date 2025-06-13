export interface EnvironmentConfig {
  production: boolean;
  apiUrl: string;
  search: {
    maxResults: number;
    maxRecentSearches: number;
    debounceTime: number;
    contentBasePath: string;
    contextLines: number;
    index: {
      enabled: boolean;
      interval: number;
      initialDelay: number;
      indexOnStartup: boolean;
    };
  };
  content?: {
    basePath?: string;
    cacheTtl?: number;
    hoverDelay?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  docs?: {
    basePath?: string;
    defaultPath?: string;
  };
}

// Default configuration for optional values
export const defaultConfig: Partial<EnvironmentConfig> = {
  content: {
    cacheTtl: 5 * 60 * 1000, // 5 minutes
    hoverDelay: 300,
    maxRetries: 3,
    retryDelay: 1000
  }
};
