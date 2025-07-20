import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService } from '@app/core/services/content.service';
import { ContentItem } from '@app/core/services/content.interface';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject, takeUntil, take } from 'rxjs';
import { PathUtils } from '@app/core/utils/path.utils';
import { NavigationStateService } from '../../services/navigation-state.service';
import { LOG } from '@app/core/services/logging/bun-logger.service';

// Extend the ContentItem with navigation-specific properties
export interface NavigationItem extends ContentItem {
  isOpen?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  childrenLoaded?: boolean;
  children?: NavigationItem[];
  parentPath?: string; // Parent directory path for relative paths
  isActive?: boolean;
}

@Component({
  selector: 'app-navigation-item',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation-item.component.html',
  styleUrls: ['./navigation-item.component.css'],
  host: {
    '[attr.level]': 'level',
    '[class]': '"level-" + level'
  },
  animations: [
    trigger('slideInOut', [
      state('expanded', style({
        height: '*',
        opacity: 1,
        visibility: 'visible'
      })),
      state('collapsed', style({
        height: '0',
        opacity: 0,
        visibility: 'hidden',
        overflow: 'hidden'
      })),
      transition('expanded <=> collapsed', [
        animate('200ms ease-in-out')
      ])
    ])
  ]
})
export class NavigationItemComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private hoverTimer: any = null;
  
  // Variable to track which categories are currently in the process of opening
  // This variable is static to be accessible to all component instances
  private static openingItems: Set<string> = new Set<string>();
  
  @Input() item!: NavigationItem;
  @Input() level: number = 0;
  @Input() activePath: string = '';

  constructor(
    private contentService: ContentService,
    private navigationState: NavigationStateService
  ) {}
  
  private closeTimer: any = null;

    ngOnInit(): void {
    if (!this.item) return;

    // Load children for initially open item
    if (this.item.isOpen && !this.item.childrenLoaded && !this.item.isLoading) {
      this.loadChildren();
    }
  }
  
  toggleItem(event: Event, forceOpen: boolean | null = null): void {
    if (!this.item.isDirectory) return;
    
    event.stopPropagation();
    
    // If the category is in the process of opening, prevent it from being closed
    if (NavigationItemComponent.openingItems.has(this.item.path) && forceOpen === false) {
      LOG.debug('Preventing close during opening', {
        path: this.item.path,
        itemName: this.item.name
      });
      return;
    }
    
    // Calculate the new open state
    const willBeOpen = forceOpen !== null ? forceOpen : !this.item.isOpen;
    
    // Update the active path in the service
    if (willBeOpen) {
      this.navigationState.setActivePath(this.item.path);
      
      // Open the category immediately
      if (!this.item.isOpen) {
        this.item.isOpen = true;
        if (!this.item.childrenLoaded && !this.item.isLoading) {
          this.loadChildren();
        }
      }
      
      // Close other categories after a delay
      this.scheduleCloseOtherCategories();
    } else {
      this.navigationState.setActivePath(null);
      this.item.isOpen = false;
    }
  }
  
  private scheduleCloseOtherCategories(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
    
    this.closeTimer = setTimeout(() => {
      // This will be handled by the parent component
      this.closeTimer = null;
    }, 1000);
  }
  
  private loadChildren(): void {
    if (!this.item.path) return;
    
    this.item.isLoading = true;
    this.item.hasError = false;
    
    this.contentService.getContent(this.item.path).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (children: ContentItem[]) => {
        // Transform the children items to ensure consistent structure
        const transformedChildren = this.transformContentItems(children || []);
        
        // Set parentPath for each child, but only if needed
        transformedChildren.forEach(child => {
          // Avoid setting parentPath if the child path already includes the parent path
          // This prevents path duplication in getNavigationLink
          const cleanChildPath = child.path?.toLowerCase().trim() || '';
          const cleanParentPath = this.item.path?.toLowerCase().trim() || '';
          
          if (!cleanChildPath.startsWith(cleanParentPath)) {
            // Only set parentPath if the child path doesn't already include parent path
            child.parentPath = this.item.path;
            LOG.debug('Setting parentPath for child', {
              childName: child.name,
              childPath: child.path,
              parentPath: this.item.path
            });
          } else {
            LOG.debug('Child path already contains parent path, not setting parentPath', {
              childName: child.name,
              childPath: child.path,
              parentPath: this.item.path
            });
          }
        });
        
        this.item.children = transformedChildren;
        this.item.childrenLoaded = true;
        this.item.isLoading = false;
      },
      error: (error: any) => {
        LOG.error('Error loading navigation item children', {
          parentPath: this.item.path,
          parentName: this.item.name,
          error: error.message || 'Unknown error',
          stack: error.stack
        });
        this.item.hasError = true;
        this.item.isLoading = false;
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
    
    return sortedItems.map(item => ({
      ...item,
      isOpen: false,
      isLoading: false,
      hasError: false,
      childrenLoaded: false,
      children: item.isDirectory ? [] : undefined
    }));
  }

  trackByFn(index: number, item: NavigationItem): string {
    return item.path || index.toString();
  }

  get hasChildren(): boolean {
    return !!this.item.children?.length;
  }

  get paddingLeft(): string {
    return `${this.level * 12}px`;
  }

  get isActive(): boolean {
    return this.activePath.startsWith(this.item.path);
  }
  
  onMouseEnter(event: MouseEvent): void {
    if (!this.item.isDirectory || this.item.isLoading) {
      return;
    }

    // If already open, no need to do anything
    if (this.item.isOpen) return;

    // Clear any existing timer
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
    }
    
    // Mark this category as currently opening
    if (this.item.path) {
      LOG.debug('Marking navigation item as opening', {
        path: this.item.path,
        name: this.item.name
      });
      NavigationItemComponent.openingItems.add(this.item.path);
    }

    // Set a new timer
    this.hoverTimer = setTimeout(() => {
      this.toggleItem(event, true); // Force open on hover
      this.hoverTimer = null;
      
      // After a short delay, reset the opening state
      setTimeout(() => {
        if (this.item.path) {
          LOG.debug('Unmarking navigation item as opening', {
            path: this.item.path,
            name: this.item.name
          });
          NavigationItemComponent.openingItems.delete(this.item.path);
        }
      }, 1000); // Longer delay to prevent accidental clicks
    }, 500); // 500ms delay before opening on hover
  }

  onMouseLeave(event: MouseEvent): void {
    // Clear the timer if mouse leaves before it triggers
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
      
      // Reset the opening state if mouse leaves before opening completes
      if (this.item.path) {
        NavigationItemComponent.openingItems.delete(this.item.path);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
    }
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
    
    // Reset the opening state if mouse leaves before opening completes
    if (this.item.path) {
      NavigationItemComponent.openingItems.delete(this.item.path);
    }
  }

  /**
   * Get the navigation link with state for a navigation item
   * Handles both relative and absolute paths correctly
   */
  getNavigationLink(item: NavigationItem): { link: string[], state: any } {
    LOG.debug('Building navigation link', {
      itemName: item.name,
      isDirectory: item.isDirectory,
      originalPath: item.path,
      parentPath: item.parentPath
    });
    
    // Clean paths by removing leading/trailing slashes and decode URL components
    const cleanPath = (p: string) => {
      if (!p) return '';
      // Decode URL components to handle encoded spaces and special characters
      const decoded = decodeURIComponent(p);
      return decoded.replace(/^\/+|\/+$/g, '');
    };
    
    // Get and clean paths
    const parentPath = cleanPath(item.parentPath || '');
    let itemPath = cleanPath(item.path || '');
    
    LOG.debug('Navigation link path details', {
      parentPath,
      itemPath: itemPath,
      isDirectory: item.isDirectory
    });
    
    // For files, remove the .md extension
    if (!item.isDirectory) {
      itemPath = itemPath.replace(/\.md$/, '');
    }
    
    // Build the final path
    let fullPath = '';
    
    if (!parentPath) {
      // No parent path, use item path directly
      fullPath = itemPath;
    } else if (!itemPath) {
      // No item path, use parent path
      fullPath = parentPath;
    } else {
      // Check if itemPath already contains parentPath (accounting for URL encoding)
      const normalizedParentPath = parentPath.toLowerCase().trim();
      const normalizedItemPath = itemPath.toLowerCase().trim();
      
      LOG.debug('Checking path containment', {
        normalizedParentPath,
        normalizedItemPath,
        startsWithParentAndSlash: normalizedItemPath.startsWith(normalizedParentPath + '/'),
        equalsParent: normalizedItemPath === normalizedParentPath
      });
      
      // More robust check: if itemPath starts with parentPath followed by '/' or equals parentPath
      if (normalizedItemPath.startsWith(normalizedParentPath + '/') || normalizedItemPath === normalizedParentPath) {
        // Item path already contains parent path, use it directly
        fullPath = itemPath;
        LOG.debug('Item path already contains parent path', {
          itemPath,
          parentPath,
          usingPath: fullPath
        });
      } else {
        // Additional check: split both paths and compare segments to handle complex cases
        const parentSegments = normalizedParentPath.split('/').filter(Boolean);
        const itemSegments = normalizedItemPath.split('/').filter(Boolean);
        
        // Check if item path starts with all parent path segments
        const parentContainedInItem = parentSegments.every((segment, index) => {
          return index < itemSegments.length && itemSegments[index] === segment;
        });
        
        if (parentContainedInItem && itemSegments.length > parentSegments.length) {
          // Parent path is already contained in item path
          fullPath = itemPath;
          LOG.debug('Parent path segments found in item path', {
            itemPath,
            parentPath,
            parentSegments,
            itemSegments,
            usingPath: fullPath
          });
        } else {
          // Combine parent and item paths
          fullPath = `${parentPath}/${itemPath}`;
          LOG.debug('Combining parent and item paths', {
            itemPath,
            parentPath,
            parentSegments,
            itemSegments,
            combinedPath: fullPath
          });
        }
      }
    }
    
    LOG.debug('Final navigation path', {
      fullPath,
      segmentCount: fullPath.split('/').filter(Boolean).length
    });
    
    // Split into segments and remove any empty segments
    const pathSegments = fullPath.split('/').filter(segment => segment !== '');
    
    // Return the link and navigation state
    return {
      link: ['/', ...pathSegments], // Ensure we start with a single '/'
      state: {
        path: fullPath // Keep the full path in state
      }
    };
  }
  
  /**
   * @deprecated Use getNavigationLink instead
   */
  buildHomeLink(item: NavigationItem): string[] {
    // For backward compatibility
    return this.getNavigationLink(item).link;
  }
}
