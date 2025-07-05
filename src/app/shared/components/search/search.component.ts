import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { RefreshService } from '@app/core/services/refresh/refresh.service';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil, tap } from 'rxjs/operators';
import { SearchService } from '@app/core/services/search/search.service';
import { SearchResult } from '@app/core/interfaces/search.interface';
import { NotificationService } from '@app/core/services/notification/notification.service';
import { environment } from '../../../../environments/environment';
import { LOG } from '@app/core/services/logging/bun-logger.service';

// Local search configuration (default values if not defined in environment)
const DEFAULT_SEARCH_CONFIG = {
  initialResultsLimit: 10,
  maxResults: 20,
  debounceTime: 300
};

@Component({
  selector: 'app-home-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class HomeSearchComponent implements OnInit, OnDestroy {
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
  private notificationService = inject(NotificationService);
  private refreshService = inject(RefreshService);
  private searchConfig: any;
  private documentKeyDownListener: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.searchConfig = environment?.search || DEFAULT_SEARCH_CONFIG;
    this.setupGlobalShortcuts();
  }

  ngOnInit(): void {
    LOG.debug('Initializing search component', {
      searchConfig: this.searchConfig,
      hasRouter: !!this.router
    });
    this.setupSearch();
    this.setupSearchSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupGlobalShortcuts();
  }

  /**
   * Sets focus on the search input field
   */
  focusSearch(): void {
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
      this.searchInput.nativeElement.select();
      this.isFocused = true;
      this.showRecentSearches = true;
    }
  }

  /**
   * Configure global keyboard shortcuts
   */
  private setupGlobalShortcuts(): void {
    // Use bind to maintain 'this' context
    this.documentKeyDownListener = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.documentKeyDownListener);
  }

  /**
   * Clean up event listeners
   */
  private cleanupGlobalShortcuts(): void {
    if (this.documentKeyDownListener) {
      document.removeEventListener('keydown', this.documentKeyDownListener);
    }
  }

  /**
   * Global keyboard event handler
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Check if Ctrl+F or Cmd+F is pressed
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      // Prevent browser's default search dialog from opening
      event.preventDefault();
      // Focus the search input field
      this.focusSearch();
    }
  }

  private setupSearch(): void {
    // Load recent searches from the search service
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
      next: (results: SearchResult[]) => this.handleSearchResults(results),
      error: (error: Error) => this.handleSearchError(error)
    });

    // Subscribe to loading state
    this.searchService.isLoading$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((isLoading: boolean) => {
      this.isLoading = isLoading;
    });

    // Subscribe to errors
    this.searchService.error$.pipe(
      filter((error: string | null): error is string => !!error),
      takeUntil(this.destroy$)
    ).subscribe((error: string) => {
      this.error = error;
      this.notificationService.show(error, 'error');
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

  /**
   * Format a file path for display
   * @param path The full path to format
   * @returns Formatted path without .md extension and cleaned up
   */
  formatPath(path: string): string {
    if (!path) return '';
    
    // Remove .md extension if present
    let formattedPath = path.replace(/\.md$/, '');
    
    // Remove any leading numbers and hyphens used for ordering
    formattedPath = formattedPath.replace(/^\d+[-_\s]*/, '');
    
    // Replace underscores and hyphens with spaces
    formattedPath = formattedPath.replace(/[_\-]/g, ' ');
    
    // Capitalize first letter of each word
    formattedPath = formattedPath.split('/')
      .map(segment => 
        segment.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      )
      .join(' / ');
    
    return formattedPath;
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

  selectRecentSearch(term: string, event?: Event): void {
    // Prevent default to avoid any potential issues with the click event
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    LOG.debug('Selecting recent search term', { term });
    if (!term) {
      LOG.debug('No search term provided, skipping selection');
      return;
    }
    
    LOG.debug('Setting up search for term', { term });
    
    // Set the search value without triggering events to avoid conflicts
    this.searchControl.setValue(term, { emitEvent: false });
    
    // Keep the recent searches visible during search
    this.showRecentSearches = true;
    this.searchResults = [];
    this.isLoading = true;
    
    LOG.debug('Initiating search request', { term });
    this.searchService.search(term).subscribe({
      next: (results: SearchResult[]) => this.handleSearchResults(results),
      error: (error: Error) => this.handleSearchError(error)
    });
    
    this.activeResultIndex = -1;
  }

  clearRecentSearches(event: Event): void {
    event.stopPropagation();
    this.searchService.clearRecentSearches();
    this.recentSearches = [];
  }

  /**
   * Clears the search input and results
   * @param event Optional event that triggered the clear
   * @param keepFocus If true, keeps focus on the input (default: true)
   */
  clearSearch(event?: Event, keepFocus: boolean = true): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.searchControl.setValue('');
    this.searchResults = [];
    this.showRecentSearches = this.recentSearches.length > 0;
    this.activeResultIndex = -1;
    
    // Handle focus based on the keepFocus parameter
    if (this.searchInput?.nativeElement) {
      if (keepFocus) {
        this.searchInput.nativeElement.focus();
      } else {
        this.searchInput.nativeElement.blur();
        this.isFocused = false;
      }
    }
  }

  /**
   * Adds a term to the current search query
   * @param term The term to add to the search
   */
  addSearchTerm(term: string): void {
    if (!term) return;
    
    const currentValue = this.searchControl.value || '';
    const terms = currentValue.split(' ').filter(t => t.trim() !== '');
    const termLower = term.toLowerCase();
    
    // Check if the term is already in the search (case insensitive)
    const termExists = terms.some(t => t.toLowerCase() === termLower);
    
    if (!termExists) {
      // Add the term to the search
      terms.push(term);
      const newSearch = terms.join(' ');
      
      // Update the search control value
      this.searchControl.setValue(newSearch);
      
      // Reset search results and show loading state
      this.searchResults = [];
      this.isLoading = true;
      
      // Trigger a new search
      this.searchService.search(newSearch).subscribe({
        next: (results: SearchResult[]) => {
          this.handleSearchResults(results);
          // Ensure the search results are visible
          this.isFocused = true;
          this.showRecentSearches = false;
        },
        error: (error: Error) => this.handleSearchError(error)
      });
    }
    
    // Focus the search input
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  /**
   * Refreshes the search index
   */
  refreshIndex(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Prevent multiple clicks while loading
    if (this.isLoading) {
      return;
    }
    
    // Show loading state
    this.isLoading = true;
    this.notificationService.info('Updating content and search index...', 0);
    
    // Notify all components to refresh their content
    this.refreshService.requestRefresh();
    
    // Call the search service to refresh the index
    this.searchService.refreshIndex().subscribe({
      next: () => {
        this.isLoading = false;
        this.notificationService.clearAll(); // Clear any previous notifications
        this.notificationService.success('Content and search index have been updated successfully', 5000);
        LOG.info('Content and search index refreshed successfully');
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.clearAll(); // Clear any previous notifications
        const errorMessage = error?.message || 'An error occurred while updating the content and index';
        this.notificationService.error(`Error: ${errorMessage}`, 7000);
        LOG.error('Error refreshing content and search index', {
          error: errorMessage,
          stack: error?.stack
        });
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isFocused) return;
    
    // Only process keys we care about
    if (!['Escape', 'ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      return;
    }
    
    // Prevent default behavior for all managed keys
    event.preventDefault();
    event.stopPropagation();
    
    switch (event.key) {
      case 'Escape':
        this.clearSearch(event, false);
        break;
        
      case 'ArrowDown':
        if (this.isFocused) {
          event.preventDefault();
          event.stopPropagation(); // Stop the event from bubbling up to prevent double calls
          this.handleArrowNavigation(1);
        }
        break;
      case 'ArrowUp':
        if (this.isFocused) {
          event.preventDefault();
          event.stopPropagation(); // Stop the event from bubbling up to prevent double calls
          this.handleArrowNavigation(-1);
        }
        break;
        
      case 'Enter':
        if (this.activeResultIndex >= 0) {
          this.navigateToSelectedResult();
        } else if (this.searchControl.value) {
          // Trigger search on enter if there's a query but no active selection
          this.searchService.search(this.searchControl.value);
        }
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

  selectResult(result: any): void {
    LOG.debug('Navigating to search result', { 
      path: result?.path,
      title: result?.title
    });
    
    // Use the path which now includes the extension for files
    const resultPath = result?.path;
    
    if (!result || !resultPath) {
      LOG.error('No result or path provided for navigation', {
        hasResult: !!result,
        hasPath: !!resultPath
      });
      return;
    }
    
    try {
      // Get base paths from config or use defaults

      
      // Start with the result path and normalize it
      let targetPath = resultPath.trim()
        // Remove any leading/trailing slashes
        .replace(/^\/+|\/+$/g, '');
      
      // Remove content base path if already included in the path

      
      // Remove .md extension from the URL for cleaner paths
      targetPath = targetPath.replace(/\.md$/i, '');
      
      // Construct the full path with proper segments
      targetPath = `/${targetPath}`
        // Normalize any remaining double slashes (except after protocol)
        .replace(/([^:]\/)\/+/g, '$1')
        // Remove trailing slash
        .replace(/\/+$/, '');
      
      LOG.debug('Formatted navigation path', { 
        originalPath: resultPath,
        targetPath: targetPath,
        isDirectory: result?.isDirectory
      });
      
      // Add to recent searches
      this.searchService.addToRecentSearches(result.title);
      
      // Reset search UI state before navigation
      this.searchControl.setValue('', { emitEvent: false });
      this.showRecentSearches = false;
      this.searchResults = [];
      this.isFocused = false;
      
      // Use location.href as a fallback if router navigation fails
      const fallbackNavigation = () => {
        LOG.warn('Router navigation failed, falling back to location.href', { targetPath });
        window.location.href = targetPath;
      };
      
      // Try router navigation first
      this.router.navigateByUrl(targetPath, { replaceUrl: true })
        .then(navigated => {
          if (!navigated) {
            LOG.error('Router navigation returned false for path', { targetPath });
            fallbackNavigation();
          } else {
            LOG.debug('Navigation successful', { targetPath });
          }
        })
        .catch(error => {
          LOG.error('Router navigation failed', {
            targetPath,
            error: error?.message || 'Unknown error',
            stack: error?.stack
          });
          fallbackNavigation();
        });
        
    } catch (error) {
      LOG.error('Error during navigation preparation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
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

  /**
   * Handle arrow key navigation in search results
   * @param direction 1 for down, -1 for up
   */
  private isNavigating = false;

  private handleArrowNavigation(direction: number): void {
    // Prevent multiple calls
    if (this.isNavigating || this.isLoading || !this.searchResultsElement?.nativeElement) return;
    
    this.isNavigating = true;
    
    try {
      const resultElements = this.searchResultsElement.nativeElement.querySelectorAll('.search-result, .recent-search');
      const totalItems = resultElements.length;

      if (totalItems === 0) {
        this.activeResultIndex = -1;
        return;
      }

      let newIndex = this.activeResultIndex + direction;

      if (newIndex >= totalItems) {
        newIndex = 0; // Wrap to the start
      } else if (newIndex < 0) {
        newIndex = totalItems - 1; // Wrap to the end
      }

      this.activeResultIndex = newIndex;
      this.scrollToActiveResult();
    } finally {
      // Reset the flag after a small delay to allow for smooth navigation
      setTimeout(() => {
        this.isNavigating = false;
      }, 50);
    }
  }
  
  /**
   * Scroll to make the active search result visible
   */
  /**
   * Scroll to make the active search result visible
   * @public to be accessible from template
   */
  public scrollToActiveResult(): void {
    if (this.activeResultIndex < 0 || !this.searchResultsElement?.nativeElement) return;

    const resultElements = this.searchResultsElement.nativeElement.querySelectorAll('.search-result, .recent-search');
    const activeElement = resultElements[this.activeResultIndex] as HTMLElement;

    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      activeElement.focus(); // Ensure the focused element is the active one
    }
  }

  /**
   * Public method to handle arrow navigation from template
   * @param direction 1 for down, -1 for up
   */
  public navigateResults(direction: number): void {
    this.handleArrowNavigation(direction);
  }

  /**
   * Navigate to the selected search result or recent search
   */
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

  /**
   * Handle successful search results
   * @param results Array of search results
   */
  private handleSearchResults(results: SearchResult[]): void {
    this.searchResults = results || [];
    this.isLoading = false;
    this.error = null;
    this.showRecentSearches = this.searchResults.length === 0 && !this.searchControl.value;
    
    // Set focus back to input after a small delay
    if (this.searchInput?.nativeElement) {
      setTimeout(() => {
        this.searchInput.nativeElement.focus();
      }, 100);
    }
  }

  /**
   * Handle search errors
   * @param error Error that occurred during search
   */
  private handleSearchError(error: Error): void {
    const errorMessage = error?.message || 'An error occurred while searching';
    LOG.error('Search error', {
      error: errorMessage,
      stack: error?.stack
    });
    
    this.error = errorMessage;
    this.isLoading = false;
    this.showRecentSearches = true;
    
    // Use the notification service if available
    if (this.notificationService && typeof this.notificationService.show === 'function') {
      this.notificationService.show(this.error, 'error');
    } else {
      LOG.error('Notification service not available or show method not found');
    }
  }
}
