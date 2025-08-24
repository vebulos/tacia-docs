import { Component, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { take, catchError, map, filter, takeUntil, tap } from 'rxjs/operators';
import { NavigationStateService } from '../../services/navigation-state.service';
import { PathUtils } from '@app/core/utils/path.utils';
import { ContentService } from '@app/core/services/content.service';
import { ContentItem } from '@app/core/services/content.interface';
import { NavigationItemComponent, NavigationItem } from './navigation-item.component';
import { RefreshService } from '@app/core/services/refresh/refresh.service';
import { getLogger } from '@app/core/services/logging/logger';
const LOG = getLogger('NavigationComponent');

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, NavigationItemComponent],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent implements OnInit, OnDestroy {
  @Output() itemsChange = new EventEmitter<any[]>();
  private destroy$ = new Subject<void>();
  private hoverTimers = new Map<string, any>();
  private currentPath: string = '';
  
  public items: NavigationItem[] = [];
  loading = true;
  error: string | null = null;
  activePath = '';
  navItems: any[] = [];
  private closeTimer: any = null;

  constructor(
    private contentService: ContentService,
    private router: Router,
    private navigationState: NavigationStateService,
    private refreshService: RefreshService
  ) {
    // Listen for active path changes
    this.navigationState.activePath$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(activePath => {
      if (activePath) {
        this.scheduleCloseOtherCategories(activePath);
      }
    });
  }

  ngOnInit(): void {
    // Load content immediately for the current URL
    this.loadInitialContent();
    
    // Then subscribe to future navigation changes
    this.setupNavigationListener();
    
    // Subscribe to refresh requests
    this.setupRefreshListener();
  }

  /**
   * Loads content for the current URL path
   */
  private loadInitialContent(): void {
    const initialPath = this.getCurrentPathFromUrl();
    this.loadContentForPath(initialPath);
    this.updateActiveStates();
  }

  /**
   * Sets up the navigation event listener
   */
  private setupNavigationListener(): void {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(event => {
      // Check if navigation event has skipReload state
      const navigation = this.router.getCurrentNavigation();
      const skipReload = navigation?.extras?.state?.['skipReload'] || false;
      
      const path = this.getPathFromNavigationEvent(event);
      this.activePath = path;
      this.setActivePath(path);
      
      // Only reload content if skipReload is not set
      if (!skipReload) {
        this.loadContentForPath(path);
        this.updateActiveStates();
      }
    });
  }

  /**
   * Sets up the refresh listener
   */
  private setupRefreshListener(): void {
    this.refreshService.refreshRequested$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.refreshContent();
    });
  }

  /**
   * Extracts the current path from the router URL
   */
  private getCurrentPathFromUrl(): string {
    const url = this.router.url;
    return url.startsWith('/') ? url.substring(1) : url;
  }

  /**
   * Extracts the path from a NavigationEnd event
   */
  private getPathFromNavigationEvent(event: NavigationEnd): string {
    const url = event.urlAfterRedirects || event.url;
    return url.startsWith('/') ? url.substring(1) : url;
  }
  
  /**
   * Loads content for a specific path
   */
  private loadContentForPath(path: string): void {
    if (!path) {
      this.loadRootContent();
      return;
    }

    // For directory paths, load the content of that directory
    // For file paths, load the content of the parent directory
    const segments = path.split('/');
    
    // If it's a single segment (root level), load that directory's content
    if (segments.length === 1) {
      this.loadRootContent(true, path);
    } else {
      // For nested paths, load the parent directory content
      const parentPath = segments[0];
      this.loadRootContent(true, parentPath);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.clearAllHoverTimers();
    this.navigationState.setActivePath(null);
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
  }

  /**
   * Set the active path in the navigation state
   */
  private setActivePath(path: string | null): void {
    this.navigationState.setActivePath(path);
  }

  private scheduleCloseOtherCategories(activePath: string): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
    
    this.closeTimer = setTimeout(() => {
      this.closeItemsNotInPath(activePath);
      this.closeTimer = null;
    }, 1000); // 1 second delay
  }

  private closeItemsNotInPath(activePath: string): void {
    const closeRecursive = (items: any[]) => {
      if (!items) return;
      
      for (const item of items) {
        if (item.isDirectory && item.isOpen) {
          // Close if not the active item and not a parent of the active item
          if (item.path !== activePath && !activePath.startsWith(item.path + '/')) {
            item.isOpen = false;
          }
          // Recurse into children
          if (item.children) {
            closeRecursive(item.children);
          }
        }
      }
    };

    closeRecursive(this.navItems);
  }
  
  /**
   * Refreshes the navigation content by first clearing the cache
   * @public
   */
  public refreshContent(): void {
    LOG.debug('Refreshing navigation content', { 
      directory: this.currentPath || 'root',
      url: this.router.url
    });
    
    // Clear cache for the current directory before reloading
    this.contentService.clearCache(this.currentPath).pipe(
      take(1)
    ).subscribe({
      next: () => {
        LOG.debug('Cache cleared, loading fresh navigation content', { 
          directory: this.currentPath || 'root' 
        });
        // Use skipCache=true to force a new request
        this.loadRootContent(true, this.currentPath);
      },
      error: (err) => {
        LOG.error('Error clearing navigation cache', { 
          directory: this.currentPath,
          error: err.message || 'Unknown error',
          stack: err.stack
        });
        // Still load content with skipCache=true in case of error
        this.loadRootContent(true, this.currentPath);
      }
    });
  }

  private clearAllHoverTimers(): void {
    this.hoverTimers.forEach(timerId => clearTimeout(timerId));
    this.hoverTimers.clear();
  }

  /**
   * Loads content for a specific directory
   * @param skipCache Whether to ignore the cache
   * @param directory The directory path to load (empty for root)
   * @public
   */
  public loadRootContent(skipCache: boolean = true, directory: string = ''): void {
    this.loading = true;
    this.error = null;
    this.currentPath = directory;
    
    LOG.debug('Loading directory content', {
      directory: directory || 'root',
      skipCache,
      url: this.router.url
    });
    
    this.getRootContentItems(skipCache, directory).subscribe({
      next: (items) => {
        this.updateItems(items);
        LOG.debug('Directory content loaded successfully', {
          directory: directory || 'root',
          itemCount: items?.length || 0
        });
      },
      error: (error) => {
        LOG.error('Failed to load directory content', {
          directory: directory || 'root',
          error: error.message || 'Unknown error',
          stack: error.stack
        });
        this.handleChildLoadError({ path: directory } as NavigationItem, 'Failed to load content structure.');
        this.loading = false;
        // Emit empty items on error to update sidebar visibility
        this.itemsChange.emit([]);
      }
    });
  }

  public getRootContentItems(skipCache: boolean = true, directory: string = ''): Observable<NavigationItem[]> {
    LOG.debug('Fetching root content items', { 
      directory: directory || 'root',
      skipCache 
    });
    
    return this.contentService.getContent(directory, skipCache).pipe(
      tap(items => {
        LOG.debug('Received content items', {
          directory: directory || 'root',
          itemCount: items?.length || 0
        });
      }),
      map((items: ContentItem[] = []) => {
        if (!Array.isArray(items)) {
          LOG.error('Received invalid content items', { 
            directory: directory || 'root',
            receivedType: typeof items 
          });
          return [];
        }
        
        LOG.debug('Transforming content items', {
          directory: directory || 'root',
          itemCount: items.length
        });
        
        // Transform items to navigation items with proper structure
        const transformedItems = this.transformContentItems(items);
        
        // Add parentPath to each item, but only if needed
        return transformedItems.map(item => {
          // Clean paths for comparison
          const cleanItemPath = (item.path || '').toLowerCase().trim();
          const cleanDirectory = (directory || '').toLowerCase().trim();
          
          // Only add parentPath if the item path doesn't already include the directory
          const needsParentPath = !cleanDirectory || !cleanItemPath.startsWith(cleanDirectory);
          
          LOG.debug('Processing navigation item path', {
            itemName: item.name,
            itemPath: item.path,
            directory,
            addingParentPath: needsParentPath
          });
          
          return {
            ...item,
            // Only set parentPath if needed to avoid path duplication
            parentPath: needsParentPath ? directory : undefined
          };
        });
      }),
      catchError(error => {
        LOG.error('Error loading root content', {
          directory: directory || 'root',
          error: error.message || 'Unknown error',
          stack: error.stack
        });
        return of([] as NavigationItem[]);
      })
    );
  }
  

  /**
   * Transforms content items to navigation items with proper sorting and structure
   * @param items The content items to transform
   */
  private transformContentItems(items: ContentItem[]): NavigationItem[] {
    if (!items) return [];
    
    // Sort items: files first, then directories
    const sortedItems = [...items].sort((a, b) => {
      // If one is a directory and the other is not, the file comes first
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? 1 : -1; // Files (false) come before directories (true)
      }
      // If both are the same type, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
    
    return sortedItems.map(item => {
      LOG.debug('Transforming navigation item', {
        path: item.path,
        isDirectory: item.isDirectory,
        name: item.name
      });
      
      return {
        ...item,
        isOpen: false,
        isLoading: false,
        hasError: false,
        childrenLoaded: false,
        children: item.isDirectory ? [] : undefined
      };
    });
  }

  /**
   * Handles the hover event on a navigation item
   * @param item The navigation item to handle hover for
   */
  onItemHover(item: NavigationItem): void {
    if (!item.isDirectory || item.childrenLoaded || item.isLoading) {
      return;
    }

    // Clear any existing timer for this item
    if (this.hoverTimers.has(item.path)) {
      clearTimeout(this.hoverTimers.get(item.path));
    }

    // Set a new timer
    const timerId = setTimeout(() => {
      this.loadChildItems(item);
      this.hoverTimers.delete(item.path);
    }, 300);

    this.hoverTimers.set(item.path, timerId);
  }

  onItemLeave(item: NavigationItem): void {
    if (this.hoverTimers.has(item.path)) {
      clearTimeout(this.hoverTimers.get(item.path));
      this.hoverTimers.delete(item.path);
    }
  }

  private loadChildItems(parentItem: NavigationItem): void {
    if (!parentItem || !parentItem.isDirectory || parentItem.isLoading || parentItem.childrenLoaded) {
      return;
    }

    parentItem.isLoading = true;
    parentItem.hasError = false;
    
    // Ensure we have a valid path
    const path = parentItem.path || '';

    this.contentService.getContent(path).subscribe({
      next: (items: ContentItem[]) => {
        if (!items || !Array.isArray(items)) {
          LOG.warn('Received invalid items for path', { 
            path,
            receivedType: items === null ? 'null' : typeof items
          });
          items = [];
        }
        
        try {
          // Transform all items, but only include files in the children
          // Directories will be loaded on demand when expanded
          const transformedItems = this.transformContentItems(items);
          parentItem.children = transformedItems;
          parentItem.isLoading = false;
          parentItem.childrenLoaded = true;
          parentItem.isOpen = true; // Auto-expand after loading
          
          // Update the view
          this.updateActiveStates();
          
          LOG.debug('Successfully loaded child items', {
            parentPath: path,
            childCount: items.length,
            hasDirectories: items.some(i => i.isDirectory)
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          LOG.error('Error transforming child items', {
            parentPath: path,
            error: errorMessage,
            stack: errorStack
          });
          this.handleChildLoadError(parentItem, error);
        }
      },
      error: (error: Error) => {
        LOG.error('Failed to load child items', {
          parentPath: path,
          error: error.message || 'Unknown error',
          stack: error.stack
        });
        this.handleChildLoadError(parentItem, error);
      }
    });
  }

  /**
   * Handles errors that occur when loading child items
   * @param parentItem The parent item that failed to load children
   * @param error The error that occurred
   */
  private handleChildLoadError(parentItem: NavigationItem, error: any): void {
    if (parentItem) {
      parentItem.isLoading = false;
      parentItem.hasError = true;
      parentItem.children = []; // Ensure children is always an array
    }
    
    // If this is the root item or no parent item, set the error message
    if (!parentItem || parentItem.path === '') {
      const errorMessage = typeof error === 'string' ? error : 'An error occurred while loading content.';
      this.error = errorMessage;
      this.loading = false;
      
      const errorObj = error instanceof Error ? error : undefined;
      LOG.error('Error loading root navigation content', {
        error: errorMessage,
        stack: errorObj?.stack
      });
    }
  }

  toggleItem(event: Event, item: NavigationItem): void {
    if (!item) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    if (item.isDirectory) {
      if (!item.childrenLoaded && !item.isLoading) {
        this.loadChildItems(item);
      } else if (item.childrenLoaded) {
        // Only toggle open/close if children are already loaded
        item.isOpen = !item.isOpen;
      }
    }
      
    this.setActiveStates(this.items, this.activePath);
  }

  private updateItems(newItems: NavigationItem[]): void {
    this.items = newItems;
    this.loading = false;
    // Always emit items change, even if empty
    this.itemsChange.emit(newItems || []);
    this.updateActiveStates();
  }

  /**
   * Updates the active states of navigation items based on the current route
   */
  private updateActiveStates(): void {
    if (!this.router.navigated) return;
    
    const url = this.router.url;
    const homeBase = '';
    this.activePath = url.startsWith(`${homeBase}/`) 
      ? PathUtils.normalizePath(url.substring(homeBase.length + 1))
      : '';
      
    this.setActiveStates(this.items, this.activePath);
  }

  private setActiveStates(items: NavigationItem[], currentPath: string): boolean {
    if (!items || !Array.isArray(items)) {
      return false;
    }

    return items.some(item => {
      if (!item) return false;
      
      let isActive = false;
      const itemPath = item.path || '';
      
      // Check if this item is in the active path
      const isInPath = currentPath === itemPath || 
                      (itemPath && currentPath.startsWith(itemPath + '/'));
      
      // Si c'est un dossier dans le chemin, charger ses enfants
      if (isInPath && item.isDirectory && !item.childrenLoaded && !item.isLoading) {
        this.loadChildItems(item);
      }
      
      // Check if a child is active
      if (item.children && item.children.length > 0) {
        const childIsActive = this.setActiveStates(item.children, currentPath);
        if (childIsActive) {
          item.isOpen = true;
          isActive = true;
        }
      }
      
      // Check if the current item is active
      if (!isActive && itemPath) {
        isActive = currentPath === itemPath || 
                  (itemPath ? currentPath.startsWith(itemPath + '/') : false);
      }
      
      return isActive;
    });
  }

  trackByFn(index: number, item: NavigationItem): string {
    return item.path || index.toString();
  }
}
