import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface NavItem {
  title: string;
  path: string;
  children?: NavItem[];
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="space-y-1">
      <ng-container *ngFor="let item of navItems">
        <h3 class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {{ item.title }}
        </h3>
        <div class="mt-1 space-y-1">
          <a *ngFor="let child of item.children" 
             [routerLink]="['/docs', child.path]"
             routerLinkActive="bg-gray-100 text-gray-900"
             class="group flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900">
            <span class="truncate">{{ child.title }}</span>
          </a>
        </div>
      </ng-container>
    </nav>
  `,
  styles: []
})
export class NavigationComponent implements OnInit {
  navItems: NavItem[] = [
    {
      title: 'Getting Started',
      path: 'getting-started',
      children: [
        { title: 'Introduction', path: 'getting-started/introduction' },
        { title: 'Installation', path: 'getting-started/installation' },
        { title: 'Configuration', path: 'getting-started/configuration' }
      ]
    },
    {
      title: 'Guides',
      path: 'guides',
      children: [
        { title: 'Authentication', path: 'guides/authentication' },
        { title: 'API Usage', path: 'guides/api-usage' },
        { title: 'Deployment', path: 'guides/deployment' }
      ]
    }
  ];

  constructor() { }

  ngOnInit(): void {
  }
}
