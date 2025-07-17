import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { StructureService } from './structure.service';
import { StorageService } from './storage.service';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// Mock for fail function from jasmine/jest
const fail = (message: string) => { throw new Error(message); };

// Mock console.error
const originalConsoleError = console.error;
console.error = vi.fn();

// Mock StorageService
class MockStorageService {
  private storage = new Map<string, any>();
  
  get<T>(key: string): Observable<T | null> {
    return of(this.storage.get(key) || null);
  }
  
  set<T>(key: string, value: T): Observable<void> {
    this.storage.set(key, value);
    return of(undefined);
  }
  
  remove(key: string): Observable<void> {
    this.storage.delete(key);
    return of(undefined);
  }
  
  clear(): Observable<void> {
    this.storage.clear();
    return of(undefined);
  }
}

describe('StructureService', () => {
  let service: StructureService;
  let httpClient: HttpClient;
  let storageService: StorageService;
  
  const mockApiUrl = environment.apiUrl;
  const mockResponse = {
    path: '',
    items: [
      { name: 'folder1', path: 'folder1', isDirectory: true },
      { name: 'file1.md', path: 'file1.md', isDirectory: false }
    ],
    count: 2
  };
  
  // Mock HttpClient
  const mockHttpClient = {
    get: vi.fn()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StructureService,
        { provide: StorageService, useClass: MockStorageService },
        { provide: HttpClient, useValue: mockHttpClient }
      ]
    });

    service = TestBed.inject(StructureService);
    httpClient = TestBed.inject(HttpClient);
    storageService = TestBed.inject(StorageService);
    
    // Clear all mocks before each test
    vi.clearAllMocks();
    mockHttpClient.get.mockReset();
  });

  afterEach(() => {
    // No need to verify requests with our mock approach
  });

  afterAll(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getDirectory', () => {
    it('should fetch directory structure from API and cache it', async () => {
      const testPath = 'test/path';
      
      // Mock HTTP response
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      
      // First call - should make HTTP request
      await firstValueFrom(service.getDirectory(testPath));
      
      // Verify HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${mockApiUrl}/structure/${testPath}`
      );
      
      // Reset mock to verify no more calls
      mockHttpClient.get.mockReset();
      
      // Second call - should use cache
      await firstValueFrom(service.getDirectory(testPath));
      
      // No additional HTTP request should be made
      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });
    
    it('should handle API errors gracefully', async () => {
      const testPath = 'error/path';
      const errorMessage = 'API Error';
      
      // Mock HTTP error
      mockHttpClient.get.mockReturnValueOnce(throwError(() => ({ 
        status: 500, 
        statusText: 'Server Error',
        message: errorMessage
      })));
      
      try {
        await firstValueFrom(service.getDirectory(testPath));
        fail('should have failed with error');
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'message' in error) {
          expect((error as { message: string }).message).toContain('Failed to load directory');
        } else {
          fail('Error is not an object with a message');
        }
        expect(console.error).toHaveBeenCalled();
      }
      
      // Verify HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${mockApiUrl}/structure/${testPath}`
      );
    });
    
    it('should skip cache when skipCache is true', async () => {
      const testPath = 'test/skip-cache';
      
      // Mock HTTP responses
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      
      // First call - should make HTTP request
      await firstValueFrom(service.getDirectory(testPath, true));
      
      // Verify first HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${mockApiUrl}/structure/${testPath}`
      );
      
      // Second call with skipCache: true - should make another HTTP request
      await firstValueFrom(service.getDirectory(testPath, true));
      
      // Verify second HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('preloadDirectory', () => {
    it('should preload directory without making duplicate requests', () => {
      const testPath = 'test/preload';
      
      // Mock HTTP response
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      
      // Should not be loading yet
      service.preloadDirectory(testPath);
      
      // Verify HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${mockApiUrl}/structure/${testPath}`
      );
      
      // Reset mock to verify no more calls
      mockHttpClient.get.mockReset();
      
      // Second preload should not make another request
      service.preloadDirectory(testPath);
      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });
  });
  
  describe('clearCache', () => {
    it('should clear cache for specific path', async () => {
      const testPath = 'test/clear';
      
      // Mock HTTP responses
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      
      // First load to populate cache
      await firstValueFrom(service.getDirectory(testPath));
      
      // Verify first HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${mockApiUrl}/structure/${testPath}`
      );
      
      // Clear cache
      await firstValueFrom(service.clearCache(testPath));
      
      // Next request should hit the server again
      await firstValueFrom(service.getDirectory(testPath));
      
      // Verify second HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
    
    it('should clear all caches when no path provided', async () => {
      const testPath = 'test/all';
      
      // Mock HTTP responses
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      mockHttpClient.get.mockReturnValueOnce(of(mockResponse));
      
      // First load to populate cache
      await firstValueFrom(service.getDirectory(testPath));
      
      // Verify first HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${mockApiUrl}/structure/${testPath}`
      );
      
      // Clear all caches
      await firstValueFrom(service.clearCache());
      
      // Next request should hit the server again
      await firstValueFrom(service.getDirectory(testPath));
      
      // Verify second HTTP call was made
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
