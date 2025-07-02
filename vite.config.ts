import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import angular from '@analogjs/vite-plugin-angular';

// Base configuration for Vitest
export default defineConfig({
  plugins: [
    angular({
      jit: true,
      tsconfig: 'tsconfig.json',
    }),
  ],
  test: {
    // Base configuration
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    testTimeout: 30000,
    
    // Code coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/e2e/**',
        '**/*.module.ts',
        '**/environments/**',
        '**/main.ts',
        '**/polyfills.ts',
        '**/test.ts',
        '**/src/test.ts',
        '**/src/environments/**',
        '**/*.d.ts',
        '**/src/**/*.spec.ts',
        '**/src/**/*.spec.tsx',
        '**/src/**/*.test.ts',
        '**/src/**/*.test.tsx',
        '**/src/**/test-*.ts',
        '**/src/**/test-*.tsx',
      ],
    },
    
    // Test configuration
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    environmentOptions: {
      jsdom: {
        // Required for Angular testing
        url: 'http://localhost:4200',
      },
    },
    // Required for Angular component testing
    server: {
      deps: {
        inline: ['@angular/*'],
      },
    }
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
