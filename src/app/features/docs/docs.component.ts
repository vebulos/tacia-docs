import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { DocumentComponent } from './components/document/document.component';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
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
export class DocsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('routerOutlet', { static: true }) routerOutletRef!: ElementRef;
  private documentComponent: DocumentComponent | null = null;
  headings: Heading[] = [];
  private subscriptions: any[] = [];

  constructor() {}

  ngOnInit() {
    // Initialize component
  }
  
  ngAfterViewInit() {
    // This will be called after the view is initialized
  }

  ngOnDestroy() {
    this.cleanupSubscriptions();
  }

  onHeadingsChange(component: any) {
    console.log('Router outlet activated with component:', component);
    
    // Clean up previous subscriptions
    this.cleanupSubscriptions();
    
    if (component instanceof DocumentComponent) {
      this.documentComponent = component;
      
      // Initial update
      this.updateHeadings(component.headings || []);
      
      // Subscribe to future updates
      if (component.headingsChange) {
        const sub = component.headingsChange.subscribe((headings: Heading[]) => {
          console.log('Received headings via subscription:', headings);
          this.updateHeadings(headings);
        });
        this.subscriptions.push(sub);
      }
    }
  }
  
  private updateHeadings(headings: Heading[]) {
    console.log('Updating headings:', headings);
    this.headings = [...headings]; // Create a new array reference to trigger change detection
  }
  
  private cleanupSubscriptions() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  scrollToHeading(event: Event, id: string) {
    event.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // Add a small delay to ensure the DOM has updated if needed
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth' });
        // Update URL without page reload
        history.pushState(null, '', `#${id}`);
      }, 100);
    }
  }
}
