import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  private idCounter = 0;

  notifications$: Observable<Notification[]> = this.notifications.asObservable();

  show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 3000): void {
    const id = this.idCounter++;
    const notification: Notification = { id, message, type, duration };
    
    // Add the new notification
    this.notifications.next([...this.notifications.value, notification]);
    
    // Auto-remove the notification after duration if specified
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, duration: number = 3000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration: number = 5000): void {
    this.show(message, 'error', duration);
  }

  info(message: string, duration: number = 3000): void {
    this.show(message, 'info', duration);
  }

  warning(message: string, duration: number = 4000): void {
    this.show(message, 'warning', duration);
  }

  dismiss(id: number): void {
    this.notifications.next(this.notifications.value.filter(n => n.id !== id));
  }

  clearAll(): void {
    this.notifications.next([]);
  }
}
