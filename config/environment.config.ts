export interface EnvironmentConfig {
  production: boolean;
  apiUrl: string;
  // Ajoutez d'autres variables d'environnement ici
}

// Les valeurs par défaut pour l'environnement de développement
export const defaultEnvironment: EnvironmentConfig = {
  production: false,
  apiUrl: 'http://localhost:3000/api'
};
