import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { FirstDocumentService } from '../first-document.service';
import { LOG } from '../logging/bun-logger.service';

export enum RefreshType {
  NORMAL = 'normal',  // Standard refresh
  FULL = 'full'       // Full refresh (including browser cache)
}

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private refreshRequested = new Subject<RefreshType>();
  
  /**
   * Observable emitted when a refresh is requested
   */
  refreshRequested$ = this.refreshRequested.asObservable();
  
  constructor(private firstDocumentService: FirstDocumentService) {}
  
  /**
   * Requests a standard application refresh
   */
  requestRefresh(): void {
    this.refreshRequested.next(RefreshType.NORMAL);
  }
  
  /**
   * Requests a full application refresh
   * @param directory The directory to clear cache for (optional)
   */
  requestFullRefresh(directory?: string): void {
    LOG.debug('Requesting full refresh including cache clearing', {
      directory: directory || 'root',
      refreshType: 'FULL'
    });
    // Clear the FirstDocumentService cache for the specified directory
    this.firstDocumentService.clearCache(directory);
    // Emit a full refresh event
    this.refreshRequested.next(RefreshType.FULL);
  }
  
  /**
   * Requests a cache refresh for a specific directory
   * @param directory The directory to clear cache for
   */
  refreshDirectory(directory: string): void {
    LOG.debug('Refreshing cache for directory', {
      directory,
      refreshType: 'NORMAL'
    });
    this.firstDocumentService.clearCache(directory);
    this.refreshRequested.next(RefreshType.NORMAL);
  }
}
