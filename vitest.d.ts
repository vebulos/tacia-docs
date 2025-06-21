/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

// Déclarations de types pour les tests
interface ImportMetaEnv {
  readonly VITE_TEST_ENV: string;
  // Ajoutez d'autres variables d'environnement de test ici
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
