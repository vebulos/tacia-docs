import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { DOCS_ROUTES } from './features/docs/docs.routes';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'TaciaDocs',
    data: { title: 'Home' }
  },
  {
    path: 'docs',
    loadComponent: () => import('./features/docs/docs.component').then(m => m.DocsComponent),
    loadChildren: () => import('./features/docs/docs.routes').then(m => m.DOCS_ROUTES),
    title: 'TaciaDocs',
    data: { title: 'TaciaDocs' }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
