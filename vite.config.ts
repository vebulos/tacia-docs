import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

// Configuration de base pour Vitest
export default defineConfig({
  test: {
    // Configuration de base
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.ts'],
    
    // Configuration de la couverture de code
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/*.module.ts',
        '**/test-setup.ts',
        '**/*.spec.ts',
        '**/environments/**',
        '**/main.ts',
        '**/polyfills.ts',
        '**/test.ts',
        '**/src/test.ts'
      ]
    },
    
    // Configuration pour les dépendances Angular
    server: {
      deps: {
        inline: ['@angular/**']
      }
    },
    
    // Désactiver le cache pour éviter les problèmes
    cache: false,
    
    // Configuration pour les tests
    testTimeout: 30000,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true
  },
  
  // Configuration des alias
  resolve: {
    alias: [
      {
        find: '@',
        replacement: resolve(__dirname, 'src')
      }
    ]
  }
});
