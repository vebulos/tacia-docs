import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { describe, beforeEach, it, expect } from 'vitest';

import { AppComponent } from './app.component';
import { NotificationService } from './core/services/notification/notification.service';
import { LayoutComponent } from './core/layout/layout.component';

// --- Mock Components ---
@Component({ selector: 'app-layout', template: '', standalone: true })
class MockLayoutComponent {}

// --- Mock Service ---
class MockNotificationService {
  notifications$ = new BehaviorSubject<any[]>([]);
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        AppComponent, // Test the real AppComponent
      ],
      providers: [
        { provide: NotificationService, useClass: MockNotificationService },
      ],
    })
    .overrideComponent(AppComponent, {
      remove: { imports: [LayoutComponent] },
      add: { imports: [MockLayoutComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have the correct title', () => {
    expect(component.title).toBe('TaciaDocs');
  });

  it('should render router outlet inside layout', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-layout')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
