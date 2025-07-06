import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, inject, ChangeDetectorRef, ViewChild, Renderer2, SecurityContext } from '@angular/core';
import { RefreshService } from '@app/core/services/refresh/refresh.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink, RouterModule, ParamMap } from '@angular/router';
import { MarkdownService, MarkdownApiResponse } from '@app/core/services/markdown.service';
import { Markdown2HtmlService, MarkdownParseResult } from '@app/core/services/markdown2html.service';
import { ContentService } from '@app/core/services/content.service';
import { RelatedDocumentsService, type RelatedDocument } from '@app/core/services/related-documents.service';
import { tap, takeUntil, catchError, switchMap, map, finalize } from 'rxjs/operators';
import { Subject, Subscription, of, Observable, forkJoin, throwError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { PathUtils } from '@app/core/utils/path.utils';
import { FirstDocumentService } from '@app/core/services/first-document.service';
import { HeadingsService } from '@app/core/services/headings.service';
import { ThemeService } from '@app/core/services/theme.service';
import { NotFound404Component } from '../404/404.component';
// Utilisation de PathUtils pour la manipulation des chemins
import { LOG } from '@app/core/services/logging/bun-logger.service';

type Theme = 'default' | 'leger';

// Simple DOM parser to safely manipulate HTML
const parseHtml = (html: string): Document => {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
};

const serializeDocument = (doc: Document): string => {
  return doc.documentElement.outerHTML;
};

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [CommonModule, RouterModule, NotFound404Component],
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.css']
})
export class DocumentComponent implements OnInit, OnDestroy {
  @Output() headingsChange = new EventEmitter<Array<{ text: string; level: number; id: string }>>();
  @Output() relatedDocumentsChange = new EventEmitter<RelatedDocument[]>();
  updateHeadings(headings: Array<{text: string, level: number, id: string}>) {
    this.headings = headings;
    this.headingsService.updateHeadings(headings);
    this.headingsChange.emit(headings);
  }
  public headings: Array<{ text: string; level: number; id: string }> = [];
  private _currentPath: string | null = null;
  private subscription: Subscription | null = null;
  
  content: SafeHtml | null = null;
  loading = true;
  error: string | null = null;
  relatedDocuments: RelatedDocument[] = [];
  showNotFound = false;
  notFoundMessage = 'The requested page does not exist or has been moved.';
  notFoundError: { message: string, originalUrl: string } | null = null;
  tags: string[] = [];
  
  @ViewChild(NotFound404Component) notFoundComponent?: NotFound404Component;
  showRelatedDocuments = false;
  
  // Fragment click handler reference for cleanup
  private fragmentClickHandler: ((event: MouseEvent) => void) | null = null;
  loadingRelated = false;
  relatedDocumentsError: string | null = null;
  private destroy$ = new Subject<void>();
  currentTheme: Theme = 'default';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private markdownService: MarkdownService,
    private markdown2htmlService: Markdown2HtmlService,
    private contentService: ContentService,
    private relatedDocumentsService: RelatedDocumentsService,
    private refreshService: RefreshService,
    private sanitizer: DomSanitizer,
    private firstDocumentService: FirstDocumentService,
    private headingsService: HeadingsService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef,
    private renderer: Renderer2,
    private elementRef: ElementRef
  ) {
    this.firstDocumentService = firstDocumentService;
    this.contentService = contentService;
    this.themeService = themeService;
    
    // Subscribe to theme changes
    this.themeService.currentTheme$.subscribe(theme => {
      this.currentTheme = theme as Theme;
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  ngOnInit(): void {
    LOG.debug('Document component initialized', {
      currentPath: this.route.snapshot.url.map((segment: any) => segment.path).join('/') || '/',
      hasFragment: !!this.route.snapshot.fragment
    });
    
    // Clean up any existing subscription
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    
    // Handle fragment navigation when component loads
    LOG.debug('Handling fragment navigation', { fragment: this.route.snapshot.fragment });
    this.handleFragmentNavigation();
    
    // Initialize refresh service if not already done
    if (!this.refreshService) {
      this.refreshService = inject(RefreshService);
    }
    
    // Subscribe to refresh requests
    this.refreshService.refreshRequested$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      LOG.debug('Refresh requested, reloading document content');
      this.loadDocumentContent();
    });
    
    this.subscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        // Get all path segments and join them with slashes
        const pathSegments = this.route.snapshot.url.map(segment => segment.path);
        let fullPath = pathSegments.join('/');
        
        if (!fullPath) {
          // If no path is provided, try to get the first document from the current directory
          const currentPath = this.route.snapshot.url.map(segment => segment.path).join('/');
          const currentDir = currentPath ? PathUtils.dirname(currentPath) : '';
          
          LOG.debug('No path provided, getting first document in directory', { directory: currentDir });
          return this.firstDocumentService.getFirstDocumentPath(currentDir).pipe(
            switchMap(path => {
              if (path) {
                LOG.debug('First document path found:', { path });
                this.router.navigate(path ? ['/', ...path.split('/')] : ['/']);
              } else {
                // If no document is found, show 404 inline
                LOG.warn('No documents found in directory', { directory: currentDir });
                this.showNotFound = true;
                this.notFoundError = {
                  message: `No document found in the directory '${currentDir}'`,
                  originalUrl: this.router.url
                };
                this.loading = false;
              }
              return of(null);
            })
          );
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
        
        LOG.debug('Loading document content', { path: fullPath });
        this.loading = true;
        this.error = null;
        
        // Load document content
        return this.loadDocumentContent().pipe(
          tap(file => {
            if (file) {
              this.processContent(file, fullPath);
              // Load related documents after content is processed
              this.loadRelatedDocuments(fullPath).subscribe();
            }
          })
        );
      })
    ).subscribe({
      next: (file) => {
        this.loading = false;
      },
      error: (err) => {
        LOG.error('Error in document subscription:', { error: err });
        
        // Check if the error is a 404 (document not found)
        const status = err?.status || err?.originalError?.status || 
                      (err?.message?.includes('404') ? 404 : null);
        
        if (status === 404 || (err?.error?.error === 'Document not found')) {
          LOG.warn('Document not found, showing 404 inline');
          this.showNotFound = true;
          this.notFoundError = {
            message: `The requested document was not found.`,
            originalUrl: this.router.url
          };
        } else {
          // For other errors, show an error message
          this.error = 'An error occurred while loading the document.';
        }
        
        this.loading = false;
      }
    });
  }
  
  /**
   * Loads the document content with cache handling
   */
  private loadDocumentContent(): Observable<MarkdownApiResponse> {
    const pathSegments = this.route.snapshot.url.map(segment => segment.path);
    const fullPath = pathSegments.join('/');
    
    if (!fullPath) {
      return of(null as unknown as MarkdownApiResponse);
    }
    
    this.loading = true;
    this.error = null;
    this.content = null;
    this.headings = [];
    this.headingsChange.emit(this.headings);
    
    return this.loadDocument(fullPath);
  }

  private loadDocument(path: string): Observable<MarkdownApiResponse> {
    return this.markdownService.getMarkdownFile(path).pipe(
      switchMap((response: MarkdownApiResponse) => {
        if (response && response.markdown) {
          // Convert markdown to HTML using Markdown2HtmlService
          return this.markdown2htmlService.parseMarkdown(response.markdown).pipe(
            map(parseResult => {
              try {
                // Get the string value from SafeHtml
                const htmlString = typeof parseResult.html === 'string' 
                  ? parseResult.html 
                  : this.sanitizer.sanitize(SecurityContext.HTML, parseResult.html) || '';
                
                // Process the HTML to fix links and add IDs to headings
                const processedHtml = this.processDocumentContent(htmlString, path);
                
                // Return the response with the original markdown and metadata
                // The processed HTML will be used directly in processContent
                return {
                  ...response,
                  metadata: {
                    ...response.metadata,
                    ...(parseResult.metadata || {}),
                    _processedHtml: processedHtml // Store processed HTML in metadata temporarily
                  },
                  // Use extracted headings or fallback to response.headings or empty array
                  headings: parseResult.headings?.length > 0 ? parseResult.headings : (response.headings || [])
                };
              } catch (error) {
                console.error('Error processing markdown:', error);
                return {
                  ...response,
                  html: '<p>Error processing markdown content</p>',
                  metadata: { ...response.metadata, error: true },
                  error: true
                };
              }
            })
          );
        }
        return of(response);
      }),
      catchError(error => {
        console.error('Error loading document:', error);
        // Return a valid MarkdownApiResponse with error information
        return of({
          markdown: '# Error loading document\n\nAn error occurred while loading the document.',
          headings: [],
          metadata: { error: true },
          path: path,
          name: path.split('/').pop() || 'document'
        } as MarkdownApiResponse);
      })
    );
  }
  
  /**
   * Handle successful document load
   */
  /**
   * Process the document content and update the view
   */
  private processContent(response: MarkdownApiResponse, fullPath: string): void {
    try {
      // Extract tags from metadata if available
      this.tags = response.metadata?.tags || [];
      LOG.debug('Processing content', { 
        path: fullPath,
        hasMarkdown: !!response.markdown,
        tags: this.tags 
      });
      
      // Update tags in the content service to share with other components
      this.contentService.updateCurrentTags(this.tags);
      
      // Get the processed HTML from metadata (stored in loadDocument)
      const processedHtml = response.metadata?.['_processedHtml'];
      if (!processedHtml) {
        LOG.error('No processed HTML content available');
        this.content = '';
      } else {
        this.content = this.sanitizer.bypassSecurityTrustHtml(processedHtml);
      }
      
      // Force view update
      this.cdr.detectChanges();
      
      // If headings are provided in the response, use them
      if (response.headings && response.headings.length > 0) {
        this.updateHeadings([...response.headings]);
      } else {
        // Otherwise, extract headings after the content is rendered
        // setTimeout ensures the content is in the DOM
        setTimeout(() => {
          const contentElement = this.elementRef.nativeElement.querySelector('.markdown-content');
          if (contentElement) {
            this.extractHeadingsFromContent(contentElement);
          } else {
            LOG.warn('Could not find .markdown-content element to extract headings');
          }
        }, 0);
      }
      
      // Emit the headings
      this.headingsChange.emit(this.headings);
      
      // If there's a fragment in the URL, navigate to it
      const fragment = this.router.parseUrl(this.router.url).fragment;
      if (fragment) {
        setTimeout(() => this.handleFragmentNavigation(), 100);
      }
      
      // Update the UI
      this.loading = false;
      this.error = null;
      this.cdr.detectChanges();
      
    } catch (error) {
      console.error('Error processing document:', error);
      this.error = 'An error occurred while processing the document.';
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Extract headings from the HTML content
   */
  private extractHeadingsFromContent(container: HTMLElement): void {
    if (!container) return;
    
    const headingElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headings: Array<{ text: string; level: number; id: string }> = [];
    
    headingElements.forEach((heading) => {
      const level = parseInt(heading.tagName.substring(1), 10);
      const text = heading.textContent?.trim() || '';
      const id = this.createId(text);
      
      // Set the ID on the heading element
      heading.id = id;
      
      headings.push({ text, level, id });
    });
    
    this.updateHeadings(headings);
  }
  

  
  /**
   * Scroll to a fragment in the document with smooth animation and highlight
   * @param fragment The ID of the element to scroll to (without the #)
   * @param offset Optional offset from the top of the viewport (default: 80px for header)
   */
  private scrollToFragment(fragment: string, offset: number = 80): void {
    if (!fragment) return;
    
    const element = document.getElementById(fragment);
    if (!element) {
      LOG.warn(`Element with ID '${fragment}' not found`);
      return;
    }
    
    // Use requestAnimationFrame for smoother animations
    requestAnimationFrame(() => {
      // Calculate the scroll position with offset
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;
      
      // Smooth scroll to the element
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Save original styles for restoration
      const originalTransition = element.style.transition;
      const originalBoxShadow = element.style.boxShadow;
      
      // Add highlight effect
      element.style.transition = 'box-shadow 0.5s ease';
      element.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
      
      // Focus the element for keyboard navigation
      element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
      
      // Remove highlight after animation
      setTimeout(() => {
        element.style.boxShadow = originalBoxShadow;
        setTimeout(() => {
          element.style.transition = originalTransition;
        }, 500);
      }, 1500);
    });
  }
  
  /**
   * Handles errors that occur during document loading
   * @param error The error that occurred
   * @param path The path of the document that failed to load
   */
  /**
   * Reloads the current document
   */
  reloadDocument(): void {
    const pathSegments = this.route.snapshot.url.map(segment => segment.path);
    const fullPath = pathSegments.join('/');
    
    if (fullPath) {
      this.loadDocumentContent();
    }
  }
  
  
  /**
   * Handle successful document load
   * @param response The API response containing the markdown content
   * @param path The path of the loaded document
   */
  private handleDocumentSuccess(response: MarkdownApiResponse, path: string): void {
    try {
      // Process the document content
      this.processContent(response, path);
      
      // Update the content service with the new content
      // Note: updateCurrentContent is not available in ContentService, so we only update tags
      this.contentService.updateCurrentTags(this.tags);
      
      // Load related documents
      this.loadRelatedDocuments(path).subscribe({
        next: (result) => {
          this.relatedDocuments = result.related;
          this.relatedDocumentsChange.emit(this.relatedDocuments);
        },
        error: (error) => {
          console.error('Error loading related documents:', error);
          this.relatedDocumentsError = 'Failed to load related documents';
        }
      });
      
      // Update UI state
      this.loading = false;
      this.error = null;
      this.showNotFound = false;
      
      // Trigger change detection
      this.cdr.detectChanges();
      
    } catch (error) {
      console.error('Error in handleDocumentSuccess:', error);
      this.handleDocumentLoadError(error, path);
    }
  }
  
  /**
   * Handle document loading errors
   * @param error The error that occurred
   * @param path The path of the document that failed to load
   */
  private handleDocumentLoadError(error: any, path: string): void {
    LOG.error(`Error loading document at path '${path}':`, { error });
    
    // Check if the error is a 404 (document not found)
    // Handle both direct HTTP errors and wrapped errors from our service
    const status = error?.status || error?.originalError?.status || 
                  (error?.message?.includes('404') ? 404 : null);
    
    if (status === 404 || (error?.error?.error === 'Document not found')) {
      LOG.warn(`Document not found at path: '${path}', showing 404`);
      this.showNotFound = true;
      this.notFoundError = {
        message: `The document "${path || 'unknown path'}" does not exist or has been moved.`,
        originalUrl: this.router.url
      };
      // Force update the not found component if it's already initialized
      if (this.notFoundComponent) {
        (this.notFoundComponent as any).errorMessage = this.notFoundError.message;
        (this.notFoundComponent as any).originalUrl = this.notFoundError.originalUrl;
      }
    } else {
      // For other errors, show an error message
      this.error = 'An error occurred while loading the document.';
      this.content = this.sanitizer.bypassSecurityTrustHtml(`
        <div class="document-error p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-400 dark:border-red-600">
          <h1 class="text-2xl font-bold text-red-900 dark:text-red-200 mb-4">Error loading document</h1>
          <p class="text-red-700 dark:text-red-300">
            An error occurred while loading the document at <code class="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">${path || 'unknown path'}</code>.
          </p>
          <div class="mt-4">
            <button (click)="reloadDocument()" class="text-blue-600 dark:text-blue-400 hover:underline">
              Try again
            </button>
            <span class="mx-2 text-gray-400">or</span>
            <a routerLink="/" class="text-blue-600 dark:text-blue-400 hover:underline">
              Go to home
            </a>
          </div>
        </div>
      `);
    }
    
    this.loading = false;
    this.cdr.detectChanges();
  }

  private loadRelatedDocuments(documentPath: string): Observable<{ related: RelatedDocument[] }> {
    if (!documentPath) {
      LOG.warn('No document path provided for related documents');
      return of({ related: [] });
    }
    
    LOG.debug('Loading related documents for path:', { path: documentPath });
    this.loadingRelated = true;
    this.relatedDocumentsError = null;
    
    // Ensure the path has .md extension for the API request
    const pathWithExtension = documentPath.endsWith('.md') ? documentPath : `${documentPath}.md`;
    
    return this.relatedDocumentsService.getRelatedDocuments(pathWithExtension, 5).pipe(
      tap({
        next: (response: { related: RelatedDocument[] }) => {
          LOG.debug('Received related documents:', { related: response.related });
          this.relatedDocuments = response.related || [];
          this.showRelatedDocuments = this.relatedDocuments.length > 0;
          this.loadingRelated = false;
          this.relatedDocumentsChange.emit(this.relatedDocuments);
          
          LOG.debug('Updated related documents state:', {
            count: this.relatedDocuments.length,
            showRelated: this.showRelatedDocuments,
            loading: this.loadingRelated,
            error: this.relatedDocumentsError
          });
        },
        error: (error) => {
          LOG.error('Error loading related documents:', { error });
          this.relatedDocumentsError = 'Failed to load related documents';
          this.loadingRelated = false;
          this.relatedDocuments = [];
          this.showRelatedDocuments = false;
          this.relatedDocumentsChange.emit([]);
        }
      }),
      catchError(error => {
        LOG.error('Error in related documents stream:', { error });
        this.relatedDocumentsError = 'An error occurred while loading related documents.';
        this.loadingRelated = false;
        this.relatedDocuments = [];
        this.showRelatedDocuments = false;
        return of({ related: [] });
      })
    );
  }
  
  // Make PathUtils available in the template
  buildDocsUrl = ['/'];
  
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

  /**
   * Handle fragment links in the URL when component loads
   */
  private handleFragmentNavigation(): void {
    const fragment = this.router.parseUrl(this.router.url).fragment;
    if (!fragment) return;
    
    // Use a small timeout to ensure the content is rendered
    setTimeout(() => {
      let element = document.getElementById(fragment);
      
      // If not found, try with the cleaned up version of the fragment
      if (!element) {
        const cleanedFragment = this.createId(fragment);
        if (cleanedFragment && cleanedFragment !== fragment) {
          element = document.getElementById(cleanedFragment);
        }
      }
      
      // If still not found, try to find a matching heading by text content
      if (!element) {
        const decodedFragment = decodeURIComponent(fragment);
        const cleanFragment = this.createId(decodedFragment);
        
        if (cleanFragment) {
          const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
          const matchingElement = headingElements.find((el: Element) => {
            const elId = el.id || '';
            const elText = el.textContent || '';
            return elId.includes(cleanFragment) || 
                   this.createId(elText).includes(cleanFragment);
          });
          
          if (matchingElement) {
            element = matchingElement as HTMLElement;
          }
        }
      }
      
      // Scroll to the element if found
      if (element) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          // Add a small offset to account for fixed headers
          const headerOffset = 80;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
          
          // Save original styles
          const originalTransition = element.style.transition;
          const originalBoxShadow = element.style.boxShadow;
          
          // Add highlight effect
          element.style.transition = 'box-shadow 0.5s ease';
          element.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
          
          // Focus the element for keyboard navigation
          element.setAttribute('tabindex', '-1');
          element.focus({ preventScroll: true });
          
          // Remove highlight after animation
          setTimeout(() => {
            element.style.boxShadow = originalBoxShadow;
            setTimeout(() => {
              element.style.transition = originalTransition;
            }, 500);
          }, 1500);
        });
      } else {
        LOG.warn(`Could not find element with ID or fragment: ${fragment}`);
      }
    }, 100);
  }
  
  /**
   * Handle clicks on fragment links in the document content
   * @param event The click event
   */
  onContentClick(event?: MouseEvent): void {
    if (!event) return;
    
    // Find the closest anchor element that was clicked
    const target = event.target as HTMLElement;
    const link = target.closest('a[href^="#"]') as HTMLAnchorElement;
    
    if (link) {
      const fragment = link.getAttribute('href');
      if (fragment) {
        // Prevent default behavior to handle navigation manually
        event.preventDefault();
        
        // Extract the fragment ID (without the #)
        const fragmentId = fragment.substring(1);
        
        // Check if it's the same fragment to avoid unnecessary navigation
        if (window.location.hash !== fragment) {
          // Use router.navigate for consistent navigation handling
          // This updates the URL in the address bar
          this.router.navigate([], { 
            fragment: fragmentId,
            replaceUrl: true,
            skipLocationChange: false
          }).then(() => {
            // Let handleFragmentNavigation handle the scrolling and highlighting
            this.handleFragmentNavigation();
          }).catch(error => {
            LOG.error('Navigation error:', { error });
            // Fallback to direct scrolling if navigation fails
            this.scrollToFragment(fragmentId);
          });
        } else {
          // Same fragment, just scroll to it
          this.scrollToFragment(fragmentId);
        }
      }
    }
  }

  /**
   * Processes the document content to handle headings and links
   * - Adds IDs to headings and anchor links
   * - Processes relative and anchor links
   * - Adds smooth scrolling for fragment links
   * @param html The HTML content to process
   * @param currentPath The current document path for link resolution
   * @returns Processed HTML as string
   */
  private processDocumentContent(html: string, currentPath: string): string {
    if (!html) return '';
    
    try {
      // Use DocumentFragment for better performance with DOM operations
      const fragment = document.createDocumentFragment();
      const container = document.createElement('div');
      container.innerHTML = html;
      fragment.appendChild(container);
      
      // HTML content is already set when creating the container
      
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
      // basePath removed, use currentPath directly if needed
      // const basePath = currentPath.split('/').slice(0, -1).filter(Boolean).join('/');
      const currentPathWithoutHash = this.router.url.split('#')[0];
      
      for (let i = 0; i < links.length; i++) {
        const link = links[i] as HTMLAnchorElement;
        const href = link.getAttribute('href');
        
        if (!href) continue;
        
        // Handle relative URLs (not starting with http or #)
        if (!href.startsWith('http') && !href.startsWith('#')) {
          const newHref = `/${href}`.replace(this.doubleSlashRegex, '/');
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
      LOG.error('Error processing HTML links:', { error });
      return html; // Return original HTML if processing fails
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnDestroy(): void {    
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    
    // Clean up the fragment click handler
    if (this.fragmentClickHandler) {
      this.elementRef.nativeElement.removeEventListener('click', this.fragmentClickHandler as EventListener);
      this.fragmentClickHandler = null;
    }
    
    this.destroy$.next();
    this.destroy$.complete();
    
    LOG.debug('Document component destroyed');
  }

  // Fragment handling is now managed by fragmentClickHandler in processDocumentContent

  goHome(): void {
    this.router.navigate(['/']);
  }
  
  // This method will be called by the not found component
  onNotFoundAction(action: 'home' | 'reload'): void {
    if (action === 'home') {
      this.goHome();
    } else if (action === 'reload') {
      this.reloadDocument();
    }
  }
}
