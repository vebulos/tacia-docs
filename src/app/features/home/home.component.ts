import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NavigationComponent } from './components/navigation/navigation.component';
import { HeadingsService } from '@app/core/services/headings.service';

export interface Heading {
  text: string;
  level: number;
  id: string;
}

export interface RelatedDocument {
  path: string;
  title?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, // RouterOutlet included here
    NavigationComponent // Used within the template via <app-navigation>
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  public headings$: Observable<Heading[]>;
  public relatedDocuments: RelatedDocument[] = [];
  public currentPath: string = '';
  
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private headingsService: HeadingsService
  ) {
    // Initialize headings from the service
    this.headings$ = this.headingsService.currentHeadings.pipe(
      takeUntil(this.destroy$)
    );
  }

  ngOnInit(): void {
    // Listen for route changes to update the current path
    this.route.paramMap.pipe(
      takeUntil(this.destroy$)
    ).subscribe((params) => {
      this.currentPath = params.get('path') || '';
    });
  }

  // Method to build navigation URLs
  buildHomeUrl = (path: string): string[] => {
    try {
      // Remove .md extension if present
      let cleanPath = path.endsWith('.md') ? path.slice(0, -3) : path;
      // Decode any encoded characters in the path
      cleanPath = decodeURIComponent(cleanPath);
      // Split into segments for proper URL handling
      const segments = cleanPath.split('/').filter(segment => segment.trim() !== '');
      return ['/', ...segments];
    } catch (e) {
      console.error('Error building home URL:', e);
      return ['/'];
    }
  };

  // Called when a component is activated in the router
  onActivate(component: any): void {
    // If the activated component has a relatedDocumentsChange property, subscribe to it
    if (component && typeof component.relatedDocumentsChange !== 'undefined') {
      component.relatedDocumentsChange.pipe(
        takeUntil(this.destroy$)
      ).subscribe((docs: RelatedDocument[]) => {
        this.relatedDocuments = Array.isArray(docs) ? docs : [];
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Utility method to scroll to an element
  scrollToElement(id: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  // Handle heading click for table of contents
  scrollToHeading(event: Event, id: string): void {
    event.preventDefault();
    this.scrollToElement(id);
  }
}
