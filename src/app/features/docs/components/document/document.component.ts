import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, inject, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
  @Output() headingsChange = new EventEmitter<Array<{ text: string; level: number; id: string }>>();
  public headings: Array<{ text: string; level: number; id: string }> = [];
  private _currentPath: string | null = null;
  private subscription: Subscription | null = null;
  
  content: SafeHtml | null = null;
  loading = true;
  error: string | null = null;

  private elementRef = inject(ElementRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private markdownService: MarkdownService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Clean up any existing subscription
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    
    this.subscription = this.route.paramMap.pipe(
      switchMap(params => {
        const path = params.get('path');
        if (!path) {
          this.router.navigate(['/docs/content/getting-started/introduction']);
          return of(null);
        }
        
        // Clear previous headings when path changes
        if (this._currentPath !== path) {
          this.headings = [];
          this._currentPath = path;
        }
        
        return this.markdownService.getMarkdownFile(path).pipe(
          catchError(err => {
            console.error('Error loading markdown:', err);
            this.error = 'Failed to load document. Please try again later.';
            this.loading = false;
            return of(null);
          })
        );
      })
    ).subscribe(file => {
      if (file) {
        // Create a temporary div to manipulate the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = file.html;
        
        // Add IDs to all heading elements
        file.headings.forEach(heading => {
          // Find the heading by its text content
          const headings = Array.from(tempDiv.querySelectorAll(`h${heading.level}`));
          const targetHeading = headings.find(h => 
            h.textContent?.trim() === heading.text.trim()
          );
          
          // If we found the heading, add the ID
          if (targetHeading && !targetHeading.id) {
            targetHeading.id = heading.id;
          }
        });
        
        // Mark the HTML as safe to render
        this.content = this.sanitizer.bypassSecurityTrustHtml(tempDiv.innerHTML);
        
        // Always update headings, even if empty
        this.headings = file.headings || [];
        console.log('Loaded markdown with headings:', this.headings);
        
        // Emit the headings
        this.headingsChange.emit(this.headings);
        
        // Also dispatch a custom event
        const event = new CustomEvent('headingsUpdate', { 
          detail: this.headings,
          bubbles: true,
          cancelable: true
        });
        console.log('Dispatching custom event:', event);
        const dispatched = this.elementRef.nativeElement.dispatchEvent(event);
        console.log('Event dispatched successfully:', dispatched);
      }
      this.loading = false;
    });
  }
  
  // Helper function to escape special regex characters
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Removed loadMarkdown method as its logic is now in ngOnInit

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
