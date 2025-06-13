import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, timer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { SearchService } from './search.service';
import { environment } from '../../../environments/environment';

interface SearchIndexConfig {
  enabled: boolean;
  interval: number;
  initialDelay: number;
  indexOnStartup: boolean;
}

const DEFAULT_INDEX_CONFIG: SearchIndexConfig = {
  enabled: true,
  interval: 300000, // 5 minutes
  initialDelay: 10000, // 10 seconds
  indexOnStartup: true
};

@Injectable({
  providedIn: 'root'
})
export class SearchIndexService implements OnDestroy {
  private indexSubscription?: Subscription;
  private lastIndexTime: Date | null = null;
  private readonly config: SearchIndexConfig;

  constructor(private searchService: SearchService) {
    this.config = environment?.search?.index ? {
      enabled: environment.search.index.enabled ?? DEFAULT_INDEX_CONFIG.enabled,
      interval: environment.search.index.interval ?? DEFAULT_INDEX_CONFIG.interval,
      initialDelay: environment.search.index.initialDelay ?? DEFAULT_INDEX_CONFIG.initialDelay,
      indexOnStartup: environment.search.index.indexOnStartup ?? DEFAULT_INDEX_CONFIG.indexOnStartup
    } : DEFAULT_INDEX_CONFIG;
    
    console.log('[SearchIndex] Configuration chargée:', this.config);
    
    if (this.config.enabled) {
      this.initializeIndexing();
    }
  }

  private initializeIndexing(): void {
    console.log('[SearchIndex] Initialisation du service d\'indexation');
    
    if (this.config.indexOnStartup) {
      // Première indexation après le délai initial
      timer(this.config.initialDelay).subscribe(() => {
        console.log('[SearchIndex] Démarrage de l\'indexation initiale');
        this.triggerIndexing();
      });
    }

    // Planifier les indexations périodiques
    this.indexSubscription = interval(this.config.interval)
      .pipe(
        tap(() => console.log('[SearchIndex] Début de l\'indexation planifiée')),
        switchMap(() => this.triggerIndexing())
      )
      .subscribe({
        next: () => console.log('[SearchIndex] Indexation planifiée terminée'),
        error: err => console.error('[SearchIndex] Erreur lors de l\'indexation planifiée:', err)
      });
  }

  // Déclencher manuellement une indexation
  async triggerIndexing(): Promise<void> {
    console.log('[SearchIndex] Déclenchement manuel de l\'indexation');
    try {
      await this.searchService.rebuildIndex();
      this.lastIndexTime = new Date();
      console.log('[SearchIndex] Indexation terminée avec succès');
    } catch (error) {
      console.error('[SearchIndex] Erreur lors de l\'indexation:', error);
      throw error;
    }
  }

  getLastIndexTime(): Date | null {
    return this.lastIndexTime;
  }

  ngOnDestroy(): void {
    if (this.indexSubscription) {
      this.indexSubscription.unsubscribe();
    }
  }
}
