import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { NavigationComponent } from '../documents/components/navigation/navigation.component';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, NavigationComponent],
  template: `
    <div class="relative min-h-screen w-full bg-white dark:bg-gray-900">
      <!-- Left Sidebar -->
      <div class="fixed left-0 top-0 h-screen w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto z-10">
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
      
      <!-- Main content wrapper -->
      <div class="flex">
        <!-- Main content -->
        <div class="flex-1 min-w-0 bg-gray-50 dark:bg-gray-900">
          <div class="w-full min-h-screen">
            <div class="w-full h-full">
              <router-outlet></router-outlet>
            </div>
          </div>
        </div> 
      </div>
      
      <!-- Right Sidebar -->
      <div class="fixed right-0 top-0 h-screen w-80 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
        <div class="p-6">
          <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">On this page</h3>
          <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <!-- Table of contents will be populated here -->
            <div class="animate-pulse space-y-2">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 ml-4"></div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 ml-4"></div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
          
          <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Related</h3>
            <div class="space-y-3">
              <a href="#" class="block text-sm text-blue-600 dark:text-blue-400 hover:underline">Getting Started</a>
              <a href="#" class="block text-sm text-blue-600 dark:text-blue-400 hover:underline">API Reference</a>
              <a href="#" class="block text-sm text-blue-600 dark:text-blue-400 hover:underline">Guides</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class DocsComponent {
}
