import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
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
  selectedVersion: string = 'latest';
  // Updated data structure to hold separate paths for state and navigation
  mainNavItems: Array<ContentItem & { title: string; sectionPath: string; firstDocPath: string; }> = [];
  
  // Tags to display in the header - text only with color classes
  tags = [
    { name: 'MXC', textColor: 'text-blue-600 dark:text-blue-400' },
    { name: 'Blockchain', textColor: 'text-green-600 dark:text-green-400' },
    { name: 'IoT', textColor: 'text-purple-600 dark:text-purple-400' },
    { name: 'DePIN', textColor: 'text-yellow-600 dark:text-yellow-400' },
    { name: 'M2M', textColor: 'text-red-600 dark:text-red-400' },
    { name: 'ZkEVM', textColor: 'text-indigo-600 dark:text-indigo-400' },
  ];
  
  // Split tags into two rows
  get firstRowTags() {
    return this.tags.slice(0, Math.ceil(this.tags.length / 2));
  }
  
  get secondRowTags() {
    return this.tags.slice(Math.ceil(this.tags.length / 2));
  }
  
  private subscriptions = new Subscription();

  constructor(
    private contentService: ContentService,
    private router: Router,
    private firstDocumentService: FirstDocumentService
  ) {}

  ngOnInit(): void {
    this.loadMainNavigation();
    this.checkDarkMode();
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
