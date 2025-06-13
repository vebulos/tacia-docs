import { Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService } from '@app/core/services/content.service';
import { ContentItem } from '@app/core/services/content.interface';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subject, takeUntil } from 'rxjs';
import { PathUtils } from '@app/core/utils/path.utils';

// Extend the ContentItem with navigation-specific properties
export interface NavigationItem extends ContentItem {
  isOpen?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  childrenLoaded?: boolean;
  children?: NavigationItem[];
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
export class NavigationItemComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private hoverTimer: any = null;
  
  @Input() item!: NavigationItem;
  @Input() level: number = 0;
  @Input() activePath: string = '';

  constructor(
    private contentService: ContentService
  ) {}
  
  toggleItem(event: Event, forceOpen: boolean | null = null): void {
    if (!this.item.isDirectory) return;
    
    event.stopPropagation();
    
    // If forceOpen is not provided, toggle the current state
    // If forceOpen is provided, set to that value
    this.item.isOpen = forceOpen !== null ? forceOpen : !this.item.isOpen;
    
    // Load children when opening
    if (this.item.isOpen && !this.item.childrenLoaded && !this.item.isLoading) {
      this.loadChildren();
    }
  }
  
  private loadChildren(): void {
    if (!this.item.path) return;
    
    this.item.isLoading = true;
    this.item.hasError = false;
    
    this.contentService.getContent(this.item.path).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (children: any) => {
        this.item.children = children as NavigationItem[];
        this.item.childrenLoaded = true;
        this.item.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading children:', error);
        this.item.hasError = true;
        this.item.isLoading = false;
      }
    });
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

    // Set a new timer
    this.hoverTimer = setTimeout(() => {
      this.toggleItem(event, true); // Force open on hover
      this.hoverTimer = null;
    }, 300); // 300ms delay before loading on hover
  }

  onMouseLeave(event: MouseEvent): void {
    // Clear the timer if mouse leaves before it triggers
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  ngOnDestroy(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get the navigation link with state for a navigation item
   */
  getNavigationLink(item: NavigationItem): { link: string[], state: any } {
    // Use the path which now includes the extension for files
    const itemPath = item.path || '';
    
    // Build the base URL
    const baseUrl = PathUtils.buildDocsUrl(itemPath);
    
    // Return the link and navigation state
    return {
      link: baseUrl,
      state: {
        path: itemPath // Pass the full path with extension
      }
    };
  }
  
  /**
   * @deprecated Use getNavigationLink instead
   */
  buildDocsLink(item: NavigationItem): string[] {
    // For backward compatibility
    return this.getNavigationLink(item).link;
  }
}
