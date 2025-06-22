import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    loadChildren: () => import('./features/home/home.routes').then(m => m.HOME_ROUTES),
    title: 'TaciaDocs',
    data: { title: 'Home' }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
