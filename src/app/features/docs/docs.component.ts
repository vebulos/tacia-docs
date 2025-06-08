import { Component } from '@angular/core';
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
export class DocsComponent {
  headings: Heading[] = [];

  onHeadingsChange(event: Event) {
    const customEvent = event as CustomEvent<Heading[]>;
    this.headings = customEvent.detail;
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
