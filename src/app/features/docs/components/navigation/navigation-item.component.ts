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
  
  @Input() item!: NavigationItem;
  @Input() level: number = 0;
  @Input() activePath: string = '';

  constructor(
    private contentService: ContentService
  ) {}
  
  toggleItem(event: Event): void {
    event.stopPropagation();
    if (!this.item.isDirectory) return;
    
    this.item.isOpen = !this.item.isOpen;
    
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
  
  ngOnDestroy(): void {
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
