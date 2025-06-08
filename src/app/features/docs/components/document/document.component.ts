import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarkdownService, MarkdownFile } from '@app/core/services/markdown.service';
import { Subscription, catchError, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-document',
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.css']
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
