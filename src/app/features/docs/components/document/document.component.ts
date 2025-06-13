import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { MarkdownService } from '@app/core/services/markdown.service';
import { Subscription, catchError, of, switchMap } from 'rxjs';
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
        return this.markdownService.getMarkdownFile(fullPath).pipe(
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
      const doc = parseHtml(`<div>${html}</div>`);
      
      // Function to create a URL-friendly ID from text (matching the TOC generation)
      const createId = (text: string): string => {
        // Replace umlauts with their non-umlaut equivalents first
        const umlautMap: {[key: string]: string} = {
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
        
        return text.trim()
          .toLowerCase()
          .replace(/[äöüßáàâãåéèêëíìîïóòôõøúùûýÿñçæœ]/g, match => umlautMap[match] || match)
          .replace(/[^\w\s-]/g, '')  // Remove any remaining special chars
          .replace(/\s+/g, '-')      // Replace spaces with -
          .replace(/-+/g, '-')       // Replace multiple - with single -
          .replace(/^-+|-+$/g, '');  // Remove leading/trailing -
      };

      // Ensure all headings have IDs that match their fragment links
      const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(heading => {
        if (!heading.id) {
          const text = heading.textContent || '';
          const id = createId(text);
          if (id) {
            heading.id = id;
          }
        }
      });
      
      // Process all links
      const links = doc.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        
        // Handle relative URLs
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          // For relative URLs, ensure they're properly formatted with literal slashes
          const basePath = currentPath.split('/').slice(0, -1).join('/');
          const newHref = `/${basePath ? basePath + '/' : ''}${href}`.replace(/\/\//g, '/');
          
          // Use setAttributeNS to prevent Angular from URL-encoding the slashes
          link.removeAttribute('href');
          link.setAttribute('href', newHref);
        }
        // Handle fragment links
        else if (href && href.startsWith('#')) {
          const fragment = href.substring(1);
          if (fragment) {
            // Create an ID that matches the TOC generation (without umlauts)
            const normalizedId = createId(fragment);
            
            // If the fragment contains URL-encoded characters, try to decode it first
            let decodedFragment = fragment;
            try {
              decodedFragment = decodeURIComponent(fragment);
            } catch (e) {
              // If decoding fails, use the original fragment
              console.warn('Failed to decode fragment:', fragment);
            }
            
            // Create a clean ID from the decoded fragment
            const cleanId = createId(decodedFragment);
            
            // Update the href to use the clean ID
            const currentPath = this.router.url.split('#')[0];
            link.setAttribute('href', `${currentPath}#${cleanId}`);
            
            // Add click handler for smooth scrolling
            link.addEventListener('click', (event) => {
              event.preventDefault();
              
              // Navigate using the clean ID
              this.router.navigate([], {
                fragment: cleanId,
                replaceUrl: true
              }).then(() => {
                // Try multiple ways to find the target element
                const element = document.getElementById(cleanId) || 
                               document.getElementById(fragment) ||
                               document.getElementById(decodedFragment) ||
                               document.getElementById(encodeURIComponent(decodedFragment)) ||
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
