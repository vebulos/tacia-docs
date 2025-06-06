import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentsRoutingModule } from './documents-routing.module';
import { RouterModule } from '@angular/router';

// Import standalone components
import { DocumentComponent } from './components/document/document.component';
import { NavigationComponent } from './components/navigation/navigation.component';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    DocumentsRoutingModule,
    // Import standalone components
    DocumentComponent,
    NavigationComponent
  ],
  exports: [
    NavigationComponent
  ]
})
export class DocumentsModule { }
