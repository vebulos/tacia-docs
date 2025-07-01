import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { take, catchError, map, filter, takeUntil, tap } from 'rxjs/operators';
import { NavigationStateService } from '../../services/navigation-state.service';
import { PathUtils } from '@app/core/utils/path.utils';
import { ContentService } from '../../../../core/services/content.service';
import { ContentItem } from '../../../../core/services/content.interface';
import { NavigationItemComponent, NavigationItem } from './navigation-item.component';
import { RefreshService } from '@app/core/services/refresh/refresh.service';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, NavigationItemComponent],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private hoverTimers = new Map<string, any>();
  private currentPath: string = '';
  
  contentStructure: NavigationItem[] = [];
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
    // Écouter les changements de catégorie active
    this.navigationState.activeCategory$.subscribe(activePath => {
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
    console.log('Loading initial path:', initialPath);
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
      const path = this.getPathFromNavigationEvent(event);
      console.log('Navigation detected to path:', path);
      this.loadContentForPath(path);
      this.updateActiveStates();
    });
  }

  /**
   * Sets up the refresh listener
   */
  private setupRefreshListener(): void {
    this.refreshService.refreshRequested$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      console.log('Refresh requested, reloading navigation content...');
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

    // Extract the first segment of the path for the parent directory
    const segments = path.split('/');
    const parentPath = segments[0];
    
    if (parentPath) {
      this.loadRootContent(true, parentPath);
    } else {
      this.loadRootContent();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearAllHoverTimers();
    this.navigationState.setActiveCategory(null);
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
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
   * Rafraîchit le contenu de la navigation en vidant d'abord le cache
   * @public
   */
  public refreshContent(): void {
    console.log('[NavigationComponent] Refreshing content for current directory:', this.currentPath);
    
    // Vider le cache pour le répertoire actuel avant de recharger
    this.contentService.clearCache(this.currentPath).pipe(
      take(1)
    ).subscribe({
      next: () => {
        console.log(`[NavigationComponent] Cache cleared for directory "${this.currentPath}", loading fresh content`);
        // Utiliser skipCache=true pour forcer une nouvelle requête
        this.loadRootContent(true, this.currentPath);
      },
      error: (err) => {
        console.error('[NavigationComponent] Error clearing cache:', err);
        // Charger quand même le contenu en cas d'erreur avec skipCache=true
        this.loadRootContent(true, this.currentPath);
      }
    });
  }

  private clearAllHoverTimers(): void {
    this.hoverTimers.forEach(timerId => clearTimeout(timerId));
    this.hoverTimers.clear();
  }

  /**
   * Charge le contenu pour un répertoire spécifique
   * @param skipCache Indique si le cache doit être ignoré
   * @param directory Le chemin du répertoire à charger (vide pour la racine)
   * @public
   */
  public loadRootContent(skipCache: boolean = true, directory: string = ''): void {
    this.loading = true;
    this.error = null;
    this.currentPath = directory;
    
    console.log(`[NavigationComponent] Loading content for directory: "${directory}" with skipCache=${skipCache}`);
    
    this.getRootContentItems(skipCache, directory).subscribe({
      next: (items) => {
        this.contentStructure = items;
        this.loading = false;
        this.updateActiveStates();
        console.log(`Content loaded successfully for directory: ${directory}`);
      },
      error: (error) => {
        console.error(`Failed to load content for directory "${directory}":`, error);
        this.handleChildLoadError({ path: directory } as NavigationItem, 'Failed to load content structure.');
        this.loading = false;
      }
    });
  }

  public getRootContentItems(skipCache: boolean = true, directory: string = ''): Observable<NavigationItem[]> {
    return this.contentService.getContent(directory, skipCache).pipe(
      tap(items => console.log(`[NavigationComponent] Received items for directory "${directory}":`, items?.length)),
      map((items: ContentItem[] = []) => {
        if (!Array.isArray(items)) {
          console.error('[NavigationComponent] Received invalid content items');
          return [];
        }
        
        // Traitement des chemins
        const processedItems = items.map(item => {
          // Si nous sommes dans un sous-dossier, nous devons conserver le chemin complet
          const fullPath = directory ? 
            `${directory}${directory.endsWith('/') ? '' : '/'}${item.path}`.replace(/\/+/g, '/') : 
            item.path;
          return {
            ...item,
            path: fullPath
          };
        });

        return this.transformContentItems(processedItems);
      }),
      catchError(error => {
        console.error('[NavigationComponent] Error loading root content:', error);
        return of([] as NavigationItem[]);
      })
    );
  }
  

  /**
   * Transforms content items to navigation items with proper sorting and structure
   * This should match the transformation logic in the parent NavigationComponent
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
      const isDirectory = item.isDirectory;
      return {
        ...item,
        isOpen: false, // Will be set by the subscription
        isLoading: false,
        hasError: false,
        childrenLoaded: false,
        children: isDirectory ? [] : undefined
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
          console.warn(`Received invalid items for path ${path}:`, items);
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
          
          console.log(`Loaded ${items.length} items for path ${path}`);
        } catch (error) {
          console.error('Error transforming child items:', error);
          this.handleChildLoadError(parentItem, error);
        }
      },
      error: (error: Error) => {
        console.error(`Failed to load child items for path ${path}:`, error);
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
      this.error = typeof error === 'string' ? error : 'An error occurred while loading content.';
      this.loading = false;
      console.error('Error loading navigation content:', error);
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
      
    this.setActiveStates(this.contentStructure, this.activePath);
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
