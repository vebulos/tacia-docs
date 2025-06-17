import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterModule, ParamMap } from '@angular/router';
import { MarkdownService, MarkdownApiResponse } from '@app/core/services/markdown.service';
import { RelatedDocumentsService, type RelatedDocument } from '@app/core/services/related-documents.service';
import { tap } from 'rxjs/operators';
import { Subscription, catchError, of, switchMap, Observable, forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { PathUtils } from '@app/core/utils/path.utils';

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
  imports: [CommonModule, RouterModule],
  selector: 'app-document',
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.css']
})
export class DocumentComponent implements OnInit, OnDestroy {
  @Output() headingsChange = new EventEmitter<Array<{ text: string; level: number; id: string }>>();
  @Output() relatedDocumentsChange = new EventEmitter<RelatedDocument[]>();
  public headings: Array<{ text: string; level: number; id: string }> = [];
  private _currentPath: string | null = null;
  private subscription: Subscription | null = null;
  
  content: SafeHtml | null = null;
  loading = true;
  error: string | null = null;
  relatedDocuments: RelatedDocument[] = [];
  showRelatedDocuments = false;
  
  // Fragment click handler reference for cleanup
  private fragmentClickHandler: ((event: MouseEvent) => void) | null = null;
  loadingRelated = false;
  relatedDocumentsError: string | null = null;

  private elementRef = inject(ElementRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private markdownService: MarkdownService,
    private relatedDocumentsService: RelatedDocumentsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Clean up any existing subscription
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    
    // Handle fragment navigation when component loads
    this.handleFragmentNavigation();
    
    this.subscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        // Get all path segments and join them with slashes
        const pathSegments = this.route.snapshot.url.map(segment => segment.path);
        let fullPath = pathSegments.join('/');
        
        if (!fullPath) {
          // Use the default path if no path is provided
          this.router.navigate(PathUtils.buildDocsUrl(PathUtils.DEFAULT_DOCS_PATH));
          return of(null);
        }
        
        // Get the current navigation to access the resolved data
        const navigation = this.router.getCurrentNavigation();
        const state = navigation?.extras.state as { path?: string } | null;
        
        // If we have a path from the navigation state, use it
        if (state?.path) {
          fullPath = state.path;
        }
        
        // Clear previous headings when path changes
        if (this._currentPath !== fullPath) {
          this.headings = [];
          this._currentPath = fullPath;
        }
        
        console.log('Loading markdown from path:', fullPath);
        this.loading = true;
        this.error = null;
        
        // Start loading related documents in parallel
        const relatedDocs$ = this.loadRelatedDocuments(fullPath);
        
        // Load document content and related documents in parallel
        return forkJoin([
          this.markdownService.getMarkdownFile(fullPath).pipe(
            catchError(err => {
              console.error('Error loading markdown:', err);
              this.error = 'Failed to load document. Please try again later.';
              return of(null);
            })
          ),
          relatedDocs$.pipe(catchError(() => of(null)))
        ]).pipe(
          switchMap(([file]) => {
            if (file) {
              this.processContent(file, fullPath);
            }
            return of(file);
          })
        );
      })
    ).subscribe({
      next: (file) => {
        this.loading = false;
      },
      error: (err) => {
        console.error('Error in document subscription:', err);
        this.error = 'An error occurred while loading the document.';
        this.loading = false;
      }
    });
  }
  
  private processContent(response: MarkdownApiResponse, fullPath: string): void {
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      // Create a temporary div to manipulate the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = response.html;
      
      // Process links after the content is loaded
      const processedHtml = this.processHtmlLinks(tempDiv.innerHTML, fullPath);
      
      // Update the content with processed HTML in a single operation
      this.content = this.sanitizer.bypassSecurityTrustHtml(processedHtml);
      this.headings = [...response.headings]; // Create a new array reference
      this.headingsChange.emit(this.headings);
    });
  }
  
  private loadRelatedDocuments(documentPath: string): Observable<{ related: RelatedDocument[] }> {
    if (!documentPath) {
      console.log('No document path provided for related documents');
      return of({ related: [] });
    }
    
    console.log('Loading related documents for path:', documentPath);
    this.loadingRelated = true;
    this.relatedDocumentsError = null;
    
    // Ensure the path has .md extension for the API request
    const pathWithExtension = documentPath.endsWith('.md') ? documentPath : `${documentPath}.md`;
    
    return this.relatedDocumentsService.getRelatedDocuments(pathWithExtension, 5).pipe(
      tap({
        next: (response: { related: RelatedDocument[] }) => {
          this.relatedDocuments = response.related;
          this.showRelatedDocuments = this.relatedDocuments.length > 0;
          this.loadingRelated = false;
          this.relatedDocumentsChange.emit(this.relatedDocuments);
        },
        error: (error) => {
          console.error('Error loading related documents:', error);
          this.relatedDocumentsError = 'Failed to load related documents';
          this.loadingRelated = false;
        }
      }),
      catchError(error => {
        console.error('Error in related documents stream:', error);
        this.relatedDocumentsError = 'An error occurred while loading related documents.';
        this.loadingRelated = false;
        return of({ related: [] });
      })
    );
  }
  
  // Make PathUtils available in the template
  buildDocsUrl = PathUtils.buildDocsUrl;
  
  // Cache for createId function
  private readonly idCache = new Map<string, string>();
  private readonly umlautMap: {[key: string]: string} = {
    'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss',
    'Ä': 'A', 'Ö': 'O', 'Ü': 'U',
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ñ': 'n', 'ç': 'c', 'æ': 'ae', 'œ': 'oe'
  };
  private readonly umlautRegex = new RegExp(`[${Object.keys(this.umlautMap).join('')}]`, 'g');
  private readonly specialCharsRegex = /[^\w\s-]/g;
  private readonly spacesRegex = /\s+/g;
  private readonly multiHyphenRegex = /-+/g;
  private readonly trimHyphenRegex = /^-+|-+$/g;
  private readonly doubleSlashRegex = /\/\//g;

  private createId(text: string): string {
    // Return empty string for empty input
    if (!text || typeof text !== 'string') return '';
    
    const cacheKey = text.trim().toLowerCase();
    
    // Return cached ID if available
    if (this.idCache.has(cacheKey)) {
      return this.idCache.get(cacheKey)!;
    }
    
    // Process the text to create an ID
    let id = cacheKey
      // Replace umlauts and accents
      .replace(this.umlautRegex, match => this.umlautMap[match] || match)
      // Convert to lowercase
      .toLowerCase()
      // Replace special characters with hyphen
      .replace(/[^\w\s-]/g, '-')
      // Replace spaces with single hyphen
      .replace(/\s+/g, '-')
      // Replace multiple hyphens with single hyphen
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Truncate to 50 chars to avoid very long URLs
      .substring(0, 50)
      // Remove any trailing hyphen
      .replace(/-+$/, '');
    
    // Ensure ID is not empty
    if (!id) {
      id = 'section';
    }
    
    // Cache the result
    this.idCache.set(cacheKey, id);
    
    return id;
  }
  
  public toggleRelatedDocuments(): void {
    this.showRelatedDocuments = !this.showRelatedDocuments;
  }

  // Handle fragment links in the URL when component loads
  private handleFragmentNavigation() {
    // Wait for the content to be rendered
    setTimeout(() => {
      const fragment = this.router.parseUrl(this.router.url).fragment || '';
      if (!fragment) return;
      
      // Try exact match first
      let element = document.getElementById(fragment);
      
      // If not found, try with the cleaned up version of the fragment
      if (!element) {
        const cleanFragment = this.createId(fragment);
        if (cleanFragment) {
          element = document.getElementById(cleanFragment);
        }
      }
      
      // If still not found, try to find a matching heading by text content
      if (!element) {
        // Remove any URL encoding and clean the fragment
        const decodedFragment = decodeURIComponent(fragment);
        const cleanFragment = this.createId(decodedFragment);
        
        if (cleanFragment) {
          // Try exact match with cleaned fragment
          element = document.getElementById(cleanFragment);
          
          // Try partial match if still not found
          if (!element) {
            const elements = Array.from(document.querySelectorAll('[id]'));
            const matchingElement = elements.find(el => 
              el.id.includes(cleanFragment) || 
              this.createId(el.textContent || '').includes(cleanFragment)
            );
            
            if (matchingElement) {
              element = matchingElement as HTMLElement;
            }
          }
        }
      }
      
      // Scroll to the element if found
      if (element) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          // Add a small offset to account for fixed headers
          const headerOffset = 80;
          const elementPosition = element!.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
          
          // Focus the element for keyboard navigation
          element!.setAttribute('tabindex', '-1');
          element!.focus({ preventScroll: true });
          
          // Highlight the element briefly
          const originalTransition = element!.style.transition;
          const originalBoxShadow = element!.style.boxShadow;
          
          element!.style.transition = 'box-shadow 0.5s ease';
          element!.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
          
          setTimeout(() => {
            element!.style.boxShadow = originalBoxShadow;
            setTimeout(() => {
              element!.style.transition = originalTransition;
            }, 500);
          }, 1500);
        });
      } else {
        console.warn(`Could not find element with ID or fragment: ${fragment}`);
      }
    }, 100);
  }
  
  // Handle clicks on fragment links
  onContentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('a[href^="#"]') as HTMLAnchorElement;
    
    if (link) {
      const fragment = link.getAttribute('href');
      if (fragment) {
        event.preventDefault();
        
        // Check if it's the same fragment to avoid unnecessary navigation
        if (window.location.hash !== fragment) {
          // Use router.navigate for consistent navigation handling
          this.router.navigate([], { 
            fragment: fragment.substring(1),
            replaceUrl: true,
            skipLocationChange: false
          }).then(() => {
            // Let handleFragmentNavigation handle the scrolling
            this.handleFragmentNavigation();
          });
        } else {
          // Same fragment, just scroll to it
          const elementId = fragment.substring(1);
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    }
  }

  private processHtmlLinks(html: string, currentPath: string): string {
    try {
      // Use DocumentFragment for better performance with DOM operations
      const fragment = document.createDocumentFragment();
      const container = document.createElement('div');
      fragment.appendChild(container);
      
      // Set HTML content
      container.innerHTML = html;
      
      // First pass: Process all headings to ensure they have consistent IDs
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headingIds = new Map<string, number>();
      
      // Create IDs for all headings first
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const text = heading.textContent || '';
        
        // Check if the heading already has an ID that might have been set by the server
        let id = heading.id;
        
        // If no ID or it's not a valid ID, create a new one
        if (!id || id === '') {
          id = this.createId(text);
          
          // Skip if no valid ID could be generated
          if (!id) continue;
          
          // Handle duplicate IDs by appending a number
          const count = (headingIds.get(id) || 0) + 1;
          headingIds.set(id, count);
          
          if (count > 1) {
            id = `${id}-${count}`;
          }
          
          // Set the ID on the heading
          heading.id = id;
        }
        
        // Add an anchor link next to the heading
        const anchor = document.createElement('a');
        anchor.href = `#${id}`;
        anchor.className = 'header-link';
        anchor.setAttribute('aria-hidden', 'true');
        anchor.innerHTML = '#';
        anchor.style.marginLeft = '0.5rem';
        anchor.style.opacity = '0';
        anchor.style.transition = 'opacity 0.2s';
        
        // Show the anchor on hover over the heading
        (heading as HTMLElement).style.position = 'relative';
        heading.addEventListener('mouseenter', () => {
          (anchor as HTMLElement).style.opacity = '0.7';
        });
        heading.addEventListener('mouseleave', () => {
          (anchor as HTMLElement).style.opacity = '0';
        });
        
        heading.appendChild(anchor);
      }
      
      // Process all links in the document
      const links = container.querySelectorAll('a[href]');
      const basePath = currentPath.split('/').slice(0, -1).filter(Boolean).join('/');
      const currentPathWithoutHash = this.router.url.split('#')[0];
      
      for (let i = 0; i < links.length; i++) {
        const link = links[i] as HTMLAnchorElement;
        const href = link.getAttribute('href');
        
        if (!href) continue;
        
        // Handle relative URLs (not starting with http or #)
        if (!href.startsWith('http') && !href.startsWith('#')) {
          const newHref = `/${basePath ? basePath + '/' : ''}${href}`.replace(this.doubleSlashRegex, '/');
          link.setAttribute('href', newHref);
        }
        // Handle fragment links
        else if (href.startsWith('#')) {
          const fragment = href.substring(1);
          if (!fragment) continue;
          
          // Process fragment to match the ID generation logic
          let cleanFragment = this.createId(fragment);
          
          // If we couldn't create a clean ID, try to find a matching heading
          if (!cleanFragment) {
            const heading = Array.from(headings).find(h => 
              this.createId(h.textContent || '') === this.createId(fragment)
            );
            if (heading && heading.id) {
              cleanFragment = heading.id;
            }
          }
          
          // Only update the href if we have a valid fragment
          if (cleanFragment) {
            link.setAttribute('href', `#${cleanFragment}`);
            link.dataset['fragment'] = cleanFragment;
          }
        }
      }
      
      // Add smooth scrolling for fragment links
      if (!this.fragmentClickHandler) {
        this.fragmentClickHandler = (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          const link = target.closest('a[href^="#"]') as HTMLAnchorElement;
          
          if (link) {
            const fragment = link.getAttribute('href');
            if (fragment && fragment !== '#') {
              event.preventDefault();
              const elementId = fragment.substring(1);
              const element = document.getElementById(elementId);
              
              if (element) {
                // Update URL without page reload
                history.pushState(null, '', `${window.location.pathname}${window.location.search}${fragment}`);
                
                // Scroll to element with smooth behavior
                element.scrollIntoView({ behavior: 'smooth' });
                
                // Focus the element for accessibility
                element.setAttribute('tabindex', '-1');
                element.focus();
              }
            }
          }
        };
        
        container.addEventListener('click', this.fragmentClickHandler as EventListener);
      }
      
      return container.innerHTML;
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
    
    // Cleanup event listener
    if (this.fragmentClickHandler) {
      this.elementRef.nativeElement.removeEventListener('click', this.fragmentClickHandler as EventListener);
      this.fragmentClickHandler = null;
    }
  }
  
  private handleFragmentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const link = target.closest('a[data-fragment]') as HTMLAnchorElement;
    
    if (link) {
      event.preventDefault();
      const fragment = link.getAttribute('data-fragment');
      
      if (fragment) {
        this.router.navigate([], {
          fragment,
          replaceUrl: true
        }).then(() => {
          // Try multiple ways to find the target element
          const element = document.getElementById(fragment) ||
                         document.getElementById(encodeURIComponent(fragment)) ||
                         document.getElementById(decodeURIComponent(fragment));
          
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
