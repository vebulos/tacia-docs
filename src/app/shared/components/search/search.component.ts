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

  constructor() {
    this.searchConfig = environment?.search || DEFAULT_SEARCH_CONFIG;
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
    
    console.log('selectRecentSearch called with term:', term);
    if (!term) {
      console.log('No term provided, returning');
      return;
    }
    
    console.log('Setting up search for term:', term);
    
    // Set the search value without triggering events to avoid conflicts
    this.searchControl.setValue(term, { emitEvent: false });
    
    // Keep the recent searches visible during search
    this.showRecentSearches = true;
    this.searchResults = [];
    this.isLoading = true;
    
    console.log('Calling search service');
    this.searchService.search(term).subscribe({
      next: (results: SearchResult[]) => this.handleSearchResults(results),
      error: (error: Error) => this.handleSearchError(error)
    });
    
    this.activeResultIndex = -1;
    console.log('selectRecentSearch completed');
  }

  clearRecentSearches(event: Event): void {
    event.stopPropagation();
    this.searchService.clearRecentSearches();
    this.recentSearches = [];
  }

  /**
   * Clears the search input and results
   */
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

  /**
   * Adds a term to the current search query
   * @param term The term to add to the search
   */
  addSearchTerm(term: string): void {
    if (!term) return;
    
    const currentValue = this.searchControl.value || '';
    const terms = currentValue.split(' ').filter(t => t.trim() !== '');
    
    // Add the term if it's not already in the search
    if (!terms.includes(term)) {
      terms.push(term);
      const newSearch = terms.join(' ');
      this.searchControl.setValue(newSearch);
      // Trigger search
      this.searchService.search(newSearch);
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
        console.log('Content and search index refreshed successfully');
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.clearAll(); // Clear any previous notifications
        const errorMessage = error?.message || 'An error occurred while updating the content and index';
        this.notificationService.error(`Error: ${errorMessage}`, 7000);
        console.error('Error refreshing content and search index:', error);
      }
    });
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

  selectResult(result: any): void {
    console.log('Navigating to result:', result);
    
    // Use the path which now includes the extension for files
    const resultPath = result.path;
    
    if (!result || !resultPath) {
      console.error('No result or path provided for navigation');
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
      
      console.log('Formatted path for navigation:', targetPath);
      console.log('Using base paths removed, targetPath:', targetPath);
      
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

  private handleSearchError(error: Error): void {
    console.error('Search error:', error);
    this.error = error?.message || 'An error occurred while searching';
    this.isLoading = false;
    this.showRecentSearches = true;
    
    // Use the notification service if available
    if (this.notificationService && typeof this.notificationService.show === 'function') {
      this.notificationService.show(this.error, 'error');
    } else {
      console.error('Notification service not available or show method not found');
    }
  }
}
