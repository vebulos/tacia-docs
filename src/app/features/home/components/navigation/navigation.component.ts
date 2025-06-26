import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { take } from 'rxjs/operators';
import { NavigationStateService } from '../../services/navigation-state.service';
import { PathUtils } from '@app/core/utils/path.utils';
import { ContentService } from '../../../../core/services/content.service';
import { ContentItem } from '../../../../core/services/content.interface';
import { map, filter, takeUntil, tap } from 'rxjs/operators';
import { NavigationItemComponent, NavigationItem } from './navigation-item.component';

import { Subject } from 'rxjs';
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
    // Listen for active category changes
    this.navigationState.activeCategory$.subscribe(activePath => {
      if (activePath) {
        this.scheduleCloseOtherCategories(activePath);
      }
    });
  }

  ngOnInit(): void {
    this.loadRootContent();
    
    // Update active states on route changes
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateActiveStates();
    });
    
    // Subscribe to refresh requests
    this.refreshService.refreshRequested$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      console.log('Refresh requested, reloading navigation content...');
      this.refreshContent();
    });
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
    console.log('[NavigationComponent] Refreshing content with cache clearing');
    
    // Vider le cache du contenu racine avant de recharger
    this.contentService.clearCache('').pipe(
      take(1) // Take only the first emission and complete
    ).subscribe({
      next: () => {
        console.log('[NavigationComponent] Cache cleared, loading fresh content');
        // Use skipCache=true to force a fresh request
        this.loadRootContent(true);
      },
      error: (err) => {
        console.error('[NavigationComponent] Error clearing cache:', err);
        // Still load the content in case of error with skipCache=true
        this.loadRootContent(true);
      }
    });
  }

  private clearAllHoverTimers(): void {
    this.hoverTimers.forEach(timerId => clearTimeout(timerId));
    this.hoverTimers.clear();
  }

  /**
   * Charge le contenu racine de la documentation
   * @param skipCache Indique si le cache doit être ignoré
   * @public
   */
  public loadRootContent(skipCache: boolean = true): void {
    this.loading = true;
    this.error = null;
    
    console.log(`[NavigationComponent] Loading root content with skipCache=${skipCache}`);
    console.log('[NavigationComponent] Calling contentService.getContent()');
    this.contentService.getContent('', skipCache).pipe(
      tap(items => console.log('[NavigationComponent] Received items from contentService:', items))
    ).subscribe({
      next: (items: ContentItem[]) => {
        console.log('[NavigationComponent] ContentService response received, items count:', items?.length);
        console.log('[NavigationComponent] First few items:', items?.slice(0, 3));
        
        if (!items || !Array.isArray(items)) {
          console.error('[NavigationComponent] Received invalid root content items:', items);
          items = [];
        } else {
          console.log('[NavigationComponent] Items structure:', JSON.stringify(items, null, 2).substring(0, 500) + '...');
        }
        
        try {
          // Ensure paths are properly formatted
          const processedItems = items.map(item => ({
            ...item,
            path: item.path ? item.path.replace(/^content\//, '') : item.path
          }));
          
          this.contentStructure = this.transformContentItems(processedItems);
          
          this.loading = false;
          
          // Update active states after loading
          this.updateActiveStates();
          
          console.log('Root content loaded successfully:', this.contentStructure);
        } catch (error) {
          console.error('Error transforming root content items:', error);
          this.handleChildLoadError({ path: '' } as NavigationItem, 'Failed to process content structure.');
        }
      },
      error: (error: Error) => {
        console.error('Failed to load root content:', error);
        this.handleChildLoadError({ path: '' } as NavigationItem, 'Failed to load documentation structure. Please try again later.');
      }
    });
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

  private handleChildLoadError(parentItem: NavigationItem, error: any): void {
    parentItem.isLoading = false;
    parentItem.hasError = true;
    parentItem.children = []; // Ensure children is always an array
    
    // If this is the root item, set the error message
    if (parentItem.path === '') {
      this.error = typeof error === 'string' ? error : 'An error occurred while loading content.';
      this.loading = false;
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

  // Update active states based on current route
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
