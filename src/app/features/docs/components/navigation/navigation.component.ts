import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ContentService, ContentItem } from '../../../../core/services/content.service';
import { map, filter } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import { NavigationItemComponent } from './navigation-item.component';
import { SearchComponent as DocsSearchComponent } from '../search/search.component';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule, NavigationItemComponent, DocsSearchComponent],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent implements OnInit {
  contentStructure: (ContentItem & { isOpen?: boolean })[] = [];
  loading = true;
  error: string | null = null;
  activePath: string = '';

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
    this.activePath = this.router.url.replace(/^\/docs\/content\/?/, '');
    this.setActiveStates(this.contentStructure, this.activePath);
  }

  private setActiveStates(items: (ContentItem & { isOpen?: boolean })[], currentPath: string): boolean {
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

  // Handle category click
  onCategoryClick(category: any, event: Event): void {
    event.stopPropagation();
    if (category.children?.length) {
      category.isOpen = !category.isOpen;
    }
  }

  // Transform the content items to ensure paths are correct
  private transformContentItems(items: ContentItem[]): (ContentItem & { isOpen?: boolean })[] {
    return items.map(item => {
      const children = item.children ? this.transformContentItems(item.children) : [];
      return {
        ...item,
        name: item.metadata?.title || item.name,
        path: item.path.startsWith('/') ? item.path.substring(1) : item.path,
        children,
        isDirectory: item.isDirectory || children.length > 0,
        isOpen: false
      };
    });
  }

  trackByFn(index: number, item: any): string {
    return item.path || index.toString();
  }
}
