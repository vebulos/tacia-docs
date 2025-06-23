import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, inject } from '@angular/core';
import { DocumentComponent } from './components/document/document.component';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterOutlet, RouterModule, NavigationEnd } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NavigationComponent } from './components/navigation/navigation.component';
import { HeadingsService } from '@app/core/services/headings.service';

export interface Heading {
  text: string;
  level: number;
  id: string;
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
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  // ...
  public headings$ = inject(HeadingsService).currentHeadings;
  private documentComponent: DocumentComponent | null = null;
  private destroy$ = new Subject<void>();
  private subscriptions: Subscription[] = [];

  scrollToHeading(event: MouseEvent, headingId: string): void {
    event.preventDefault();
    const el = document.getElementById(headingId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  @ViewChild('routerOutlet', { static: true }) routerOutletRef!: ElementRef;

  currentPath: string = '';
  relatedDocuments: any[] = [];
  buildHomeUrl = (path: string) => {
    try {
      // Remove .md extension if present
      let cleanPath = path.endsWith('.md') ? path.slice(0, -3) : path;
      // Decode any encoded characters in the path
      cleanPath = decodeURIComponent(cleanPath);
      // Split into segments to ensure proper URL handling
      const segments = cleanPath.split('/').filter(segment => segment.trim() !== '');
      return ['/', ...segments];
    } catch (e) {
      console.error('Error building home URL:', e);
      return ['/', 'error'];
    }
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {

  }

  ngOnInit(): void {
    // Get the current route path
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const path = params.get('path');
        if (path) {
          this.currentPath = path;
        }
        // Scroll to fragment if present in URL
        setTimeout(() => this.scrollToFragment(), 100);
      });

    // Handle initial fragment if present in URL
    this.route.fragment
      .pipe(takeUntil(this.destroy$))
      .subscribe(fragment => {
        if (fragment) {
          setTimeout(() => this.scrollToFragment(fragment), 100);
        }
      });
  }

  onActivate(component: any) {
    if (component instanceof DocumentComponent) {
      this.documentComponent = component;
      // S'abonner aux changements de documents connexes
      const sub = this.documentComponent.relatedDocumentsChange
        .pipe(takeUntil(this.destroy$))
        .subscribe(docs => {
          this.relatedDocuments = docs || [];
          console.log('Related documents updated in HomeComponent:', this.relatedDocuments);
        });
      this.subscriptions.push(sub);
    }
  }

  ngAfterViewInit(): void {
    // This will be called after the view is initialized
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  scrollToFragment(fragment?: string): void {
    if (!fragment) {
      fragment = this.route.snapshot.fragment || '';
    }
    if (!fragment) return;
    const element = document.getElementById(fragment);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Ajoutez ici les autres méthodes nécessaires, adaptées de l'ancien DocsComponent
}
