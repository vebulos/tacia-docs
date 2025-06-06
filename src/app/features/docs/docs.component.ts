import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { NavigationComponent } from '../documents/components/navigation/navigation.component';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, NavigationComponent],
  template: `
    <div class="flex h-screen w-full bg-white dark:bg-gray-900 overflow-hidden">
      <!-- Sidebar -->
      <div class="w-72 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto flex-shrink-0">
        <div class="p-4">
          <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Documentation</h2>
          
          <!-- Search -->
          <div class="mb-4">
            <div class="relative">
              <input
                type="text"
                placeholder="Search docs..."
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <!-- Navigation Component -->
          <app-navigation></app-navigation>
        </div>
      </div>
      
      <!-- Main content -->
      <div class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div class="max-w-5xl mx-auto px-6 py-8 w-full">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class DocsComponent {
}
