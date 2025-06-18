import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { FirstDocumentService } from '../first-document.service';

export enum RefreshType {
  NORMAL = 'normal',  // Rafraîchissement standard
  FULL = 'full'       // Rafraîchissement complet (y compris le cache du navigateur)
}

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private refreshRequested = new Subject<RefreshType>();
  
  /**
   * Observable émis lorsqu'un rafraîchissement est demandé
   */
  refreshRequested$ = this.refreshRequested.asObservable();
  
  constructor(private firstDocumentService: FirstDocumentService) {}
  
  /**
   * Demande un rafraîchissement standard de l'application
   */
  requestRefresh(): void {
    this.refreshRequested.next(RefreshType.NORMAL);
  }
  
  /**
   * Demande un rafraîchissement complet de l'application
   * Cela inclut le vidage du cache du service FirstDocumentService
   */
  requestFullRefresh(): void {
    console.log('[RefreshService] Requesting full refresh including cache clearing');
    // Vider le cache du service FirstDocumentService
    this.firstDocumentService.clearCache();
    // Émettre un événement de rafraîchissement complet
    this.refreshRequested.next(RefreshType.FULL);
  }
}
