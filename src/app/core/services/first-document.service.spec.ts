import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { FirstDocumentService } from './first-document.service';
import { PathUtils } from '../utils/path.utils';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';

// Mock console.error
const originalConsoleError = console.error;
console.error = vi.fn();

// Mock HttpClient
const mockHttpClient = {
  get: vi.fn(<T>(url: string): Observable<T> => {
    if (url.includes('error')) {
      return new Observable(subscriber => {
        subscriber.error(new Error('Test error'));
      }) as unknown as Observable<T>;
    }
    
    const response = { 
      path: url.includes('null') ? null : 'path/to/document.md' 
    } as unknown as T;
    
    return new Observable<T>(subscriber => {
      subscriber.next(response);
      subscriber.complete();
    });
  })
} as unknown as HttpClient;

describe('FirstDocumentService', () => {
  let service: FirstDocumentService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        FirstDocumentService,
        { provide: HttpClient, useValue: mockHttpClient }
      ]
    });
    service = TestBed.inject(FirstDocumentService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  
  // Restaurer console.error après tous les tests
  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getFirstDocumentPath', () => {
    it('should return path when document exists', async () => {
      const result = await firstValueFrom(service.getFirstDocumentPath());
      expect(result).toBe('path/to/document');
      expect(mockHttpClient.get).toHaveBeenCalledWith(`${PathUtils.API_BASE_PATH}/first-document/`);
    });

    it('should return null when no document exists', async () => {
      // Force null response for this test
      const originalGet = mockHttpClient.get;
      mockHttpClient.get = vi.fn(() => new Observable(subscriber => {
        subscriber.next({ path: null });
        subscriber.complete();
      })) as any;

      try {
        const result = await firstValueFrom(service.getFirstDocumentPath());
        expect(result).toBeNull();
        expect(mockHttpClient.get).toHaveBeenCalledWith(`${PathUtils.API_BASE_PATH}/first-document/`);
      } finally {
        // Restore original mock
        mockHttpClient.get = originalGet;
      }
    });

    it('should handle errors gracefully', async () => {
      // Le service retourne null en cas d'erreur au lieu de propager l'erreur
      const result = await firstValueFrom(service.getFirstDocumentPath('error'));
      
      // Vérifier que le résultat est null
      expect(result).toBeNull();
      
      // Vérifier que console.error est appelé
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching first document path for directory 'error':"),
        expect.any(Error)
      );
    });

    it('should cache results', async () => {
      let callCount = 0;
      
      // Override the mock to count calls
      const originalGet = mockHttpClient.get;
      mockHttpClient.get = vi.fn(() => {
        callCount++;
        return new Observable(subscriber => {
          subscriber.next({ path: 'path/to/document.md' });
          subscriber.complete();
        });
      }) as any;

      try {
        // First call
        const firstResult = await firstValueFrom(service.getFirstDocumentPath());
        expect(firstResult).toBe('path/to/document');
        expect(callCount).toBe(1);
        
        // Second call should use cache
        const secondResult = await firstValueFrom(service.getFirstDocumentPath());
        expect(secondResult).toBe('path/to/document');
        expect(callCount).toBe(1); // Still only one call
      } finally {
        // Restore original mock
        mockHttpClient.get = originalGet;
      }
    });

    it('should handle directory parameter correctly', async () => {
      const directory = 'some/directory';
      
      const result = await firstValueFrom(service.getFirstDocumentPath(directory));
      expect(result).toBe('path/to/document');
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${PathUtils.API_BASE_PATH}/first-document/${directory}`
      );
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific directory', async () => {
      const directory = 'some/directory';
      let callCount = 0;
      
      // Override the mock to count calls
      const originalGet = mockHttpClient.get;
      mockHttpClient.get = vi.fn(() => {
        callCount++;
        return new Observable(subscriber => {
          subscriber.next({ path: 'path/to/document.md' });
          subscriber.complete();
        });
      }) as any;
      
      try {
        // First call to populate cache
        await firstValueFrom(service.getFirstDocumentPath(directory));
        
        // Clear cache
        service.clearCache(directory);
        
        // Make another call - should make a new HTTP call
        await firstValueFrom(service.getFirstDocumentPath(directory));
        expect(callCount).toBe(2); // Should have made two calls
      } finally {
        // Restore original mock
        mockHttpClient.get = originalGet;
      }
    });

    it('should clear all caches when no directory specified', async () => {
      let callCount = 0;
      
      // Override the mock to count calls
      const originalGet = mockHttpClient.get;
      mockHttpClient.get = vi.fn(() => {
        callCount++;
        return new Observable(subscriber => {
          subscriber.next({ path: 'path/to/document.md' });
          subscriber.complete();
        });
      }) as any;
      
      try {
        // Populate caches
        await firstValueFrom(service.getFirstDocumentPath('dir1'));
        await firstValueFrom(service.getFirstDocumentPath('dir2'));
        
        // Clear all caches
        service.clearCache();
        
        // Make another call - should make a new HTTP call
        await firstValueFrom(service.getFirstDocumentPath('dir1'));
        expect(callCount).toBe(3); // Should have made three calls total (dir1, dir2, dir1 again)
      } finally {
        // Restore original mock
        mockHttpClient.get = originalGet;
      }
    });
  });
});
