/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

// Type declarations for tests
interface ImportMetaEnv {
  readonly VITE_TEST_ENV: string;
  // Add other test environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
