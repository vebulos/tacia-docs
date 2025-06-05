import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { DocsComponent } from './features/docs/docs.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'MXC Documentation',
    data: { title: 'Home' }
  },
  {
    path: 'docs',
    component: DocsComponent,
    title: 'Documentation',
    data: { title: 'Documentation' },
    children: [
      // Will add documentation routes here
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
