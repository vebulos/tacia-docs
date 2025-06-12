import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { CONTENT_SERVICE_PROVIDER } from './core/services/content.provider';
import { SearchService } from './core/services/search/search.service';

// Configuration
// Configuration
import { environment } from './core/config/environments/environment';
import { defaultConfig } from './core/config/app.config';

// Créer un fournisseur pour la configuration de l'application
function provideAppConfig() {
  return [
    { 
      provide: 'APP_CONFIG', 
      useValue: {
        ...defaultConfig,
        environment
      } 
    }
  ];
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    CONTENT_SERVICE_PROVIDER,
    SearchService,
    // Fournir la configuration de l'application
    ...provideAppConfig()
  ]
};
