import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IContentService } from '../../../../core/services/content.interface';
import { ContentItem } from '../../../../core/services/content.interface';
import { map, filter, takeUntil } from 'rxjs/operators';
import { NavigationItemComponent } from './navigation-item.component';
import { SearchComponent as DocsSearchComponent } from '../search/search.component';
import { Subject } from 'rxjs';

export interface NavigationItem extends ContentItem {
  isOpen?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  childrenLoaded?: boolean;
  children?: NavigationItem[];
}

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
    @Inject('IContentService') private contentService: IContentService,
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
        this.contentStructure = this.transformContentItems(items);
        this.updateActiveStates();
        this.loading = false;
      },
      error: (err: Error) => {
        console.error('Failed to load navigation:', err);
        this.error = 'Failed to load navigation';
        this.loading = false;
      }
    });
  }
  
  private transformContentItems(items: ContentItem[]): NavigationItem[] {
    return items.map(item => ({
      ...item,
      name: item.metadata?.title || item.name,
      path: item.path?.startsWith('/') ? item.path.substring(1) : item.path || '',
      children: item.children ? this.transformContentItems(item.children) : undefined,
      isDirectory: item.isDirectory || (item.children?.length ?? 0) > 0,
      isOpen: false,
      isLoading: false,
      hasError: false,
      childrenLoaded: false
    }));
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
    if (!parentItem.isDirectory || parentItem.isLoading || parentItem.childrenLoaded) {
      return;
    }

    parentItem.isLoading = true;
    parentItem.hasError = false;

    this.contentService.getContent(parentItem.path).subscribe({
      next: (items: ContentItem[]) => {
        parentItem.children = this.transformContentItems(items);
        parentItem.isLoading = false;
        parentItem.childrenLoaded = true;
        this.updateActiveStates();
      },
      error: (error: Error) => {
        console.error('Failed to load child items:', error);
        parentItem.isLoading = false;
        parentItem.hasError = true;
      }
    });
  }

  toggleItem(event: Event, item: NavigationItem): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (item.isDirectory) {
      if (!item.childrenLoaded) {
        this.loadChildItems(item);
      }
      item.isOpen = !item.isOpen;
    }
  }

  // Update active states based on current route
  private updateActiveStates(): void {
    if (!this.router.navigated) return;
    
    const url = this.router.url;
    this.activePath = url.startsWith('/docs/content/') 
      ? url.replace(/^\/docs\/content\//, '')
      : '';
      
    this.setActiveStates(this.contentStructure, this.activePath);
  }

  private setActiveStates(items: NavigationItem[], currentPath: string): boolean {
    let hasActiveChild = false;
    
    for (const item of items) {
      if (item.children) {
        const childHasActive = this.setActiveStates(item.children, currentPath);
        if (childHasActive) {
          item.isOpen = true;
          hasActiveChild = true;
        }
      }
      
      if (!hasActiveChild && item.path && currentPath.startsWith(item.path)) {
        hasActiveChild = true;
      }
    }
    
    return hasActiveChild;
  }

  trackByFn(index: number, item: NavigationItem): string {
    return item.path || index.toString();
  }
}
