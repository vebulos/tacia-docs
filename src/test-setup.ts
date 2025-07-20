// First import zone.js and related testing modules
import 'zone.js';
import 'zone.js/testing';

// Then import Angular testing modules
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// Import test utilities
import { vi, beforeAll, afterEach, afterAll } from 'vitest';

// Store the original error handling
const originalError = console.error;
const originalWarn = console.warn;

// Initialize the test environment
const testBed = getTestBed();

// Set up the test environment before any tests run
beforeAll(() => {
  // Initialize the test environment
  testBed.initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
    { 
      teardown: { 
        destroyAfterEach: false, // Don't destroy fixtures after each test
        rethrowErrors: false
      } 
    }
  );
  
  // Suppress specific zone.js warnings
  console.error = (...args) => {
    // Ignore zone.js specific warnings
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('NoopNgZone') || 
       arg.includes('Zone already loaded') ||
       arg.includes('No provider for NgZone') ||
       arg.includes('Expected to not be in Angular Zone') ||
       arg.includes('NoopZone') ||
       arg.includes('ProxyZone'))
    )) {
      return;
    }
    originalError.apply(console, args);
  };

  // Mock browser APIs
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock KeyboardEvent
  Object.defineProperty(global, 'KeyboardEvent', {
    value: class KeyboardEvent {},
    writable: true,
  });

  // Mock window.scrollTo
  window.scrollTo = vi.fn();

  // Mock requestAnimationFrame and cancelAnimationFrame
  window.requestAnimationFrame = (callback) => {
    return window.setTimeout(callback, 0);
  };

  window.cancelAnimationFrame = (id) => {
    clearTimeout(id);
  };
});

// Reset test module after each test
afterEach(async () => {
  try {
    await testBed.resetTestingModule();
  } catch (e) {
    // Ignore errors during cleanup
  }
  vi.clearAllMocks();
});

// Ensure we clean up after all tests
afterAll(() => {
  try {
    testBed.resetTestingModule();
  } catch (e) {
    // Ignore errors during cleanup
  }
});

// Restore original console methods
afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});