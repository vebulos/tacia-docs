import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { skip } from 'rxjs/operators';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

// Mock document.head
const mockHead = document.createElement('head');

describe('ThemeService', () => {
  let service: ThemeService;
  
  // Store original globals
  const originalLocalStorage = window.localStorage;
  const originalDocumentHead = document.head;
  const originalConsoleError = console.error;
  let originalCreateElement: (tagName: string) => HTMLElement;
  
  beforeAll(() => {
    // Store original createElement once
    originalCreateElement = document.createElement;

    // Mock console.error
    console.error = vi.fn();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    // Mock document.head
    Object.defineProperty(document, 'head', {
      value: mockHead,
      writable: true
    });
  });
  
  afterAll(() => {
    // Restore globals
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage
    });
    
    Object.defineProperty(document, 'head', {
      value: originalDocumentHead
    });
    
    // Restore console.error
    console.error = originalConsoleError;
  });
  
  beforeEach(() => {
    // Clear all mocks and localStorage before each test
    vi.clearAllMocks();
    localStorage.clear();

    // Clear any existing link elements
    while (mockHead.firstChild) {
      mockHead.removeChild(mockHead.firstChild);
    }

    // Mock successful link loading for most tests
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'link') {
        // Create a real DOM element that can be appended to document.head
        const link = originalCreateElement.call(document, tagName) as HTMLLinkElement;
        
        // Set default properties
        link.rel = '';
        link.type = '';
        link.href = '';
        
        // Use a timeout to simulate async loading
        setTimeout(() => {
          // Trigger the onload event if handler exists
          if (typeof link.onload === 'function') {
            link.onload(new Event('load'));
          }
        }, 0);
        
        return link;
      }
      // For other elements, use the original implementation
      return originalCreateElement.call(document, tagName);
    });

    // Create fresh instance for each test
    service = new ThemeService();
  });

  afterEach(() => {
    // Restore original createElement to avoid mock leakage
    document.createElement = originalCreateElement;
  });
  
  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  
  describe('initialization', () => {
    it('should initialize with default theme if no saved theme', () => {
      expect(service.currentThemeValue).toBe('default');
      expect(localStorage.getItem('markdown-theme')).toBeNull();
    });
    
    it('should load saved theme from localStorage', () => {
      // Set a theme in localStorage
      localStorage.setItem('markdown-theme', 'leger');
      
      // Create new instance to test initialization
      const testService = new ThemeService();
      
      expect(testService.currentThemeValue).toBe('leger');
    });
    
    it('should use any saved theme from localStorage', () => {
      // Set a theme in localStorage - even if it's not in the enum, the service will use it
      // This test verifies the actual behavior of the service
      localStorage.setItem('markdown-theme', 'invalid-theme');
      
      // Create new instance to test initialization
      const testService = new ThemeService();
      
      // The service doesn't actually validate the theme name
      expect(testService.currentThemeValue).toBe('invalid-theme');
    });
  });
  
  describe('currentTheme$', () => {
    it('should emit the current theme', async () => {
      const theme = await firstValueFrom(service.currentTheme$);

      


    
      expect(theme).toBe('default');
    });
    
    it('should emit when theme changes', async () => {
      // Create a more explicit mock for this specific test
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'link') {
          const link = originalCreateElement.call(document, tagName) as HTMLLinkElement;
          link.rel = '';
          link.type = '';
          link.href = '';
          
          // Store the onload handler to call it manually
          Object.defineProperty(link, 'onload', {
            set: function(handler) {
              this._onloadHandler = handler;
              // Trigger the handler immediately (synchronous)
              if (this._onloadHandler) {
                this._onloadHandler(new Event('load'));
              }
            },
            get: function() {
              return this._onloadHandler;
            }
          });
          
          return link;
        }
        return originalCreateElement.call(document, tagName);
      });
      
      // Set up the subscription before calling loadTheme
      const themeChangePromise = firstValueFrom(service.currentTheme$.pipe(skip(1)));
      
      // Call loadTheme which will trigger our mock
      await service.loadTheme('leger');
      
      // Wait for the observable to emit
      const newTheme = await themeChangePromise;
      expect(newTheme).toBe('leger');
    });
  });
  
  describe('loadTheme', () => {
    it('should load a theme and update localStorage', async () => {
      // Clear any existing links
      while (mockHead.firstChild) {
        mockHead.removeChild(mockHead.firstChild);
      }
      
      // Load a theme
      await service.loadTheme('leger');
      // Check if stylesheet was added
      const links = mockHead.querySelectorAll('link[rel="stylesheet"]');
      expect(links.length).toBe(1);
      expect((links[0] as HTMLLinkElement).href).toContain('assets/themes/leger.css');
      
      // Check if theme was saved to localStorage
      expect(localStorage.getItem('markdown-theme')).toBe('leger');
    });
    
    it('should replace existing theme stylesheet', async () => {
      // Clear any existing links
      while (mockHead.firstChild) {
        mockHead.removeChild(mockHead.firstChild);
      }
      
      // Load first theme
      await service.loadTheme('leger');
      
      // Load second theme
      await service.loadTheme('default');
      // Should only have one stylesheet
      const links = mockHead.querySelectorAll('link[rel="stylesheet"]');
      expect(links.length).toBe(1);
      expect((links[0] as HTMLLinkElement).href).toContain('assets/themes/default.css');
    });
    
    it('should handle stylesheet loading errors', async () => {
      // Mock link.onerror for this specific test
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'link') {
          // Create a real DOM element that can be appended to document.head
          const link = originalCreateElement.call(document, tagName) as HTMLLinkElement;
          
          // Set default properties
          link.rel = '';
          link.type = '';
          link.href = '';
          
          // Use a timeout to simulate async loading error
          setTimeout(() => {
            // Trigger the onerror event if handler exists
            if (typeof link.onerror === 'function') {
              link.onerror(new Event('error'));
            }
          }, 0);
          
          return link;
        }
        return originalCreateElement.call(document, tagName);
      });

      // Should reject
      await expect(service.loadTheme('leger')).rejects.toThrow('Failed to load theme: leger');
    });
  });
  
  describe('toggleTheme', () => {
    it('should toggle between default and leger themes', async () => {
      // Create a fresh instance to ensure we start with default theme
      const testService = new ThemeService();
      
      // Initial state should be default
      expect(testService.currentThemeValue).toBe('default');
      
      // First toggle should change to leger
      await testService.toggleTheme();
      expect(testService.currentThemeValue).toBe('leger');
      
      // Second toggle should change back to default
      await testService.toggleTheme();
      expect(testService.currentThemeValue).toBe('default');
    });
  });
  
  describe('currentThemeValue', () => {
    it('should return the current theme', async () => {
      // Create a fresh instance to ensure we start with default theme
      const testService = new ThemeService();
      
      // Initial state should be default
      expect(testService.currentThemeValue).toBe('default');
      
      // Change theme and verify it updates
      await testService.loadTheme('leger');
      expect(testService.currentThemeValue).toBe('leger');
    });
  });
});

// Keep the original console.error for restoration
const originalConsoleError = console.error;
