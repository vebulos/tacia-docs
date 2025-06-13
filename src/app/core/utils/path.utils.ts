import { environment } from '../../../environments/environment';

/**
 * Utilitaire pour gérer les chemins de manière centralisée
 */
export class PathUtils {
  // Chemin par défaut pour la documentation (sans le préfixe /docs)
  static get DEFAULT_DOCS_PATH(): string {
    return environment.docs?.defaultPath || 'getting-started/introduction';
  }
  
  // Chemin de base pour le contenu
  static get CONTENT_BASE_PATH(): string {
    return environment.content?.basePath || environment.search?.contentBasePath || '/assets/content';
  }
  
  // Chemin de base pour l'API
  static get API_BASE_PATH(): string {
    return environment.apiUrl || '/api';
  }
  
  // Chemin de base pour la documentation
  static get DOCS_BASE_PATH(): string {
    return environment.docs?.basePath || '/docs';
  }
  
  /**
   * Nettoie et normalise un chemin
   */
  static normalizePath(path: string): string {
    if (!path) return '';
    // Supprimer les slashes de début et de fin
    // et remplacer les séquences de slashes par un seul slash
    return path
      .replace(/^\/+|\/+$/g, '')
      .replace(/\/+/g, '/');
  }
  
  /**
   * Supprime l'extension d'un fichier
   */
  static removeFileExtension(path: string): string {
    return path.replace(/\.[^/.]+$/, '');
  }
  
  /**
   * Vérifie si un chemin est vide ou non défini
   */
  static isEmptyPath(path: string | null | undefined): boolean {
    return !path || path.trim() === '';
  }
  
  /**
   * Construit une URL pour la documentation
   */
  static buildDocsUrl(path: string = ''): string[] {
    // Si le chemin est vide, retourner le chemin de base de la documentation
    if (!path) return [this.DOCS_BASE_PATH];
    
    // Normaliser le chemin et supprimer l'extension
    const normalizedPath = this.normalizePath(path);
    const pathWithoutExt = this.removeFileExtension(normalizedPath);
    
    // Si le chemin est vide après normalisation, retourner le chemin de base
    if (!pathWithoutExt) return [this.DOCS_BASE_PATH];
    
    // Sinon, retourner le chemin complet
    return [this.DOCS_BASE_PATH, ...pathWithoutExt.split('/')];
  }
  
  /**
   * Construit un chemin d'API pour le contenu
   * @param path Le chemin relatif du contenu
   */
  static buildApiPath(path: string): string {
    // Retourner le chemin tel quel, sans modification
    console.log('[PathUtils] Building API path for:', path);
    return path;
  }
  
  /**
   * Construit un chemin d'accès au contenu statique
   */
  static buildContentPath(path: string): string {
    const normalizedPath = this.normalizePath(path);
    const contentPath = `${this.CONTENT_BASE_PATH}/${normalizedPath}`;
    return contentPath.replace(/\/+/g, '/');
  }
  
  /**
   * Trie les éléments de navigation (dossiers d'abord, puis fichiers)
   */
  static sortNavigationItems(items: any[]): any[] {
    if (!items) return [];
    
    return [...items].sort((a, b) => {
      // Si les deux sont des dossiers ou des fichiers, on trie par nom
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      // Sinon, les dossiers d'abord
      return a.isDirectory ? -1 : 1;
    });
  }
}
