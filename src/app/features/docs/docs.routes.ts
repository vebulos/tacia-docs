import { Routes } from '@angular/router';

export const DOCS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'content/getting-started/introduction',
    pathMatch: 'full'
  },
  {
    path: 'content',
    children: [
      {
        path: '**',
        loadComponent: () => import('./components/document/document.component').then(m => m.DocumentComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'content/getting-started/introduction'
  }
];
