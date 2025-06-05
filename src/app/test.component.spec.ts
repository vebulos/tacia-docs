import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestComponent } from './test.component';

describe('TestComponent', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestComponent
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle dark mode', () => {
    // Mock localStorage
    const localStorageMock = {
      getItem: jasmine.createSpy('getItem').and.returnValue(null),
      setItem: jasmine.createSpy('setItem'),
      removeItem: jasmine.createSpy('removeItem'),
      clear: jasmine.createSpy('clear'),
      key: jasmine.createSpy('key'),
      length: 0
    };
    
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    // Mock matchMedia
    const matchMediaMock = jasmine.createSpy('matchMedia').and.returnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: jasmine.createSpy('addListener'),
      removeListener: jasmine.createSpy('removeListener'),
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
      dispatchEvent: jasmine.createSpy('dispatchEvent')
    });
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock
    });
    
    // Test dark mode toggle
    component.toggleDarkMode();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    component.toggleDarkMode();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
