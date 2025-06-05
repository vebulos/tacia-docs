import { Component } from '@angular/core';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [RouterModule, RouterLink, RouterLinkActive],
  template: `
    <div class="flex flex-col md:flex-row">
      <!-- Sidebar -->
      <div class="w-full md:w-64 lg:w-80 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="p-4">
          <h2 class="text-lg font-semibold mb-4">Documentation</h2>
          <nav class="space-y-2">
            <a routerLink="/docs/introduction" routerLinkActive="text-blue-600 dark:text-blue-400 font-medium" 
               class="block px-2 py-1 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              Introduction
            </a>
            <!-- More navigation items will be added here -->
          </nav>
        </div>
      </div>
      
      <!-- Main content -->
      <div class="flex-1 p-6">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: []
})
export class DocsComponent { }
