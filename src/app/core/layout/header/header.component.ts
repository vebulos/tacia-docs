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
  mainNavItems: Array<ContentItem & { title: string }> = [];
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
            // Filtrer et transformer les éléments pour la navigation principale
            this.mainNavItems = items
              .filter((item: ContentItem) => item.isDirectory) // Ne garder que les dossiers
              .map((item: ContentItem) => ({
                ...item,
                title: (item as any).title || item.name,
                path: item.path || `/${item.name}`
              }));
            
            // Précharger les chemins des premiers documents pour chaque dossier
            this.preloadFirstDocuments(this.mainNavItems);
          }
        },
        error: (error) => {
          console.error('Error loading main navigation:', error);
        }
      })
    );
  }
  
  private preloadFirstDocuments(items: Array<ContentItem & { title: string }>): void {
    items.forEach(item => {
      if (item.isDirectory) {
        const directory = item.path || item.name;
        this.firstDocumentService.getFirstDocumentPath(directory).pipe(
          take(1)
        ).subscribe(firstDocPath => {
          if (firstDocPath) {
            // Mettre à jour le chemin de navigation pour pointer vers le premier document
            item.path = firstDocPath;
          }
        });
      }
    });
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
