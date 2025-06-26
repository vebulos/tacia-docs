import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ContentService } from './core/services/content.service';
import { SearchService } from './core/services/search/search.service';
import { routes } from './app.routes';
import { httpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([httpLoggingInterceptor]),
      withInterceptorsFromDi()
    ),
    provideAnimations(),
    ContentService,
    SearchService
  ]
};
