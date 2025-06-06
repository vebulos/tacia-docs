import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

// A minimal component for testing
@Component({
  selector: 'app-minimal',
  template: '<div>Minimal Test</div>',
  standalone: true
})
class MinimalComponent {}

describe('Minimal Test', () => {
  let component: MinimalComponent;
  let fixture: ComponentFixture<MinimalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinimalComponent]
    }).compileComponents();
    
    fixture = TestBed.createComponent(MinimalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
