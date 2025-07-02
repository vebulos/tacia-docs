import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

// Base configuration for Vitest
export default defineConfig({
  test: {
    // Base configuration
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.ts'],
    
    // Code coverage configuration
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
    
    // Configuration for Angular dependencies
    server: {
      deps: {
        inline: ['@angular/**']
      }
    },
    
    // Disable cache to avoid issues
    cache: false,
    
    // Test configuration
    testTimeout: 30000,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true
  },
  
  // Alias configuration
  resolve: {
    alias: [
      {
        find: '@',
        replacement: resolve(__dirname, 'src')
      },
      {
        find: '@app',
        replacement: resolve(__dirname, 'src/app')
      }
    ]
  }
});
