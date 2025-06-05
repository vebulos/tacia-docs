import { Routes } from '@angular/router';
import { DocumentComponent } from './pages/document/document.component';

export const DOCS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'getting-started/installation',
    pathMatch: 'full'
  },
  {
    path: ':path',
    component: DocumentComponent
  }
];
