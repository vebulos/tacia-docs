import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { DocumentComponent } from './components/document/document.component';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterOutlet, RouterModule, NavigationEnd } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NavigationComponent } from './components/navigation/navigation.component';

export interface Heading {
  text: string;
  level: number;
  id: string;
}

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    RouterOutlet, 
    NavigationComponent
  ],
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.css']
})
export class DocsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('routerOutlet', { static: true }) routerOutletRef!: ElementRef;
  
  headings: Heading[] = [];
  currentPath: string = '';
  relatedDocuments: any[] = [];
  buildDocsUrl = (path: string) => {
    try {
      // Remove .md extension if present
      let cleanPath = path.endsWith('.md') ? path.slice(0, -3) : path;
      // Decode any encoded characters in the path
      cleanPath = decodeURIComponent(cleanPath);
      // Split into segments to ensure proper URL handling
      const segments = cleanPath.split('/').filter(segment => segment.trim() !== '');
      return ['/docs', ...segments];
    } catch (e) {
      console.error('Error building docs URL:', e);
      return ['/docs', 'error'];
    }
  };
  
  private documentComponent: DocumentComponent | null = null;
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();

  constructor(private router: Router, private route: ActivatedRoute) {}

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

  ngAfterViewInit(): void {
    // This will be called after the view is initialized
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private scrollToFragment(fragment?: string): void {
    const id = fragment || window.location.hash.substring(1);
    if (!id) return;
    
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      element.classList.add('heading-highlight');
      setTimeout(() => element.classList.remove('heading-highlight'), 2000);
    }
  }

  onHeadingsChange(component: unknown): void {
    if (!(component instanceof DocumentComponent)) return;
    
    console.log('Router outlet activated with component:', component);
    
    // Clean up previous subscriptions
    this.cleanupSubscriptions();
    
    this.documentComponent = component;
    
    // Initial update
    this.updateHeadings(component.headings || []);
    
    // Subscribe to headings changes
    if (component.headingsChange) {
      const headingsSub = component.headingsChange.subscribe((headings: Heading[]) => {
        console.log('Received headings via subscription:', headings);
        this.updateHeadings(headings);
      });
      this.subscriptions.push(headingsSub);
    }
    
    // Subscribe to related documents changes
    if (component.relatedDocumentsChange) {
      console.log('Subscribing to related documents changes');
      const relatedDocsSub = component.relatedDocumentsChange.subscribe((docs: any[]) => {
        console.log('Received related documents via subscription:', docs);
        console.log('Number of related documents received:', docs?.length || 0);
        this.relatedDocuments = docs || [];
        console.log('Updated relatedDocuments in DocsComponent:', this.relatedDocuments);
      });
      this.subscriptions.push(relatedDocsSub);
    } else {
      console.warn('component.relatedDocumentsChange is not defined');
    }
  }
  
  private updateHeadings(headings: Heading[]): void {
    console.log('Updating headings:', headings);
    this.headings = [...headings]; // Create a new array reference to trigger change detection
  }
  
  private cleanupSubscriptions(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  scrollToHeading(event: Event, id: string): void {
    event.preventDefault();
    
    // Update URL hash
    const currentUrl = window.location.pathname;
    window.history.pushState(null, '', `${currentUrl}#${id}`);
    
    // Find the element and scroll to it
    const element = document.getElementById(id);
    if (element) {
      // Calculate the scroll position, accounting for any fixed header
      const headerOffset = 80; // Adjust this value based on your header height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      // Smooth scroll to the element
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Add a class to highlight the target element
      element.classList.add('heading-highlight');
      
      // Remove the highlight after animation completes
      setTimeout(() => {
        element.classList.remove('heading-highlight');
      }, 2000);
    }
  }
}
