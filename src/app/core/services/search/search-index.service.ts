import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subscription, timer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { SearchService } from './search.service';
import { environment } from '../../../../environments/environment';
import { LOG } from '../logging/bun-logger.service';

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
    
    LOG.info('Search index configuration loaded', { 
      ...this.config,
      // Don't log the full config object as it may contain sensitive info
      intervalMinutes: Math.floor(this.config.interval / 60000) 
    });
    
    if (this.config.enabled) {
      this.initializeIndexing();
    } else {
      LOG.warn('Search indexing is disabled in configuration');
    }
  }

  private initializeIndexing(): void {
    LOG.debug('Initializing search index service', { 
      indexOnStartup: this.config.indexOnStartup,
      initialDelay: this.config.initialDelay,
      interval: this.config.interval
    });
    
    if (this.config.indexOnStartup) {
      // First indexing after initial delay
      timer(this.config.initialDelay).subscribe(() => {
        LOG.info('Starting initial search index build', { 
          delay: this.config.initialDelay 
        });
        this.triggerIndexing();
      });
    }

    // Schedule periodic indexing
    this.indexSubscription = interval(this.config.interval)
      .pipe(
        tap(() => LOG.debug('Starting scheduled search index update')),
        switchMap(() => this.triggerIndexing())
      )
      .subscribe({
        next: () => LOG.debug('Scheduled search index update completed'),
        error: (error: any) => {
          const errorMessage = error?.message || 'Unknown error';
          const errorStack = error?.stack;
          LOG.error('Error during scheduled search indexing', { 
            error: errorMessage,
            stack: errorStack
          });
        }
      });
  }

  // Manually trigger indexing
  async triggerIndexing(): Promise<void> {
    const startTime = Date.now();
    LOG.debug('Manual search index rebuild triggered');
    
    try {
      await this.searchService.rebuildIndex();
      this.lastIndexTime = new Date();
      const duration = Date.now() - startTime;
      
      LOG.info('Search index rebuild completed successfully', {
        durationMs: duration,
        lastIndexTime: this.lastIndexTime.toISOString()
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack;
      
      LOG.error('Error during search index rebuild', { 
        error: errorMessage,
        durationMs: duration,
        stack: errorStack
      });
      throw error;
    }
  }

  getLastIndexTime(): Date | null {
    return this.lastIndexTime;
  }

  ngOnDestroy(): void {
    if (this.indexSubscription) {
      LOG.debug('Cleaning up search index subscription');
      this.indexSubscription.unsubscribe();
    }
  }
}
