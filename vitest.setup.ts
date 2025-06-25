// Configuration for tests with Vitest and Angular
import "zone.js";
import "zone.js/testing";
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { expect, afterEach, beforeAll, beforeEach, afterAll } from 'vitest';

// Mock pour ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock pour matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});

// Global test configuration
beforeAll(() => {
  // Initialize Angular testing environment
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
  );

  // Mock pour ResizeObserver
  (global as any).ResizeObserver = ResizeObserverMock;
  
  // Ensure window.ResizeObserver is defined
  if (!('ResizeObserver' in window)) {
    (window as any).ResizeObserver = ResizeObserverMock;
  }
});

// Configuration before each test
beforeEach(() => {
  // Reset state between tests if needed
});

// Nettoyage après chaque test
afterEach(() => {
  // Cleanup after each test if needed
});

// Final cleanup after all tests
afterAll(() => {
  // Final cleanup if needed
});
