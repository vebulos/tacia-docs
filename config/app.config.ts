import { EnvironmentConfig } from './environment.config';

export interface SearchIndexConfig {
  enabled: boolean;
  interval: number; // en millisecondes
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
  // Ajoutez d'autres configurations au besoin
}

// Configuration par défaut qui peut être surchargée
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
