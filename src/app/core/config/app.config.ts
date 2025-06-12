import { InjectionToken } from '@angular/core';

// Configuration types
export interface ContentConfig {
  // Cache TTL in milliseconds (5 minutes)
  cacheTtl: number;
  // Delay before loading on hover (ms)
  hoverDelay: number;
  // Maximum number of retry attempts
  maxRetries: number;
  // Delay between retries (ms)
  retryDelay: number;
}

export interface SearchIndexConfig {
  enabled: boolean;
  interval: number;
  initialDelay: number;
  indexOnStartup: boolean;
}

export interface SearchConfig {
  maxResults: number;
  maxRecentSearches: number;
  debounceTime?: number;
  contentBasePath?: string;
  contextLines?: number;
  index?: SearchIndexConfig;
}

export interface EnvironmentConfig {
  production: boolean;
  apiUrl: string;
  search?: Partial<SearchConfig>;
  content?: Partial<ContentConfig>;
}

export interface AppConfig extends EnvironmentConfig {
  version: string;
  search: SearchConfig;
  content: ContentConfig;
}

/**
 * Injection token for app configuration
 */
export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

/**
 * Provides the application configuration
 * @param env Environment configuration
 * @returns Configuration provider
 */
export function provideAppConfig(env: EnvironmentConfig) {
  return {
    provide: APP_CONFIG,
    useValue: {
      ...defaultConfig,
      environment: env,
      content: {
        ...defaultConfig.content,
        ...env.content
      },
      search: {
        ...defaultConfig.search,
        ...env.search
      }
    }
  };
}

/**
 * Configuration de l'application
 */

// Default configuration
export const defaultConfig: AppConfig = {
  version: '1.0.0',
  production: false,
  apiUrl: 'http://localhost:4200/api',
  content: {
    cacheTtl: 5 * 60 * 1000, // 5 minutes
    hoverDelay: 300,
    maxRetries: 3,
    retryDelay: 1000
  },
  search: {
    maxResults: 20,
    maxRecentSearches: 5,
    debounceTime: 300,
    contentBasePath: '/assets/content',
    contextLines: 1,
    index: {
      enabled: true,
      interval: 60 * 60 * 1000, // 1 hour
      initialDelay: 5000, // 5 seconds
      indexOnStartup: true
    }
  }
};
