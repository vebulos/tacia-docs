// Configuration pour les tests avec Vitest et Angular
import 'zone.js/dist/zone';
import 'zone.js/dist/zone-testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { expect, afterEach, beforeAll, afterAll } from 'vitest';

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

// Configuration globale pour les tests
beforeAll(() => {
  // Initialisation de l'environnement de test Angular
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
  );

  // Mock pour ResizeObserver
  (global as any).ResizeObserver = ResizeObserverMock;
  
  // S'assurer que window.ResizeObserver est défini
  if (!('ResizeObserver' in window)) {
    (window as any).ResizeObserver = ResizeObserverMock;
  }
});

// Configuration avant chaque test
beforeEach(() => {
  // Réinitialiser l'état entre les tests si nécessaire
});

// Nettoyage après chaque test
afterEach(() => {
  // Nettoyage après chaque test si nécessaire
});

// Nettoyage final après tous les tests
afterAll(() => {
  // Nettoyage final si nécessaire
});
