// Configuration minimale pour les tests avec Vitest
import { expect, afterEach } from 'vitest';
// No need to import or call cleanup separately in newer versions of @testing-library/angular
// The cleanup is automatically handled by the library

// Configurer les mocks globaux si nécessaire
if (typeof window !== 'undefined') {
  // @ts-ignore - Configuration pour les tests navigateur
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  // Mock pour ResizeObserver si nécessaire
  if (!('ResizeObserver' in window)) {
    // @ts-ignore
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
