import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

/**
 * Utility for managing paths in a centralized way
 */
export class PathUtils {
  

  
  // Base path for API
  static get API_BASE_PATH(): string {
    if (!environment?.apiUrl) {
      throw new Error('Environment configuration is missing required apiUrl');
    }
    return environment.apiUrl;
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
   * Builds an API path for content
   * @param path The relative path of the content
   * @deprecated Content API paths are now handled directly by the backend
   */
  static buildApiPath(path: string): string {
    // Return the path as-is, without modification
    console.log('[PathUtils] Building API path for:', path);
    return path;
  }
  

  

}
