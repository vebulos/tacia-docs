import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// No routes defined here as they are handled by the parent module
const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DocumentsRoutingModule { }
