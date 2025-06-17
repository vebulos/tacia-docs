import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { CommonModule } from '@angular/common';
import { NotificationComponent } from '../services/notification/notification.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    HeaderComponent, 
    FooterComponent,
    NotificationComponent
  ],
  template: `
    <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <app-header></app-header>
      <main class="flex-grow w-full bg-white dark:bg-gray-900">
        <router-outlet></router-outlet>
      </main>
      <app-footer></app-footer>
      <app-notification></app-notification>
    </div>
  `,
  styles: []
})
export class LayoutComponent {}
