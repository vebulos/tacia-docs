import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { LOG } from '../services/logging/bun-logger.service';

// Interface pour la compatibilité avec le module path de Node.js
type PathObject = {
  dir: string;
  base: string;
  ext: string;
  name: string;
};

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
    LOG.debug('Building API path', { path });
    return path;
  }

  /**
   * Get the directory name of a path
   * Similar to path.dirname() in Node.js
   */
  static dirname(path: string): string {
    if (!path) return '.';
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return '.';
    if (lastSlash === 0) return '/';
    return path.substring(0, lastSlash);
  }

  /**
   * Parse a path into an object
   * Similar to path.parse() in Node.js
   */
  static parse(path: string): PathObject {
    const lastSlash = path.lastIndexOf('/');
    const lastDot = path.lastIndexOf('.');
    
    const dir = lastSlash === -1 ? '.' : path.substring(0, lastSlash);
    const base = lastSlash === -1 ? path : path.substring(lastSlash + 1);
    
    let ext = '';
    let name = base;
    
    if (lastDot > -1 && lastDot > (lastSlash === -1 ? 0 : lastSlash)) {
      ext = path.substring(lastDot);
      name = base.substring(0, base.lastIndexOf('.'));
    }
    
    return { dir, base, ext, name };
  }
  
  /**
   * Join path segments
   * Similar to path.join() in Node.js
   */
  static join(...segments: string[]): string {
    return segments
      .filter(segment => segment != null)
      .map((segment, index) => {
        // Remove leading slashes from all segments except the first one
        if (index > 0) {
          return segment.replace(/^\/+/g, '');
        }
        return segment;
      })
      .join('/')
      .replace(/\/+/g, '/') // Replace multiple slashes with a single slash
      .replace(/\/+$/, ''); // Remove trailing slashes
  }
  
  /**
   * Resolve a sequence of paths or path segments into an absolute path
   * Similar to path.resolve() in Node.js
   */
  static resolve(...paths: string[]): string {
    let resolvedPath = '';
    
    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      if (path) {
        if (path.startsWith('/')) {
          // If the path starts with a slash, it's an absolute path
          resolvedPath = path;
        } else {
          // Otherwise, append to the current path
          resolvedPath = `${path}/${resolvedPath}`;
        }
      }
    }
    
    // Normalize the path
    return resolvedPath
      .replace(/\/+/g, '/') // Replace multiple slashes with a single slash
      .replace(/\/$/, '') // Remove trailing slash
      .replace(/^$/, '/'); // If empty, return root
  }

  

}
