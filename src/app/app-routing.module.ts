import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'docs',
    loadChildren: () => import('./features/documents/documents.module').then(m => m.DocumentsModule)
  },
  { path: '', redirectTo: '/docs/getting-started/introduction', pathMatch: 'full' },
  { path: '**', redirectTo: '/docs/getting-started/introduction' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
