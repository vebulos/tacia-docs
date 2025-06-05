import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="min-h-screen flex flex-col">
      <!-- Header will go here -->
      <header class="border-b border-gray-200 dark:border-gray-800">
        <div class="container mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <a routerLink="/" class="text-xl font-semibold">MXC</a>
              <nav class="hidden md:flex space-x-6">
                <a routerLink="/docs" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Docs</a>
                <a href="#" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">API</a>
                <a href="#" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Guides</a>
              </nav>
            </div>
            <div class="flex items-center space-x-4">
              <button class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <span class="sr-only">Search</span>
                <!-- Search icon will go here -->
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <span class="sr-only">Toggle dark mode</span>
                <!-- Moon icon will go here -->
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>
              <a href="#" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </header>

      <!-- Main content -->
      <main class="flex-1">
        <div class="container mx-auto px-4 py-8">
          <router-outlet></router-outlet>
        </div>
      </main>

      <!-- Footer -->
      <footer class="border-t border-gray-200 dark:border-gray-800 py-8">
        <div class="container mx-auto px-4">
          <div class="flex flex-col md:flex-row justify-between items-center">
            <div class="mb-4 md:mb-0">
              <p class="text-gray-600 dark:text-gray-400">© 2025 MXC. All rights reserved.</p>
            </div>
            <div class="flex space-x-6">
              <a href="#" class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">GitHub</a>
              <a href="#" class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Twitter</a>
              <a href="#" class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: []
})
export class LayoutComponent { }
