import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterModule, ParamMap } from '@angular/router';
import { MarkdownService, MarkdownFile } from '@app/core/services/markdown.service';
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
  
  private processContent(file: MarkdownFile, fullPath: string): void {
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      // Create a temporary div to manipulate the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = file.html;
      
      // Create a map to track processed headings for optimization
      const headingMap = new Map<string, number>();
      
      // Process each heading
      file.headings.forEach(heading => {
        const headingKey = `${heading.level}-${heading.text.trim()}`;
        const occurrence = (headingMap.get(headingKey) || 0) + 1;
        headingMap.set(headingKey, occurrence);
        
        // Only select headings that don't have an ID yet
        const selector = `h${heading.level}:not([id])`;
        const headings = Array.from(tempDiv.querySelectorAll(selector));
        
        // Find the first matching heading that doesn't have an ID
        const target = headings.find(h => 
          h.textContent?.trim() === heading.text.trim()
        ) as HTMLElement | undefined;
        
        if (target) {
          target.id = heading.id;
        }
      });
      
      // Process links after the content is loaded
      const processedHtml = this.processHtmlLinks(tempDiv.innerHTML, fullPath);
      
      // Update the content with processed HTML in a single operation
      this.content = this.sanitizer.bypassSecurityTrustHtml(processedHtml);
      this.headings = [...file.headings]; // Create a new array reference
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
    const cacheKey = text.trim().toLowerCase();
    
    // Return cached ID if available
    if (this.idCache.has(cacheKey)) {
      return this.idCache.get(cacheKey)!;
    }
    
    // Process the text to create an ID
    const id = cacheKey
      .replace(this.umlautRegex, match => this.umlautMap[match] || match)
      .replace(this.specialCharsRegex, '')
      .replace(this.spacesRegex, '-')
      .replace(this.multiHyphenRegex, '-')
      .replace(this.trimHyphenRegex, '');
    
    // Cache the result
    if (id) {
      this.idCache.set(cacheKey, id);
    }
    
    return id;
  }
  
  public toggleRelatedDocuments(): void {
    this.showRelatedDocuments = !this.showRelatedDocuments;
  }

  // Handle fragment links in the URL when component loads
  private handleFragmentNavigation() {
    // Wait for the content to be rendered
    setTimeout(() => {
      const fragment = this.router.parseUrl(this.router.url)['fragment'];
      if (fragment) {
        // Try exact match first
        let element = document.getElementById(fragment);
        
        // If not found, try decoding the fragment (for encoded umlauts)
        if (!element) {
          const decodedFragment = decodeURIComponent(fragment);
          element = document.getElementById(decodedFragment);
          
          // If still not found, try to find by URL-encoded version of the fragment
          if (!element && fragment !== decodedFragment) {
            element = document.getElementById(encodeURIComponent(decodedFragment));
          }
        }
        
        // If still not found, try to find a partial match (for backward compatibility)
        if (!element) {
          // Try with the original fragment
          let elements = Array.from(document.querySelectorAll(`[id*="${fragment}"]`));
          
          // If no matches, try with decoded fragment
          if (elements.length === 0) {
            const decodedFragment = decodeURIComponent(fragment);
            if (decodedFragment !== fragment) {
              elements = Array.from(document.querySelectorAll(`[id*="${decodedFragment}"]`));
            }
          }
          
          // If we found elements, use the first one
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
      // Use DocumentFragment for better performance with DOM operations
      const fragment = document.createDocumentFragment();
      const container = document.createElement('div');
      fragment.appendChild(container);
      
      // Set HTML content
      container.innerHTML = html;
      
      // Process headings first
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headingCache = new Map<string, number>();
      
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        if (!heading.id) {
          const text = heading.textContent || '';
          let id = this.createId(text);
          
          // Handle duplicate IDs
          if (id) {
            const count = (headingCache.get(id) || 0) + 1;
            headingCache.set(id, count);
            
            if (count > 1) {
              id = `${id}-${count}`;
            }
            
            heading.id = id;
          }
        }
      }
      
      // Process links
      const links = container.querySelectorAll('a[href]');
      const basePath = currentPath.split('/').slice(0, -1).filter(Boolean).join('/');
      const currentPathWithoutHash = this.router.url.split('#')[0];
      
      for (let i = 0; i < links.length; i++) {
        const link = links[i] as HTMLAnchorElement;
        const href = link.getAttribute('href');
        
        if (!href) continue;
        
        // Handle relative URLs
        if (!href.startsWith('http') && !href.startsWith('#')) {
          const newHref = `/${basePath ? basePath + '/' : ''}${href}`.replace(this.doubleSlashRegex, '/');
          link.setAttribute('href', newHref);
        }
        // Handle fragment links
        else if (href.startsWith('#')) {
          const fragment = href.substring(1);
          if (!fragment) continue;
          
          // Process fragment
          let decodedFragment = fragment;
          try {
            decodedFragment = decodeURIComponent(fragment);
          } catch (e) {
            console.warn('Failed to decode fragment:', fragment);
          }
          
          const cleanId = this.createId(decodedFragment);
          link.setAttribute('href', `${currentPathWithoutHash}#${cleanId}`);
          
          // Use event delegation instead of adding individual handlers
          link.dataset['fragment'] = cleanId;
        }
      }
      
      // Use event delegation for fragment navigation
      if (!this.fragmentClickHandler) {
        this.fragmentClickHandler = this.handleFragmentClick.bind(this);
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
