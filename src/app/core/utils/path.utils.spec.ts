import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PathUtils } from './path.utils';

// Mock the environment for testing
vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    apiUrl: 'http://localhost:4201/api',
    search: {
      maxResults: 50,
      maxRecentSearches: 10,
      debounceTime: 300,
      contentBasePath: '',
      contextLines: 1,
      index: {
        enabled: true,
        interval: 300000,
        initialDelay: 10000,
        indexOnStartup: true
      }
    },
    content: {
      basePath: ''
    },
    docs: {
      basePath: '/docs'
    }
  }
}));


describe('PathUtils', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });


  describe('API_BASE_PATH', () => {
    it('should return API base path from environment', () => {
      expect(PathUtils.API_BASE_PATH).toBe('http://localhost:4201/api');
    });

    it('should throw an error when apiUrl is not available', async () => {
      // Import the mocked module
      const envModule = await import('../../../environments/environment');
      // Get the mocked environment
      const env = envModule.environment;
      // Remove the apiUrl
      const originalApiUrl = env.apiUrl;
      env.apiUrl = '';
      
      // Expect the getter to throw an error
      expect(() => PathUtils.API_BASE_PATH).toThrow('Environment configuration is missing required apiUrl');
      
      // Restore the original value
      env.apiUrl = originalApiUrl;
    });
  });


  describe('normalizePath', () => {
    it('should return empty string for undefined or null path', () => {
      expect(PathUtils.normalizePath(undefined as any)).toBe('');
      expect(PathUtils.normalizePath(null as any)).toBe('');
      expect(PathUtils.normalizePath('')).toBe('');
    });

    it('should remove leading and trailing slashes', () => {
      expect(PathUtils.normalizePath('/test/path/')).toBe('test/path');
      expect(PathUtils.normalizePath('test/path/')).toBe('test/path');
      expect(PathUtils.normalizePath('/test/path')).toBe('test/path');
    });

    it('should replace multiple consecutive slashes with a single slash', () => {
      expect(PathUtils.normalizePath('test//path')).toBe('test/path');
      expect(PathUtils.normalizePath('test///path')).toBe('test/path');
      expect(PathUtils.normalizePath('test////path')).toBe('test/path');
    });

    it('should handle paths with different formats', () => {
      expect(PathUtils.normalizePath('test/path.md')).toBe('test/path.md');
      expect(PathUtils.normalizePath('test/subdir/../path')).toBe('test/subdir/../path');
      expect(PathUtils.normalizePath('test/./path')).toBe('test/./path');
    });
  });

  describe('removeFileExtension', () => {
    it('should remove file extension from path', () => {
      expect(PathUtils.removeFileExtension('test/file.txt')).toBe('test/file');
      expect(PathUtils.removeFileExtension('test/file.md')).toBe('test/file');
      expect(PathUtils.removeFileExtension('file.json')).toBe('file');
    });

    it('should handle paths with multiple dots', () => {
      expect(PathUtils.removeFileExtension('test/file.spec.ts')).toBe('test/file.spec');
      expect(PathUtils.removeFileExtension('test/file.min.js')).toBe('test/file.min');
    });

    it('should return the same path if no extension exists', () => {
      expect(PathUtils.removeFileExtension('test/file')).toBe('test/file');
      expect(PathUtils.removeFileExtension('file')).toBe('file');
    });

    it('should handle paths that start with a dot', () => {
      expect(PathUtils.removeFileExtension('.gitignore')).toBe('');
      expect(PathUtils.removeFileExtension('test/.env')).toBe('test/');
    });

    it('should handle empty string', () => {
      expect(PathUtils.removeFileExtension('')).toBe('');
    });
  });
});
