import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { DOCS_ROUTES } from './docs.routes';
import { DocsComponent } from './docs.component';
import { NavigationComponent } from './components/navigation/navigation.component';
import { DocumentComponent } from './components/document/document.component';
import { ContentService } from '../../core/services/content.service';
import { LazyContentService } from '../../core/services/lazy-content.service';
import { StorageService } from '../../core/services/storage.service';

@NgModule({
  declarations: [
    DocsComponent,
    NavigationComponent,
    DocumentComponent
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    RouterModule.forChild(DOCS_ROUTES)
  ],
  providers: [
    // Use LazyContentService as the primary content service
    { provide: ContentService, useClass: LazyContentService },
    StorageService
  ]
})
export class DocsModule { }
