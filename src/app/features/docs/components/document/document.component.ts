import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, inject, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MarkdownService, MarkdownFile } from '@app/core/services/markdown.service';
import { Subscription, catchError, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';

// Simple DOM parser to safely manipulate HTML
const parseHtml = (html: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
};

const serializeDocument = (doc: Document): string => {
  return doc.documentElement.outerHTML;
};

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
    
    // Handle fragment navigation when component loads
    this.handleFragmentNavigation();
    
    this.subscription = this.route.url.pipe(
      switchMap(urlSegments => {
        // Get the full path from URL segments
        const path = urlSegments.map(s => s.path).join('/');
        
        if (!path) {
          this.router.navigate(['/docs/content/getting-started/introduction']);
          return of(null);
        }
        
        // Clear previous headings when path changes
        if (this._currentPath !== path) {
          this.headings = [];
          this._currentPath = path;
        }
        
        // Pass the path to the markdown service
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
        
        // Process fragment links in the HTML
        const processedHtml = this.processHtmlLinks(tempDiv.innerHTML, this._currentPath || '');
        
        // Mark the HTML as safe to render
        this.content = this.sanitizer.bypassSecurityTrustHtml(processedHtml);
        
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

  // Handle fragment links in the URL when component loads
  private handleFragmentNavigation() {
    // Wait for the content to be rendered
    setTimeout(() => {
      const fragment = this.router.parseUrl(this.router.url).fragment;
      if (fragment) {
        // Try exact match first
        let element = document.getElementById(fragment);
        
        // If not found, try decoding the fragment
        if (!element) {
          element = document.getElementById(decodeURIComponent(fragment));
        }
        
        // If still not found, try to find a partial match (for backward compatibility)
        if (!element) {
          const elements = document.querySelectorAll(`[id*="${fragment}"]`);
          if (elements.length > 0) {
            element = elements[0] as HTMLElement;
          }
        }
        
        // Scroll to the element if found
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 100);
  }
  
  // Handle clicks on fragment links
  onContentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('a[href^="#"]') as HTMLAnchorElement;
    
    if (link) {
      // Let the browser handle the fragment navigation
      // We'll handle the scrolling in handleFragmentNavigation
      const fragment = link.getAttribute('href');
      if (fragment) {
        // Update URL without page reload
        history.pushState(null, '', fragment);
        // Trigger fragment handling
        this.handleFragmentNavigation();
        event.preventDefault();
      }
    }
  }

  private processHtmlLinks(html: string, currentPath: string): string {
    try {
      const doc = parseHtml(`<div>${html}</div>`);
      
      // Ensure all headings have IDs that match their fragment links
      const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(heading => {
        if (!heading.id) {
          // Generate ID from text content if not set
          const text = heading.textContent || '';
          const id = text.trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')  // Remove special chars
            .replace(/\s+/g, '-')       // Replace spaces with -
            .replace(/-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+|-+$/g, '');    // Remove leading/trailing -
          if (id) {
            heading.id = id;
          }
        }
      });
      
      // Process all fragment links
      const links = doc.querySelectorAll('a[href^="#"]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          const fragment = href.substring(1);
          if (fragment) {
            // Update the href to include the current path
            const currentPath = this.router.url.split('#')[0];
            link.setAttribute('href', `${currentPath}#${fragment}`);
            
            // Add click handler for smooth scrolling
            link.addEventListener('click', (event) => {
              event.preventDefault();
              this.router.navigate([], {
                fragment: fragment,
                replaceUrl: true
              }).then(() => {
                const element = document.getElementById(fragment) || 
                               document.getElementById(decodeURIComponent(fragment));
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              });
            });
          }
        }
      });
      
      return doc.body.innerHTML;
    } catch (error) {
      console.error('Error processing HTML links:', error);
      return html; // Return original HTML if processing fails
    }
  }

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
