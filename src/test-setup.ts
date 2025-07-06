// Import Zone.js and the test environment first
import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

declare const jest: any; // Declaration to avoid type errors with Jest

// First, initialize the Zone
const { defineProperty } = Object;
Object.defineProperty = function (obj: any, prop: string | symbol, desc: PropertyDescriptor) {
  if (prop === 'addEventListener' || prop === 'removeEventListener') {
    const newDesc: PropertyDescriptor = {
      configurable: true,
      enumerable: true,
      ...desc,
      value: function (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
        const opts = typeof options === 'boolean' ? { capture: options } : options || {};
        return (desc.value as Function).call(this, type, listener, {
          ...opts,
          passive: false,
        });
      },
    };
    return defineProperty(obj, prop, newDesc);
  }
  return defineProperty(obj, prop, desc);
};

// Initialize the Angular testing environment
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
  { 
    teardown: { 
      destroyAfterEach: false,
      rethrowErrors: false
    } 
  }
);

// Mock matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    // @ts-ignore
    addListener: () => {}, // deprecated
    // @ts-ignore
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
