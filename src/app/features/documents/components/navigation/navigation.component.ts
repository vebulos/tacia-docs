import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentService, ContentItem } from '../../../../core/services/content.service';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css'],
  providers: [ContentService]
})
export class NavigationComponent implements OnInit {
  contentStructure: ContentItem[] = [];
  loading = true;
  error: string | null = null;

  constructor(private contentService: ContentService) {}

  ngOnInit(): void {
    this.loadNavigation();
  }

  loadNavigation(): void {
    this.contentService.getContentStructure().pipe(
      map(items => this.transformContentItems(items))
    ).subscribe({
      next: (items: ContentItem[]) => {
        this.contentStructure = items;
        this.loading = false;
      },
      error: (err: Error) => {
        console.error('Failed to load navigation:', err);
        this.error = 'Failed to load navigation';
        this.loading = false;
      }
    });
  }

  // Transform the content items to ensure paths are correct
  private transformContentItems(items: ContentItem[]): ContentItem[] {
    return items.map(item => ({
      ...item,
      children: item.children ? this.transformContentItems(item.children) : [],
      path: item.path.startsWith('/') ? item.path.substring(1) : item.path // Remove leading slash
    }));
  }
}
