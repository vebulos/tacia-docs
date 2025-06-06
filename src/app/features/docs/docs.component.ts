import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { NavigationComponent } from '../documents/components/navigation/navigation.component';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, NavigationComponent],
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.css']
})
export class DocsComponent {
}
