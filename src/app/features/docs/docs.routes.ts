import { Routes } from '@angular/router';

export const DOCS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'content/getting-started/introduction',
    pathMatch: 'full'
  },
  {
    path: 'content/:path',
    loadComponent: () => import('../documents/components/document/document.component').then(m => m.DocumentComponent)
  },
  {
    path: '**',
    redirectTo: 'content/getting-started/introduction'
  }
];
