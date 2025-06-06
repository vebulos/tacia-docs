import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarkdownService, MarkdownFile } from '../../../../core/services/markdown.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="prose dark:prose-invert max-w-none">
      <div [innerHTML]="content"></div>
    </div>
    
    <!-- Table of Contents -->
    <div class="hidden lg:block fixed right-8 top-24 w-64">
      <div class="sticky top-6">
        <h3 class="text-sm font-medium text-gray-900 dark:text-white uppercase tracking-wider mb-4">
          On this page
        </h3>
        <nav class="space-y-2">
          <a 
            *ngFor="let heading of headings" 
            [href]="'#' + heading.id"
            class="block text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            [class.pl-2]="heading.level > 2"
            [class.pl-4]="heading.level > 3"
            [class.pl-6]="heading.level > 4"
          >
            {{ heading.text }}
          </a>
        </nav>
      </div>
    </div>
  `,
  styles: []
})
export class DocumentComponent implements OnInit, OnDestroy {
  content: string = '';
  headings: { text: string; level: number; id: string }[] = [];
  private routeSub!: Subscription;
  private docSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private markdownService: MarkdownService
  ) {}

  ngOnInit() {
    // Check if we're in a testing environment without proper route setup
    if (!this.route) {
      console.warn('ActivatedRoute not provided, using default document');
      this.loadDocument('welcome');
      return;
    }
    
    this.route.paramMap.subscribe(params => {
      const path = params.get('path') || '';
      this.loadDocument(path);
    });
  }

  ngOnDestroy() {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.docSub) this.docSub.unsubscribe();
  }

  private loadDocument(path: string) {
    this.docSub = this.markdownService.getMarkdownFile(path).subscribe({
      next: (doc) => {
        this.content = doc.html;
        this.headings = doc.headings;
      },
      error: (error) => {
        console.error('Error loading document:', error);
        // Redirect to 404 or home if document not found
        this.router.navigate(['/']);
      }
    });
  }
}
