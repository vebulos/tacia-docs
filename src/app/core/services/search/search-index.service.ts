import { Inject, Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, timer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { SearchService } from './search.service';
import { AppConfig, APP_CONFIG } from '../config/app.config';

@Injectable({
  providedIn: 'root'
})
export class SearchIndexService implements OnDestroy {
  private indexSubscription?: Subscription;
  private lastIndexTime: Date | null = null;
  private readonly config: AppConfig['search']['index'];

  constructor(
    private searchService: SearchService,
    @Inject(APP_CONFIG) private appConfig: AppConfig
  ) {
    this.config = appConfig.search.index;
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
