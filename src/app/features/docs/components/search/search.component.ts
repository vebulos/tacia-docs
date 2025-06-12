import { Component, ElementRef, HostListener, Inject, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil, tap } from 'rxjs/operators';
import { SearchService, SearchResult } from '../../../../core/services/search/search.service';
// Configuration de la recherche locale (valeurs par défaut si la configuration n'est pas injectée)
const DEFAULT_SEARCH_CONFIG = {
  initialResultsLimit: 10,
  maxResults: 20,
  debounceTime: 300
};

@Component({
  selector: 'app-docs-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('searchResultsElement') searchResultsElement!: ElementRef<HTMLDivElement>;

  searchControl = new FormControl('');
  isFocused = false;
  showRecentSearches = false;
  activeResultIndex = -1;
  recentSearches: string[] = [];
  isLoading = false;
  error: string | null = null;
  searchResults: SearchResult[] = [];
  
  private destroy$ = new Subject<void>();
  private router = inject(Router);
  private searchService = inject(SearchService);
  private searchConfig: any;

  constructor(
    @Inject('APP_CONFIG') private appConfig: any
  ) {
    this.searchConfig = appConfig?.search || DEFAULT_SEARCH_CONFIG;
  }

  ngOnInit(): void {
    console.log('[SearchComponent] ngOnInit called');
    this.setupSearch();
    this.setupSearchSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearch(): void {
    // Load recent searches
    this.recentSearches = this.searchService.getRecentSearches();
  }

  private setupSearchSubscriptions(): void {
    // Subscribe to search input changes with debounce
    this.searchControl.valueChanges.pipe(
      debounceTime(this.searchConfig.debounceTime),
      distinctUntilChanged(),
      filter(term => term !== null && term !== undefined),
      tap(() => this.isLoading = true),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (term && term.trim().length > 0) {
        this.searchService.search(term);
      } else {
        this.searchResults = [];
        this.showRecentSearches = this.recentSearches.length > 0;
        this.isLoading = false;
      }
    });

    // Subscribe to search results
    this.searchService.searchResults$.pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (results) => {
        this.searchResults = results || [];
        this.isLoading = false;
        this.showRecentSearches = this.searchResults.length === 0 && !this.searchControl.value;
      },
      error: (error) => {
        console.error('Error in search results', error);
        this.error = 'An error occurred while searching';
        this.isLoading = false;
      }
    });

    // Subscribe to loading state
    this.searchService.isLoading$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isLoading => {
      this.isLoading = isLoading;
    });

    // Subscribe to errors
    this.searchService.error$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(error => {
      this.error = error;
      this.isLoading = false;
    });
  }

  highlightMatches(text: string, query: string | null): string {
    if (!query) return text;
    const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  onFocus(): void {
    this.isFocused = true;
    this.showRecentSearches = this.recentSearches.length > 0 && !this.searchControl.value;
    
    // Ensure the search results are visible when focusing
    const searchValue = this.searchControl.value;
    if (searchValue) {
      this.searchService.search(searchValue);
    }
    
    // Focus the input
    if (this.searchInput && this.searchInput.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  onBlur(event: Event): void {
    // Use a small timeout to allow click events to be processed
    // before hiding the dropdown
    const blurTimeout = window.setTimeout(() => {
      const relatedTarget = (event as FocusEvent).relatedTarget as Node | null;
      
      if (!relatedTarget) {
        this.isFocused = false;
        this.showRecentSearches = false;
        this.activeResultIndex = -1;
        return;
      }
      
      // Check if the blur event was caused by clicking outside the search component
      const clickedInside = (this.searchResultsElement?.nativeElement?.contains(relatedTarget) || 
                           this.searchInput?.nativeElement?.contains(relatedTarget)) ?? false;
      
      if (!clickedInside) {
        this.isFocused = false;
        this.showRecentSearches = false;
        this.activeResultIndex = -1;
      }
    }, 150);
    
    // Store the timeout ID so we can clear it if needed
    this.destroy$.subscribe(() => window.clearTimeout(blurTimeout));
  }

  selectRecentSearch(term: string): void {
    if (!term) return;
    
    // Set the search term and trigger search
    this.searchControl.setValue(term);
    this.searchService.search(term);
    
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
    
    this.activeResultIndex = -1;
    this.showRecentSearches = false;
  }

  clearRecentSearches(event: Event): void {
    event.stopPropagation();
    this.searchService.clearRecentSearches();
    this.recentSearches = [];
  }

  clearSearch(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.searchControl.setValue('');
    this.searchResults = [];
    this.showRecentSearches = this.recentSearches.length > 0;
    this.activeResultIndex = -1;
    
    // Focus the input after clearing
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: any): void {
    // Accept any event, check if it's a keyboard event
    if (event && event.key === 'Enter') {
      // Your existing logic here
    }
  
    if (!this.isFocused) return;
    
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (this.activeResultIndex >= 0) {
          if (this.searchResults.length > 0 && this.activeResultIndex < this.searchResults.length) {
            this.selectResult(this.searchResults[this.activeResultIndex]);
          } else if (this.recentSearches.length > 0) {
            const recentIndex = this.activeResultIndex - this.searchResults.length;
            if (recentIndex >= 0 && recentIndex < this.recentSearches.length) {
              this.selectRecentSearch(this.recentSearches[recentIndex]);
            }
          }
        } else if (this.searchControl.value) {
          // Trigger search on enter if there's a query but no active selection
          this.searchService.search(this.searchControl.value);
        }
        break;
      
      case 'Escape':
        event.preventDefault();
        this.clearSearch();
        break;
        
      case 'ArrowDown':
      case 'ArrowUp':
        // Handled by the (keydown.arrowdown) and (keydown.arrowup) events on the input
        break;
        
      default:
        // For other keys, ensure the search results are shown
        if (this.searchControl.value) {
          this.showRecentSearches = false;
        } else {
          this.showRecentSearches = this.recentSearches.length > 0;
        }
        break;
    }
  }

  selectResult(result: SearchResult): void {
    console.log('Navigating to result:', result);
    if (!result || !result.path) {
      console.error('No result or path provided for navigation');
      return;
    }
    
    try {
      // Ensure the path is properly formatted for navigation
      let targetPath = result.path.trim();
      
      // Remove any leading/trailing slashes and normalize the path
      targetPath = targetPath.replace(/^\/+|\/+$/g, '');
      
      // Prepend the base path for documentation content
      targetPath = `/docs/content/${targetPath}`;
      
      console.log('Formatted path for navigation:', targetPath);
      
      // Add to recent searches
      this.searchService.addToRecentSearches(result.title);
      
      // Reset search UI state before navigation
      this.searchControl.setValue('', { emitEvent: false });
      this.showRecentSearches = false;
      this.searchResults = [];
      this.isFocused = false;
      
      // Use location.href as a fallback if router navigation fails
      const fallbackNavigation = () => {
        console.warn('Router navigation failed, falling back to location.href');
        window.location.href = targetPath;
      };
      
      // Try router navigation first
      this.router.navigateByUrl(targetPath, { replaceUrl: true })
        .then(navigated => {
          if (!navigated) {
            console.error('Router navigation returned false for path:', targetPath);
            fallbackNavigation();
          } else {
            console.log('Navigation successful to:', targetPath);
          }
        })
        .catch(error => {
          console.error('Router navigation error:', error);
          fallbackNavigation();
        });
        
    } catch (error) {
      console.error('Error during navigation preparation:', error);
      // Fallback to root if something goes wrong
      this.router.navigate(['/']);
    } finally {
      // Ensure UI is reset even if navigation fails
      this.focusMainContent();
    }
  }
  
  private focusMainContent(): void {
    // Focus the main content for better accessibility
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.setAttribute('tabindex', '-1');
      (mainContent as HTMLElement).focus();
    }
  }

  navigateResults(direction: number): void {
    if (this.isLoading) return;
    
    const totalItems = this.searchResults.length + (this.showRecentSearches ? this.recentSearches.length : 0);
    
    if (totalItems === 0) {
      this.activeResultIndex = -1;
      return;
    }
    
    // Initialize index if needed
    if (this.activeResultIndex === -1) {
      this.activeResultIndex = direction > 0 ? 0 : totalItems - 1;
    } else {
      // Calculate new index with wrapping
      let newIndex = this.activeResultIndex + direction;
      if (newIndex < 0) {
        newIndex = totalItems - 1;
      } else if (newIndex >= totalItems) {
        newIndex = 0;
      }
      this.activeResultIndex = newIndex;
    }
    
    this.scrollToActiveResult();
  }

  public scrollToActiveResult(): void {
    if (this.activeResultIndex < 0 || !this.searchResultsElement?.nativeElement) return;
    
    const activeElement = document.getElementById(
      this.activeResultIndex < this.searchResults.length 
        ? `search-result-${this.activeResultIndex}`
        : `recent-search-${this.activeResultIndex - this.searchResults.length}`
    );
    
    if (activeElement) {
      activeElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
      
      // Focus the element for better keyboard navigation
      (activeElement as HTMLElement).focus();
    }
  }

  private navigateToSelectedResult(): void {
    if (this.activeResultIndex < 0) return;

    if (this.searchResults.length > 0 && this.activeResultIndex < this.searchResults.length) {
      // Navigate to search result
      const result = this.searchResults[this.activeResultIndex];
      this.selectResult(result);
    } else if (this.recentSearches.length > 0) {
      // Select recent search
      const recentIndex = this.activeResultIndex - this.searchResults.length;
      if (recentIndex >= 0 && recentIndex < this.recentSearches.length) {
        this.selectRecentSearch(this.recentSearches[recentIndex]);
      }
    }
  }
}
