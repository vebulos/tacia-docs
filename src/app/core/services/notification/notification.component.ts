import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from './notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-50 w-80 space-y-2">
      <div *ngFor="let notification of notifications" 
           [class]="getNotificationClasses(notification)"
           role="alert"
           [attr.aria-live]="notification.type === 'error' ? 'assertive' : 'polite'"
           (click)="dismiss(notification.id)"
           class="p-4 rounded-lg shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-105">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <ng-container [ngSwitch]="notification.type">
              <svg *ngSwitchCase="'success'" class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg *ngSwitchCase="'error'" class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg *ngSwitchCase="'warning'" class="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg *ngSwitchDefault class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </ng-container>
          </div>
          <div class="ml-3 w-0 flex-1 pt-0.5">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ notification.message }}
            </p>
          </div>
          <div class="ml-4 flex-shrink-0 flex">
            <button class="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
              <span class="sr-only">Close</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notification-enter {
      opacity: 0;
      transform: translateX(100%);
    }
    .notification-enter-active {
      opacity: 1;
      transform: translateX(0);
      transition: opacity 300ms, transform 300ms;
    }
    .notification-exit {
      opacity: 1;
      transform: translateX(0);
    }
    .notification-exit-active {
      opacity: 0;
      transform: translateX(100%);
      transition: opacity 300ms, transform 300ms;
    }
  `]
})
export class NotificationComponent implements OnDestroy {
  notifications: Notification[] = [];
  private subscription: Subscription;

  constructor(private notificationService: NotificationService) {
    this.subscription = this.notificationService.notifications$.subscribe(
      notifications => this.notifications = notifications
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }

  getNotificationClasses(notification: Notification): string {
    const baseClasses = 'rounded-md p-4 transition-all duration-300';
    const typeClasses = {
      success: 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      error: 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200',
      warning: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      info: 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
    };
    
    return `${baseClasses} ${typeClasses[notification.type] || typeClasses.info}`;
  }
}
