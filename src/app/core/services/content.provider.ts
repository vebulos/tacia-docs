import { Provider } from '@angular/core';
import { IContentService } from './content.interface';
import { ContentService } from './content.service';
import { ApiContentService } from './api-content.service';

// Définir quelle implémentation utiliser (à changer selon l'environnement)
const USE_API = false;

export const CONTENT_SERVICE_PROVIDER: Provider = {
  provide: 'IContentService',
  useClass: USE_API ? ApiContentService : ContentService
};

// Export pratique pour l'injection
export type { IContentService };
