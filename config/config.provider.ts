import { InjectionToken } from '@angular/core';
import { AppConfig, defaultConfig } from './app.config';
import { EnvironmentConfig } from './environment.config';

// Token d'injection
export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

// Fonction de fourniture de configuration
export function provideAppConfig(env: EnvironmentConfig) {
  return {
    provide: APP_CONFIG,
    useValue: {
      ...defaultConfig,
      environment: env
    } as AppConfig
  };
}
