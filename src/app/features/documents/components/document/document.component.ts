import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MarkdownService } from '@app/core/services/markdown.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NavigationComponent } from '../navigation/navigation.component';

@Component({
  selector: 'app-document',
  template: `
    <div class="document-container" *ngIf="content">
      <div class="markdown-content" [innerHTML]="content"></div>
    </div>
    <div *ngIf="error" class="error-message">
      <p>Failed to load document. Please try again later.</p>
      <button (click)="goHome()">Go to Home</button>
    </div>
    <div *ngIf="!content && !error" class="loading">
      Loading document...
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
      @apply text-3xl font-bold text-gray-900 mb-6 pt-4;
    }
    
    .markdown-content h2 {
      @apply text-2xl font-semibold text-gray-800 mt-8 mb-4 pt-4 border-t border-gray-100;
    }
    
    .markdown-content h3 {
      @apply text-xl font-semibold text-gray-700 mt-6 mb-3;
    }
    
    .markdown-content p {
      @apply text-gray-700 mb-4 leading-relaxed;
    }
    
    .markdown-content pre {
      @apply bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto my-6 text-sm;
    }
    
    .markdown-content code {
      @apply bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono;
    }
    
    .markdown-content pre code {
      @apply bg-transparent text-current p-0;
    }
    
    .markdown-content a {
      @apply text-blue-600 hover:text-blue-800 hover:underline;
    }
    
    .markdown-content ul, .markdown-content ol {
      @apply my-4 pl-6;
    }
    
    .markdown-content ul {
      @apply list-disc;
    }
    
    .markdown-content ol {
      @apply list-decimal;
    }
    
    .markdown-content li {
      @apply mb-2;
    }
    
    .markdown-content blockquote {
      @apply border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4;
    }
    
    .markdown-content table {
      @apply min-w-full divide-y divide-gray-300 my-6;
    }
    
    .markdown-content th {
      @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
    }
    
    .markdown-content td {
      @apply px-6 py-4 whitespace-nowrap text-sm text-gray-700;
    }
    
    .markdown-content tr:nth-child(even) {
      @apply bg-gray-50;
    }
  `]
})
export class DocumentComponent implements OnInit, OnDestroy {
  content: string | null = null;
  error = false;
  private docSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private markdownService: MarkdownService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const path = params.get('path') || '';
      this.loadDocument(path);
    });
  }

  private loadDocument(path: string) {
    this.content = null;
    this.error = false;
    
    this.docSub = this.markdownService.getMarkdownFile(path).subscribe({
      next: (doc) => {
        this.content = doc.html;
      },
      error: (error) => {
        console.error('Error loading document:', error);
        this.error = true;
      }
    });
  }

  goHome() {
    this.router.navigate(['/']);
  }

  ngOnDestroy() {
    if (this.docSub) {
      this.docSub.unsubscribe();
    }
  }
}
