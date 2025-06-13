import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { PathUtils } from '@app/core/utils/path.utils';
import { ContentService } from '../../../../core/services/content.service';
import { ContentItem } from '../../../../core/services/content.interface';
import { map, filter, takeUntil } from 'rxjs/operators';
import { NavigationItemComponent, NavigationItem } from './navigation-item.component';
import { SearchComponent as DocsSearchComponent } from '../search/search.component';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, NavigationItemComponent, DocsSearchComponent],
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

  constructor(
    private contentService: ContentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRootContent();
    
    // Update active states on route changes
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateActiveStates();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearAllHoverTimers();
  }
  
  private clearAllHoverTimers(): void {
    this.hoverTimers.forEach(timerId => clearTimeout(timerId));
    this.hoverTimers.clear();
  }

  loadRootContent(): void {
    this.loading = true;
    this.error = null;
    
    this.contentService.getContent('').subscribe({
      next: (items: ContentItem[]) => {
        if (!items || !Array.isArray(items)) {
          console.warn('Received invalid root content items:', items);
          items = [];
        }
        
        try {
          // Ensure paths are properly formatted
          const processedItems = items.map(item => ({
            ...item,
            path: item.path ? item.path.replace(/^content\//, '') : item.path
          }));
          
          this.contentStructure = this.transformContentItems(processedItems);
          
console.log('++++++++++ Root content loaded successfully:', this.contentStructure);


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
  
  private transformContentItems(items: ContentItem[]): NavigationItem[] {
    if (!items) return [];
    
    const navItems = items.map(item => {
      // Use the path which now includes the extension for files
      const cleanPath = item.path || '';
      
      return {
        ...item,
        path: cleanPath,
        isOpen: false,
        isLoading: false,
        hasError: false,
        childrenLoaded: false,
        children: item.isDirectory ? [] : undefined
      };
    });
    
    // Items are already sorted by the server (files first, then directories)
    return navItems;
  }

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
    const docsBase = PathUtils.DOCS_BASE_PATH;
    this.activePath = url.startsWith(`${docsBase}/`) 
      ? PathUtils.normalizePath(url.substring(docsBase.length + 1))
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
      
      // Check if any child is active
      if (item.children && item.children.length > 0) {
        const childIsActive = this.setActiveStates(item.children, currentPath);
        if (childIsActive) {
          item.isOpen = true;
          isActive = true;
        }
      }
      
      // Check if current item is active
      if (!isActive && item.path) {
        // Make sure we're matching the full segment to avoid partial matches
        const itemPath = item.path.endsWith('/') ? item.path : `${item.path}/`;
        isActive = currentPath === item.path || 
                  currentPath.startsWith(itemPath);
      }
      
      return isActive;
    });
  }

  trackByFn(index: number, item: NavigationItem): string {
    return item.path || index.toString();
  }
}
