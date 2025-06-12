import { InjectionToken } from '@angular/core';
import { AppConfig, defaultConfig } from './app.config';
import { EnvironmentConfig } from './app.config';

/**
 * Token d'injection pour la configuration de l'application
 */
export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

/**
 * Fournit la configuration de l'application
 * @param env Configuration d'environnement
 * @returns Fournisseur de configuration
 */
export function provideAppConfig(env: EnvironmentConfig) {
  return {
    provide: APP_CONFIG,
    useValue: {
      ...defaultConfig,
      environment: env
    } as AppConfig
  };
}
