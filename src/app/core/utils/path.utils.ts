import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

/**
 * Utility for managing paths in a centralized way
 */
export class PathUtils {
  
  // Base path for content (now empty as content is managed by the backend)
  static get CONTENT_BASE_PATH(): string {
    if (!environment?.content?.basePath && !environment?.search?.contentBasePath) {
      throw new Error('Environment configuration is missing required content paths');
    }
    return environment.content?.basePath || environment.search?.contentBasePath;
  }
  
  // Base path for API
  static get API_BASE_PATH(): string {
    if (!environment?.apiUrl) {
      throw new Error('Environment configuration is missing required apiUrl');
    }
    return environment.apiUrl;
  }
  
  // Base path for documentation
  static get DOCS_BASE_PATH(): string {
    if (!environment?.docs?.basePath) {
      throw new Error('Environment configuration is missing required docs.basePath');
    }
    return environment.docs.basePath;
  }
  
  /**
   * Cleans and normalizes a path
   */
  static normalizePath(path: string): string {
    if (!path) return '';
    // Remove leading and trailing slashes
    // and replace multiple slashes with a single slash
    return path
      .replace(/^\/+|\/+$/g, '')
      .replace(/\/+/g, '/');
  }
  
  /**
   * Removes the file extension from a path
   */
  static removeFileExtension(path: string): string {
    return path.replace(/\.[^/.]+$/, '');
  }
  
  /**
   * Checks if a path is empty or undefined
   */
  static isEmptyPath(path: string | null | undefined): boolean {
    return !path || path.trim() === '';
  }
  
  /**
   * Builds a URL for documentation
   */
  static buildDocsUrl(path: string = ''): string[] {
    // If the path is empty, return the base documentation path
    if (!path) return [PathUtils.DOCS_BASE_PATH];
    
    // Normalize the path and remove the extension
    const normalizedPath = PathUtils.normalizePath(path);
    const pathWithoutExt = PathUtils.removeFileExtension(normalizedPath);
    
    // If the path is empty after normalization, return the base path
    if (!pathWithoutExt) return [PathUtils.DOCS_BASE_PATH];
    
    // Otherwise, return the full path
    return [PathUtils.DOCS_BASE_PATH, ...pathWithoutExt.split('/')];
  }
  
  /**
   * Builds an API path for content
   * @param path The relative path of the content
   * @deprecated Content API paths are now handled directly by the backend
   */
  static buildApiPath(path: string): string {
    // Return the path as-is, without modification
    console.log('[PathUtils] Building API path for:', path);
    return path;
  }
  
  /**
   * Builds a content access path via the API
   * @deprecated Direct content access is now handled by the backend API
   */
  static buildContentPath(path: string): string {
    const normalizedPath = this.normalizePath(path);
    // Use the API endpoint instead of direct file access
    return `${this.API_BASE_PATH}/content/${normalizedPath}`;
  }
  

}
