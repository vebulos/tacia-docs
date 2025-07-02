import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { describe, beforeEach, it, expect } from 'vitest';

import { AppComponent } from './app.component';
import { NotificationService } from './core/services/notification/notification.service';

// Import real components to override them
import { LayoutComponent } from './core/layout/layout.component';
import { HeaderComponent } from './core/layout/header/header.component';
import { FooterComponent } from './core/layout/footer/footer.component';
import { NotificationComponent } from './core/services/notification/notification.component';

// --- Mock Components ---
@Component({ selector: 'app-header', template: '', standalone: true })
class MockHeaderComponent {}

@Component({ selector: 'app-footer', template: '', standalone: true })
class MockFooterComponent {}

@Component({ selector: 'app-notification', template: '', standalone: true })
class MockNotificationComponent {}


// --- Mock Service ---
class MockNotificationService {
  notifications$ = new BehaviorSubject<any[]>([]);
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, AppComponent],
      providers: [
        { provide: NotificationService, useClass: MockNotificationService },
      ],
    })
      .overrideComponent(LayoutComponent, {
        remove: { imports: [HeaderComponent, FooterComponent, NotificationComponent] },
        add: { imports: [MockHeaderComponent, MockFooterComponent, MockNotificationComponent] },
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
