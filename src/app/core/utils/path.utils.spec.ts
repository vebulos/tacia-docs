import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PathUtils } from './path.utils';

// Mock the environment for testing
vi.mock('../../../environments/environment', () => ({
  environment: {
    content: {
      basePath: ''
    },
    apiUrl: 'http://localhost:4201/api',
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

  describe('CONTENT_BASE_PATH', () => {
    it('should throw an error when no content paths are available', async () => {
      // Import the mocked module
      const envModule = await import('../../../environments/environment');
      // Get the mocked environment
      const env = envModule.environment;
      // Modify the mock values to be empty but valid
      env.content = {};
      
      // Expect the getter to throw an error
      expect(() => PathUtils.CONTENT_BASE_PATH).toThrow('Environment configuration is missing required content paths');
    });
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

  describe('DOCS_BASE_PATH', () => {
    it('should return docs base path from environment', () => {
      expect(PathUtils.DOCS_BASE_PATH).toBe('/docs');
    });

    it('should throw an error when docs.basePath is not available', async () => {
      // Import the mocked module
      const envModule = await import('../../../environments/environment');
      // Get the mocked environment
      const env = envModule.environment;
      // Remove the basePath
      const originalDocs = { ...env.docs };
      env.docs = {};
      
      // Expect the getter to throw an error
      expect(() => PathUtils.DOCS_BASE_PATH).toThrow('Environment configuration is missing required docs.basePath');
      
      // Restore the original value
      env.docs = originalDocs;
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
