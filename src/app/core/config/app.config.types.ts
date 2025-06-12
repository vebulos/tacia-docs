/**
 * Types pour la configuration de l'application
 */

// Configuration de l'environnement
export interface EnvironmentConfig {
  production: boolean;
  apiUrl: string;
}

// Configuration de l'index de recherche
export interface SearchIndexConfig {
  enabled: boolean;
  interval: number; // en millisecondes
  initialDelay: number;
  indexOnStartup: boolean;
}

// Configuration de la recherche
export interface SearchConfig {
  initialResultsLimit: number;
  maxResults: number;
  maxRecentSearches: number;
  debounceTime: number;
  contentBasePath: string;
  contextLines: number;
  index: SearchIndexConfig;
}

// Configuration complète de l'application
export interface AppConfig {
  version: string;
  environment: EnvironmentConfig;
  search: SearchConfig;
}
