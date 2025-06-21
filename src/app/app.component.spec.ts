import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { describe, beforeEach, it, expect } from 'vitest';

import { AppComponent } from './app.component';
import { LayoutComponent } from './core/layout/layout.component';
import { NotificationComponent } from './core/services/notification/notification.component';
import { NotificationService } from './core/services/notification/notification.service';
import { HeaderComponent } from './core/layout/header/header.component';
import { FooterComponent } from './core/layout/footer/footer.component';

// Mock pour le composant de notification
@Component({
  selector: 'app-notification',
  template: '<div></div>',
  standalone: true
})
class MockNotificationComponent {}

// Mock pour le service de notification
class MockNotificationService {
  notifications$ = new BehaviorSubject<any[]>([]);
  show() {}
  dismiss() {}
  clearAll() {}
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        RouterTestingModule,
        AppComponent,
        LayoutComponent,
        HeaderComponent,
        FooterComponent,
        RouterOutlet
      ],
      providers: [
        { provide: NotificationService, useClass: MockNotificationService }
      ]
    })
    .overrideComponent(LayoutComponent, {
      remove: { imports: [NotificationComponent] },
      add: { imports: [MockNotificationComponent] }
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
    expect(component.title).toBe('TaciaNet Documentation');
  });

  it('should render router outlet inside layout', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-layout')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
