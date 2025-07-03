import { Component, OnInit, OnDestroy, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HomeSearchComponent } from '../../../shared/components/search/search.component';
import { ContentService } from '../../../core/services/content.service';
import { FirstDocumentService } from '../../../core/services/first-document.service';
import { ContentItem } from '../../../core/services/content.interface';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, HomeSearchComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  // Méthode pour arrondir vers le haut
  ceil(value: number): number {
    return Math.ceil(value);
  }
  selectedVersion: string = 'latest';
  // Updated data structure to hold separate paths for state and navigation
  mainNavItems: Array<ContentItem & { title: string; sectionPath: string; firstDocPath: string; }> = [];
  
  // Reference to the search component
  @ViewChild('searchComponent') searchComponent!: HomeSearchComponent;

  // Tags to display in the header  // Tags data with text colors for light/dark mode
  tags: { name: string; textColor: string }[] = [];
  visibleTags: { name: string; textColor: string }[] = [];
  hiddenTags: { name: string; textColor: string }[] = [];
  showTagDropdown = false;
  
  // Maximum number of tags to show before adding "..."
  private maxVisibleTags = 5;
  public Math = Math;
  
  // Colors for tags (will cycle through these colors)
  private tagColors = [
    'text-blue-600 dark:text-blue-400',
    'text-green-600 dark:text-green-400',
    'text-purple-600 dark:text-purple-400',
    'text-red-600 dark:text-red-400',
    'text-yellow-600 dark:text-yellow-400',
    'text-pink-600 dark:text-pink-400',
    'text-indigo-600 dark:text-indigo-400',
    'text-emerald-600 dark:text-emerald-400',
  ];
  
  private subscriptions = new Subscription();

  constructor(
    private contentService: ContentService,
    private router: Router,
    private route: ActivatedRoute,
    private firstDocumentService: FirstDocumentService
  ) {
    // Subscribe to content service for tag updates
    this.contentService.currentTags$.subscribe(tags => {
      this.updateTags(tags);
    });
  }

  /**
   * Updates the tags displayed in the header
   * @param tags Array of tag names to display
   */
  private updateTags(tagNames: string[]) {
    if (!tagNames || !Array.isArray(tagNames)) {
      tagNames = [];
    }
    
    // Assign colors to tags
    this.tags = tagNames.map((tag, index) => ({
      name: tag,
      textColor: this.tagColors[index % this.tagColors.length]
    }));
    
    // Split into visible and hidden tags
    this.visibleTags = this.tags.slice(0, this.maxVisibleTags);
    this.hiddenTags = this.tags.slice(this.maxVisibleTags);
    
    // Close dropdown when tags are updated
    this.showTagDropdown = false;
  }
  
  /**
   * Handles tag click event
   * @param tagName The name of the clicked tag
   * @param event The click event
   */
  onTagClick(tagName: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.searchComponent) {
      // Add '#' at the beginning of the tag if not already present
      const searchTerm = tagName.startsWith('#') ? tagName : `#${tagName}`;
      this.searchComponent.addSearchTerm(searchTerm);
    }
  }
  
  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.tags-dropdown')) {
      this.showTagDropdown = false;
    }
  }

  ngOnInit(): void {
    this.loadMainNavigation();
    this.checkDarkMode();
    
    // Initial tags update in case we missed any updates
    this.contentService.currentTags$.pipe(take(1)).subscribe(tags => {
      if (tags && tags.length > 0) {
        this.updateTags(tags);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadMainNavigation(): void {
    this.subscriptions.add(
      this.contentService.getContent('', true).subscribe({
        next: (items) => {
          if (items && Array.isArray(items)) {
            this.mainNavItems = items
              .filter((item: ContentItem) => item.isDirectory)
              .map((item: ContentItem) => {
                const sectionPath = item.path || `/${item.name}`;
                return {
                  ...item,
                  title: (item as any).title || item.name,
                  sectionPath: sectionPath,
                  firstDocPath: sectionPath, // Default to section path, will be updated
                };
              });
            
            this.preloadFirstDocuments(this.mainNavItems);
          }
        },
        error: (error) => {
          console.error('Error loading main navigation:', error);
        }
      })
    );
  }
  
  private preloadFirstDocuments(items: Array<ContentItem & { sectionPath: string; firstDocPath: string; }>): void {
    items.forEach(item => {
      if (item.isDirectory) {
        this.firstDocumentService.getFirstDocumentPath(item.sectionPath).pipe(
          take(1)
        ).subscribe(firstDocPath => {
          if (firstDocPath) {
            // Set the specific path for direct navigation
            item.firstDocPath = firstDocPath;
          }
        });
      }
    });
  }

  // Navigate to the first document of a section, used to override default routerLink behavior
  navigateToFirstDoc(item: { firstDocPath: string }, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigateByUrl(item.firstDocPath);
  }

  private checkDarkMode(): void {
    const theme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (theme === 'dark' || (!theme && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  }

  onVersionChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedVersion = select.value;
  }

  toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }
}
