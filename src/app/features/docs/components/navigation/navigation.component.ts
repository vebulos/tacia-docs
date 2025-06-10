import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ContentService, ContentItem } from '../../../../core/services/content.service';
import { map, filter } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { SearchComponent } from '../search/search.component';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, SearchComponent, ReactiveFormsModule],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css'],
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
export class NavigationComponent implements OnInit {
  contentStructure: (ContentItem & { isOpen?: boolean })[] = [];
  loading = true;
  error: string | null = null;
  activeCategory: string | null = null;

  constructor(
    private contentService: ContentService,
    private router: Router
  ) {
    // Keep track of the active route to keep categories open
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateActiveStates();
    });
  }

  ngOnInit(): void {
    this.loadNavigation();
  }

  loadNavigation(): void {
    this.contentService.getContentStructure().pipe(
      map(items => this.transformContentItems(items))
    ).subscribe({
      next: (items: ContentItem[]) => {
        this.contentStructure = items.map(item => ({
          ...item,
          isOpen: false
        }));
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

  // Update active states based on current route
  private updateActiveStates(): void {
    const currentPath = this.router.url.replace(/^\/docs\/content\/?/, '');
    
    this.contentStructure.forEach(category => {
      // Check if any item in this category matches the current path
      const hasActiveChild = this.hasActiveChild(category, currentPath);
      if (hasActiveChild) {
        category.isOpen = true;
        this.activeCategory = category.path;
      }
    });
  }

  // Recursively check if any child matches the current path
  private hasActiveChild(item: ContentItem, currentPath: string): boolean {
    if (!item.isDirectory && item.path === currentPath) {
      return true;
    }
    
    if (item.children) {
      return item.children.some(child => this.hasActiveChild(child, currentPath));
    }
    
    return false;
  }

  private hoverTimeout: any = null;

  // Handle category mouse enter with delay
  onCategoryMouseEnter(category: any): void {
    if (this.activeCategory !== category.path) {
      // Clear any existing timeout to prevent multiple triggers
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
      }
      
      // Set a new timeout to open the category after 300ms
      this.hoverTimeout = setTimeout(() => {
        category.isOpen = true;
      }, 300);
    }
  }

  // Handle category mouse leave to cancel pending expansion
  onCategoryMouseLeave(category: any): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  // Handle category click
  onCategoryClick(category: any, event: Event): void {
    event.stopPropagation();
    this.activeCategory = category.path;
    category.isOpen = !category.isOpen;
  }

  // Transform the content items to ensure paths are correct
  private transformContentItems(items: ContentItem[]): (ContentItem & { isOpen?: boolean })[] {
    return items.map(item => {
      // Remove leading slash from path if present
      const path = item.path.startsWith('/') ? item.path.substring(1) : item.path;
      
      // For display, use the last part of the path
      let displayName = item.name;
      const pathParts = path.split('/');
      
      if (pathParts.length > 1) {
        // If it's a file, use the last part as the display name
        // If it's a directory, use the directory name
        displayName = pathParts[pathParts.length - 1];
      }
      
      // If the item has a title in metadata, use that for display
      if (item.metadata?.title) {
        displayName = item.metadata.title;
      }
      
      return {
        ...item,
        name: displayName,
        children: item.children ? this.transformContentItems(item.children) : [],
        path: path // Keep the path with forward slashes
      };
    });
  }
}
