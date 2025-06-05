import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DocumentComponent } from './document.component';
import { MarkdownService } from '../../../../core/services/markdown.service';

// Mock component for router outlet
@Component({
  template: ''
})
class MockComponent {}

export function configureTestingModule(providers: any[] = []) {
  return TestBed.configureTestingModule({
    imports: [
      RouterTestingModule.withRoutes([
        { path: '**', component: MockComponent }
      ])
    ],
    declarations: [DocumentComponent, MockComponent],
    providers: [
      {
        provide: MarkdownService,
        useValue: jasmine.createSpyObj('MarkdownService', ['getMarkdownFile'])
      },
      ...providers
    ]
  });
}

export function createComponent<T>(component: new (...args: any[]) => T): ComponentFixture<T> {
  const fixture = TestBed.createComponent(component);
  return fixture;
}

export function getMarkdownService(): jasmine.SpyObj<MarkdownService> {
  return TestBed.inject(MarkdownService) as jasmine.SpyObj<MarkdownService>;
}
