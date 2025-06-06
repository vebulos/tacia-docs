import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DocumentComponent } from './components/document/document.component';
import { NavigationComponent } from './components/navigation/navigation.component';

@NgModule({
  declarations: [
    DocumentComponent,
    NavigationComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([
      {
        path: ':path',
        component: DocumentComponent
      }
    ])
  ]
})
export class DocumentsModule { }
