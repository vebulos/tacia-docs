// Types de configuration
export interface EnvironmentConfig {
  production: boolean;
  apiUrl: string;
}

export interface SearchIndexConfig {
  enabled: boolean;
  interval: number;
  initialDelay: number;
  indexOnStartup: boolean;
}

export interface SearchConfig {
  initialResultsLimit: number;
  maxResults: number;
  maxRecentSearches: number;
  debounceTime: number;
  contentBasePath: string;
  contextLines: number;
  index: SearchIndexConfig;
}

export interface AppConfig {
  version: string;
  environment: EnvironmentConfig;
  search: SearchConfig;
}

/**
 * Configuration de l'application
 */

// Configuration par défaut
export const defaultConfig: Omit<AppConfig, 'environment'> = {
  version: '1.0.0',
  search: {
    initialResultsLimit: 10,
    maxResults: 20,
    maxRecentSearches: 5,
    debounceTime: 300,
    contentBasePath: '/assets/content',
    contextLines: 1,
    index: {
      enabled: true,
      interval: 60 * 60 * 1000, // 1 heure
      initialDelay: 5000, // 5 secondes
      indexOnStartup: true
    }
  }
};
