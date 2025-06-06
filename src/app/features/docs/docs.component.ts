import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { ContentService, ContentItem } from '../../core/services/content.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  providers: [ContentService],
  template: `
    <div class="flex flex-col md:flex-row h-screen bg-white dark:bg-gray-900">
      <!-- Sidebar -->
      <div class="w-full md:w-64 lg:w-80 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
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
          
          <!-- Navigation -->
          <nav class="space-y-1">
            <ng-container *ngFor="let category of contentStructure">
              <div class="mb-4">
                <h3 class="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {{ category.name }}
                </h3>
                <div class="mt-2 space-y-1">
                  <a 
                    *ngFor="let item of category.children"
                    [routerLink]="[item.path]"
                    routerLinkActive="bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400"
                    class="group flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white rounded-md"
                  >
                    <span class="truncate">{{ item.metadata?.title || item.name }}</span>
                  </a>
                </div>
              </div>
            </ng-container>
          </nav>
        </div>
      </div>
      
      <!-- Main content -->
      <div class="flex-1 overflow-y-auto">
        <div class="p-6">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class DocsComponent implements OnInit {
  contentStructure: ContentItem[] = [];
  
  constructor(private contentService: ContentService) {}
  
  ngOnInit() {
    this.loadContentStructure();
  }
  
  private loadContentStructure() {
    this.contentService.getContentStructure().subscribe(structure => {
      this.contentStructure = structure;
    });
  }
}
