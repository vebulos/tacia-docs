/**
 * Configuration pour la recherche
 */
export interface SearchConfig<T> {
  // Propriétés à rechercher
  keys: Array<keyof T | { name: keyof T; weight: number }>;
  // Seuil de correspondance (0.0 - 1.0)
  threshold?: number;
  // Activer la recherche sensible à la casse
  isCaseSensitive?: boolean;
  // Nombre maximum de résultats
  limit?: number;
  // Activer la recherche floue
  useExtendedSearch?: boolean;
}

/**
 * Résultat de recherche
 */
export interface SearchResult<T> {
  // L'élément correspondant
  item: T;
  // Score de correspondance (0 = parfait, 1 = aucune correspondance)
  score?: number;
  // Détails des correspondances
  matches?: Array<{
    indices: [number, number][];
    key?: string;
    refIndex?: number;
    value?: string;
  }>;
  // Identifiant unique de l'élément (optionnel)
  id?: string | number;
}
