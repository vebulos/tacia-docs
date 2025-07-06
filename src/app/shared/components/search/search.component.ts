import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil, tap } from 'rxjs/operators';

// Services
import { SearchService } from '@app/core/services/search/search.service';
import { RefreshService } from '@app/core/services/refresh/refresh.service';
import { NotificationService } from '@app/core/services/notification/notification.service';

// Interfaces
import { SearchResult } from '@app/core/interfaces/search.interface';

// Utils
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
   * Handles successful search results
   * @param results Array of search results
   */
  private handleSearchResults(results: SearchResult[]): void {
    this.searchResults = results || [];
    this.isLoading = false;
    this.error = null;
    this.showRecentSearches = this.searchResults.length === 0 && !this.searchControl.value;
    this.activeResultIndex = -1;
    
    // Set focus back to input after a small delay
    if (this.searchInput?.nativeElement) {
      setTimeout(() => {
        this.searchInput.nativeElement.focus();
      }, 100);
    }
  }

  /**
   * Handles search errors
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
    this.searchResults = [];
    
    // Show error notification
    if (this.notificationService && typeof this.notificationService.show === 'function') {
      this.notificationService.show(this.error, 'error');
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

  /**
   * Sets up all search-related subscriptions
   * - Search input changes with debounce
   - Search results updates
   - Loading state updates
   - Error handling
   */
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

  /**
   * Handles focus event on the search input
   * Shows recent searches if available and no search term is entered
   */
  onFocus(): void {
    this.isFocused = true;
    this.showRecentSearches = this.recentSearches.length > 0 && !this.searchControl.value;
    
    // Ensure the input is focused
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  /**
   * Handles blur event on the search input
   * Hides the dropdown after a small delay to allow for click events to be processed
   * @param event The blur event
   */
  onBlur(event: Event): void {
    // Use a small timeout to allow click events to be processed before hiding the dropdown
    const blurTimeout = window.setTimeout(() => {
      const relatedTarget = (event as FocusEvent).relatedTarget as Node | null;
      
      // If no related target (e.g., tabbed out), close the dropdown
      if (!relatedTarget) {
        this.isFocused = false;
        this.showRecentSearches = false;
        this.activeResultIndex = -1;
        return;
      }
      
      // Check if the blur event was caused by clicking inside the search component
      const clickedInside = (this.searchResultsElement?.nativeElement?.contains(relatedTarget) || 
                           this.searchInput?.nativeElement?.contains(relatedTarget)) ?? false;
      
      // Only hide the dropdown if clicking outside the search component
      if (!clickedInside) {
        this.isFocused = false;
        this.showRecentSearches = false;
        this.activeResultIndex = -1;
      }
    }, 150);
    
    // Clean up the timeout when the component is destroyed
    this.destroy$.subscribe(() => window.clearTimeout(blurTimeout));
  }

  /**
   * Adds a search term to the search input and triggers a search
   * @param term The search term to add (can include '#' for tags)
   */
  addSearchTerm(term: string): void {
    if (!term) return;
    
    // Get current search value
    const currentValue = this.searchControl.value || '';
    const terms = currentValue.split(' ').filter(t => t.trim() !== '');
    const termLower = term.toLowerCase();
    
    // Check if term already exists in the search
    const termExists = terms.some(t => t.toLowerCase() === termLower);
    
    // If term doesn't exist, add it to the search
    if (!termExists) {
      const newSearch = [...terms, term].join(' ');
      this.searchControl.setValue(newSearch, { emitEvent: true });
    } else {
      // If term exists, just update the value to trigger search
      this.searchControl.setValue(currentValue.trim(), { emitEvent: true });
    }
    
    // Focus the search input
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  /**
   * Handles selection of a recent search term
   * @param term The selected search term to search for
   * @param event Optional click event to prevent default behavior
   */
  selectRecentSearch(term: string, event?: Event): void {
    // Prevent default behavior if event is provided
    event?.preventDefault();
    event?.stopPropagation();
    
    if (!term) {
      return;
    }
    
    // Add to recent searches first
    this.searchService.addToRecentSearches(term);
    
    // Update the search input value and trigger search
    this.searchControl.setValue(term, { emitEvent: true });
    
    // Force a search even if the value didn't change
    this.searchService.search(term).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.isLoading = false;
      },
      error: (error) => {
        this.error = 'Failed to perform search';
        this.isLoading = false;
        LOG.error('Search error:', error);
      }
    });
    
    // Update UI state
    this.isFocused = true;
    this.showRecentSearches = false;
    this.activeResultIndex = -1;
    this.isLoading = true;
    
    // Ensure the input maintains focus and cursor is at the end
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
      // Move cursor to the end of the input
      const length = term.length;
      this.searchInput.nativeElement.setSelectionRange(length, length);
    }
  }

  /**
   * Clears all recent searches from the service and updates the UI
   * @param event The click event that triggered the clear
   */
  clearRecentSearches(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Clear recent searches from the service
    this.searchService.clearRecentSearches();
    
    // Update the local copy and UI state
    this.recentSearches = [];
    this.showRecentSearches = false;
    
    // Maintain focus on the input
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  /**
   * Clears the search input, results, and resets the search state
   * @param event Optional event that triggered the clear action
   * @param keepFocus If true, maintains focus on the input; if false, removes focus (default: true)
   */
  clearSearch(event?: Event, keepFocus: boolean = true): void {
    // Prevent default behavior if event is provided
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Clear the search input and results
    this.searchControl.setValue('');
    this.searchResults = [];
    this.activeResultIndex = -1;
    
    // Show recent searches if any are available
    this.showRecentSearches = this.recentSearches.length > 0;
    
    // Handle focus management
    if (this.searchInput?.nativeElement) {
      if (keepFocus) {
        // Maintain focus on the input
        this.searchInput.nativeElement.focus();
        this.isFocused = true;
      } else {
        // Remove focus from the input
        this.searchInput.nativeElement.blur();
        this.isFocused = false;
        this.showRecentSearches = false;
      }
    }
  }

  /**
   * Refreshes the search index and notifies other components to update their content
   * Displays appropriate notifications for success and error states
   * @param event The click event that triggered the refresh
   */
  refreshIndex(event: Event): void {
    // Prevent default behavior and stop event propagation
    event.preventDefault();
    event.stopPropagation();
    
    // Prevent multiple refresh attempts while a refresh is already in progress
    if (this.isLoading) {
      this.notificationService.info('Refresh is already in progress...', 2000);
      return;
    }
    
    // Update UI to show loading state
    this.isLoading = true;
    this.notificationService.info('Updating content and search index...', 0);
    
    // Notify all components to refresh their content
    this.refreshService.requestRefresh();
    
    // Call the search service to refresh the index
    this.searchService.refreshIndex().subscribe({
      next: () => {
        // Handle successful refresh
        this.isLoading = false;
        this.notificationService.clearAll();
        this.notificationService.success('Content and search index have been updated successfully', 5000);
        LOG.info('Content and search index refreshed successfully');
        
        // Refocus the search input if it was focused before
        if (this.isFocused && this.searchInput?.nativeElement) {
          this.searchInput.nativeElement.focus();
        }
      },
      error: (error) => {
        // Handle refresh error
        this.isLoading = false;
        this.notificationService.clearAll();
        
        // Extract error message with fallback
        const errorMessage = error?.message || 'An error occurred while updating the content and index';
        this.notificationService.error(`Error: ${errorMessage}`, 7000);
        
        // Log detailed error information
        LOG.error('Error refreshing content and search index', {
          error: errorMessage,
          stack: error?.stack
        });
      }
    });
  }

  /**
   * Handles keyboard navigation in the search component
   * @param event The keyboard event
   */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ignore key events when the search input is not focused
    if (!this.isFocused) {
      return;
    }
    
    // Only handle specific navigation keys
    const navigationKeys = ['Escape', 'ArrowDown', 'ArrowUp', 'Enter', 'Tab'];
    const isNavigationKey = navigationKeys.includes(event.key);
    
    // Only prevent default for navigation keys to allow normal typing
    if (isNavigationKey) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Handle different key presses
    switch (event.key) {
      case 'Escape': // ESC key - clear search and remove focus
        this.clearSearch(event, false);
        break;
        
      case 'ArrowDown': // Down arrow - move selection down
        if (this.searchResults.length > 0 || this.recentSearches.length > 0) {
          this.handleArrowNavigation(1);
        }
        break;
        
      case 'ArrowUp': // Up arrow - move selection up
        if (this.searchResults.length > 0 || this.recentSearches.length > 0) {
          this.handleArrowNavigation(-1);
        }
        break;
        
      case 'Enter': // Enter key - navigate to selected result or trigger search
        if (this.activeResultIndex >= 0) {
          // If there's an active result, navigate to it
          this.navigateToSelectedResult();
        }
        // Let the default behavior handle form submission if needed
        break;
        
      case 'Tab': // Tab key - handle tab navigation
        if (this.activeResultIndex >= 0) {
          event.preventDefault(); // Prevent default tab behavior
          this.navigateToSelectedResult();
        }
        break;
        
      default:
        // For other keys, ensure recent searches are shown when appropriate
        this.showRecentSearches = !this.searchControl.value && this.recentSearches.length > 0;
        // Reset active index when user starts typing
        this.activeResultIndex = -1;
        break;
    }
  }

  /**
   * Handles selection of a search result
   * Navigates to the selected result's path and updates the UI
   * @param result The selected search result to navigate to
   */
  selectResult(result: SearchResult): void {
    // Log the navigation attempt
    LOG.debug('Navigating to search result', { 
      path: result?.path,
      title: result?.title
    });
    
    // Extract the path from the result, ensuring file extension is included
    const resultPath = result?.path;
    
    // Validate the result and path
    if (!result || !resultPath) {
      LOG.error('No result or path provided for navigation', {
        hasResult: !!result,
        hasPath: !!resultPath
      });
      return;
    }
    
    try {
      // Normalize the target path
      let targetPath = resultPath.trim()
        // Remove any leading/trailing slashes for consistency
        .replace(/^\/+|\/+$/g, '');
      
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
        targetPath: targetPath
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
   * Navigates to the selected search result or recent search based on the active index.
   * Handles both search results and recent searches, with proper bounds checking.
   * 
   * If the active index is invalid or out of bounds, the method will do nothing.
   * For search results, it will navigate to the selected result.
   * For recent searches, it will trigger a new search with the selected term.
   */
  private navigateToSelectedResult(): void {
    // Ignore if no item is selected
    if (this.activeResultIndex < 0) {
      return;
    }

    try {
      const totalResults = this.searchResults.length;
      const totalRecentSearches = this.recentSearches.length;
      const totalItems = totalResults + totalRecentSearches;

      // Validate active index is within bounds
      if (this.activeResultIndex >= totalItems) {
        LOG.warn('Active index is out of bounds', {
          activeIndex: this.activeResultIndex,
          totalItems
        });
        return;
      }

      // Handle search result selection
      if (this.activeResultIndex < totalResults) {
        const result = this.searchResults[this.activeResultIndex];
        if (result) {
          this.selectResult(result);
        } else {
          LOG.error('Search result at index is undefined', {
            index: this.activeResultIndex,
            totalResults
          });
        }
      } 
      // Handle recent search selection
      else if (totalRecentSearches > 0) {
        const recentIndex = this.activeResultIndex - totalResults;
        if (recentIndex >= 0 && recentIndex < totalRecentSearches) {
          const searchTerm = this.recentSearches[recentIndex];
          if (searchTerm) {
            this.selectRecentSearch(searchTerm);
          } else {
            LOG.error('Recent search term at index is undefined', {
              recentIndex,
              totalRecentSearches
            });
          }
        }
      }
    } catch (error) {
      LOG.error('Error navigating to selected result', {
        error: error instanceof Error ? error.message : 'Unknown error',
        activeIndex: this.activeResultIndex,
        searchResultsCount: this.searchResults.length,
        recentSearchesCount: this.recentSearches.length
      });
    }
  }
}
