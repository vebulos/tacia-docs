import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, timer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { SearchService } from './search.service';
import { environment } from '../../../../environments/environment';

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
    
    console.log('[SearchIndex] Configuration loaded:', this.config);
    
    if (this.config.enabled) {
      this.initializeIndexing();
    }
  }

  private initializeIndexing(): void {
    console.log('[SearchIndex] Initializing index service');
    
    if (this.config.indexOnStartup) {
      // First indexing after initial delay
      timer(this.config.initialDelay).subscribe(() => {
        console.log('[SearchIndex] Starting initial indexing');
        this.triggerIndexing();
      });
    }

    // Schedule periodic indexing
    this.indexSubscription = interval(this.config.interval)
      .pipe(
        tap(() => console.log('[SearchIndex] Starting scheduled indexing')),
        switchMap(() => this.triggerIndexing())
      )
      .subscribe({
        next: () => console.log('[SearchIndex] Scheduled indexing completed'),
        error: err => console.error('[SearchIndex] Error during scheduled indexing:', err)
      });
  }

  // Manually trigger indexing
  async triggerIndexing(): Promise<void> {
    console.log('[SearchIndex] Manual indexing triggered');
    try {
      await this.searchService.rebuildIndex();
      this.lastIndexTime = new Date();
      console.log('[SearchIndex] Indexing completed successfully');
    } catch (error) {
      console.error('[SearchIndex] Error during indexing:', error);
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
