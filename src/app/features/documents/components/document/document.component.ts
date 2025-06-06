import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarkdownService, MarkdownFile } from '@app/core/services/markdown.service';
import { Subscription, catchError, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-document',
  template: `
    <div class="w-full h-full">
      <!-- Loading state -->
      <div *ngIf="loading" class="flex justify-center items-center h-64 w-full">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p class="mt-4 text-gray-600 dark:text-gray-400">Loading document...</p>
        </div>
      </div>

      <!-- Error state -->
      <div *ngIf="error && !loading" class="w-full bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-600 p-4 rounded">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-red-700 dark:text-red-300">
              {{ error }}
              <button (click)="goHome()" class="ml-2 text-sm font-medium text-red-700 dark:text-red-300 underline hover:text-red-600 dark:hover:text-red-400">
                Go to Home
              </button>
            </p>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div *ngIf="content && !loading && !error" class="w-full h-full">
        <div class="w-full h-full px-8 py-8">
          <div class="prose dark:prose-invert w-full max-w-none" [innerHTML]="content"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    
    .markdown-content {
      line-height: 1.8;
    }
    
    .markdown-content h1 {
      font-size: 2.25rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .dark .markdown-content h1 {
      color: #f9fafb;
      border-bottom-color: #374151;
    }
    
    .markdown-content h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      padding-top: 1rem;
    }
    
    .dark .markdown-content h2 {
      color: #e5e7eb;
    }
    
    .markdown-content h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #374151;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
    }
    
    .dark .markdown-content h3 {
      color: #d1d5db;
    }
    
    .markdown-content p {
      color: #4b5563;
      margin-bottom: 1.25rem;
      line-height: 1.75;
    }
    
    .dark .markdown-content p {
      color: #e5e7eb;
    }
    
    .markdown-content pre {
      background-color: #1f2937;
      color: #f3f4f6;
      padding: 1rem;
      border-radius: 0.375rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    
    .markdown-content code:not(pre code) {
      background-color: #f3f4f6;
      color: #1f2937;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    
    .dark .markdown-content code:not(pre code) {
      background-color: #374151;
      color: #f3f4f6;
    }
    
    .markdown-content pre code {
      background-color: transparent;
      color: currentColor;
      padding: 0;
    }
    
    .markdown-content a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }
    
    .markdown-content a:hover {
      color: #2563eb;
      text-decoration: underline;
    }
    
    .markdown-content ul,
    .markdown-content ol {
      margin: 1.25rem 0;
      padding-left: 1.5rem;
    }
    
    .markdown-content li {
      margin-bottom: 0.5rem;
      color: #4b5563;
    }
    
    .dark .markdown-content li {
      color: #e5e7eb;
    }
    
    .markdown-content blockquote {
      border-left: 4px solid #e5e7eb;
      padding-left: 1rem;
      margin: 1.5rem 0;
      color: #6b7280;
      font-style: italic;
    }
    
    .dark .markdown-content blockquote {
      border-left-color: #4b5563;
      color: #9ca3af;
    }
    
    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.875rem;
    }
    
    .markdown-content th,
    .markdown-content td {
      border: 1px solid #e5e7eb;
      padding: 0.75rem 1rem;
      text-align: left;
    }
    
    .dark .markdown-content th,
    .dark .markdown-content td {
      border-color: #4b5563;
    }
    
    .markdown-content th {
      background-color: #f9fafb;
      font-weight: 600;
    }
    
    .dark .markdown-content th {
      background-color: #1f2937;
    }
    
    .markdown-content img {
      border-radius: 0.375rem;
    }
  `]
})
export class DocumentComponent implements OnInit, OnDestroy {
  content: string | null = null;
  loading = true;
  error: string | null = null;
  private subscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private markdownService: MarkdownService
  ) {}

  ngOnInit(): void {
    this.subscription = this.route.paramMap.pipe(
      switchMap(params => {
        let path = params.get('path');
        this.loading = true;
        this.error = null;
        
        if (!path) {
          this.error = 'No document path provided';
          this.loading = false;
          return of<MarkdownFile | null>(null);
        }
        
        // Ensure path has .md extension if it's a file
        if (!path.endsWith('.md') && !path.endsWith('/')) {
          path = `${path}.md`;
        }
        
        return this.markdownService.getMarkdownFile(path).pipe(
          catchError(error => {
            console.error('Error loading markdown:', error);
            this.error = 'Failed to load document. Please try again later.';
            this.loading = false;
            return of<MarkdownFile | null>(null);
          })
        );
      })
    ).subscribe({
      next: (file) => {
        if (file) {
          this.content = file.html;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error in subscription:', error);
        this.error = 'An unexpected error occurred. Please try again later.';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
