import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private refreshRequested = new Subject<void>();
  
  /**
   * Observable émis lorsqu'un rafraîchissement est demandé
   */
  refreshRequested$ = this.refreshRequested.asObservable();
  
  /**
   * Demande un rafraîchissement de l'application
   */
  requestRefresh(): void {
    this.refreshRequested.next();
  }
}
