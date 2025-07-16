import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, firstValueFrom, Subject, map } from 'rxjs';
import { ContentService } from './content.service';
import { PathUtils } from '../utils/path.utils';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ContentItem } from './content.interface';
import { StorageService } from './storage.service';

// Mock console.error
const originalConsoleError = console.error;
console.error = vi.fn();

// Mock HttpClient
const mockHttpClient = {
  get: vi.fn()
};

// Mock StorageService
const mockStorageService = {
  get: vi.fn(() => of(null as any)),
  set: vi.fn(() => of({})),
  remove: vi.fn(() => of({})),
  clear: vi.fn(() => of({}))
};

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ContentService,
        { provide: HttpClient, useValue: mockHttpClient },
        { provide: StorageService, useValue: mockStorageService }
      ]
    });
    service = TestBed.inject(ContentService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getContent', () => {
    it('should fetch content from API when no cache exists', async () => {
      const apiResponse = { path: 'test', items: [{ name: 'file.md', path: 'test/file.md', isDirectory: false, metadata: { title: 'file.md' } }], count: 1 };
      mockStorageService.get.mockReturnValueOnce(of(null));
      mockHttpClient.get.mockReturnValueOnce(of(apiResponse));
      const result = await firstValueFrom(service.getContent('test'));
      expect(result[0].name).toBe('file.md');
      expect(result[0].path).toBe('test/file.md');
      expect(mockHttpClient.get).toHaveBeenCalled();
    });

    it('should use cache when available and not expired', async () => {
      const cached = { data: [{ name: 'cached.md', path: 'cached.md', isDirectory: false, metadata: { title: 'cached.md' } }], expires: Date.now() + 10000 };
      mockStorageService.get.mockReturnValueOnce(of(cached));
      const result = await firstValueFrom(service.getContent('cached'));
      expect(result[0].name).toBe('cached.md');
      expect(result[0].path).toBe('cached.md');
      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });

    it('should skip cache when skipCache is true', async () => {
      const apiResponse = { path: 'skip', items: [{ name: 'skip.md', path: 'skip/skip.md', isDirectory: false, metadata: { title: 'skip.md' } }], count: 1 };
      mockStorageService.get.mockReturnValueOnce(of([{ name: 'cached.md', path: 'skip/cached.md', isDirectory: false, metadata: { title: 'cached.md' } }]));
      mockHttpClient.get.mockReturnValueOnce(of(apiResponse));
      const result = await firstValueFrom(service.getContent('skip', true));
      expect(result[0].name).toBe('skip.md');
      expect(result[0].path).toBe('skip/skip.md');
      expect(mockHttpClient.get).toHaveBeenCalled();
    });

    it('should handle API error gracefully', async () => {
      mockStorageService.get.mockReturnValueOnce(of(null));
      mockHttpClient.get.mockReturnValueOnce(throwError(() => new Error('API error')));
      await expect(async () => {
        await firstValueFrom(service.getContent('error'));
      }).rejects.toThrowError(/Failed to load content/); // Service throws user-friendly error
    });
  });

  describe('preloadContent', () => {
    it('should preload content for a path', () => {
      mockStorageService.get.mockReturnValueOnce(of(null));
      mockHttpClient.get.mockReturnValueOnce(of({ path: 'preload', items: [], count: 0 }));
      service.preloadContent('preload');
      expect(mockHttpClient.get).toHaveBeenCalled();
    });

    it('should not preload if already loading', () => {
      const pendingRequest = new Subject<any>();
      mockHttpClient.get.mockReturnValue(pendingRequest.asObservable());

      service.preloadContent('preload');
      service.preloadContent('preload');

      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      
      // Complete the observable to allow cleanup and prevent open handles
      pendingRequest.next({ path: 'preload', items: [], count: 0 });
      pendingRequest.complete();
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific path', async () => {
      mockStorageService.remove.mockReturnValueOnce(of({}));
      await firstValueFrom(service.clearCache('test-path'));
      expect(mockStorageService.remove).toHaveBeenCalledWith('content_test-path');
    });
    
    it('should clear all cache when no path provided', async () => {
      mockStorageService.clear.mockReturnValueOnce(of({}));
        await firstValueFrom(service.clearCache());
        expect(mockStorageService.clear).toHaveBeenCalled();
      });
  });

  describe('fetchContent', () => {
    it('should handle successful API response', async () => {
      const apiResponse = { path: 'fetch', items: [{ name: 'fetch.md', path: 'fetch/fetch.md', isDirectory: false, metadata: { title: 'fetch.md' } }], count: 1 };
      mockHttpClient.get.mockReturnValueOnce(of(apiResponse));
      const result = await firstValueFrom(service['fetchContent']('fetch'));
      expect(result[0].name).toBe('fetch.md');
      expect(result[0].path).toBe('fetch/fetch.md');
    });

    it('should handle 404 error gracefully', async () => {
      mockHttpClient.get.mockReturnValueOnce(throwError(() => ({ status: 404, statusText: 'Not Found', message: '404' })));
      const result = await firstValueFrom(service['fetchContent']('not-found'));
      expect(result).toEqual([]);
    });

    it('should throw user-friendly error on 403', async () => {
      mockHttpClient.get.mockReturnValueOnce(throwError(() => ({ status: 403, statusText: 'Forbidden', message: '403' })));
      await expect(firstValueFrom(service['fetchContent']('forbidden'))).rejects.toThrow('You do not have permission to access this content.');
    });

    it('should throw user-friendly error on 0', async () => {
      mockHttpClient.get.mockReturnValueOnce(throwError(() => ({ status: 0, statusText: '', message: 'Network error' })));
      await expect(firstValueFrom(service['fetchContent']('network'))).rejects.toThrow('Unable to connect to the content server. Please check your network connection.');
    });

    it('should throw user-friendly error on 500', async () => {
      mockHttpClient.get.mockReturnValueOnce(throwError(() => ({ status: 500, statusText: 'Server Error', message: '500' })));
      await expect(firstValueFrom(service['fetchContent']('server-error'))).rejects.toThrow('The content server is currently unavailable. Please try again later.');
    });
  });

  describe('transformStructure', () => {
    it('should transform raw items into ContentItem structure', () => {
      const rawItems = [{
        name: 'test.md',
        path: 'docs/test.md',
        isDirectory: false,
        metadata: { title: 'Test Title' }
      }];
      const result = service['transformStructure'](rawItems, 'docs');
      expect(result[0].name).toBe('Test Title');
      expect(result[0].path).toBe('docs/test.md'); // Service does not double prefix
    });

    it('should handle empty array', () => {
      const result = service['transformStructure']([]);
      expect(result).toEqual([]);
    });

    it('should handle non-array items', () => {
      const result = service['transformStructure']('not-an-array' as any);
      expect(result).toEqual([]);
    });
  });

  describe('updateCurrentTags', () => {
    it('should update current tags', () => {
      service.updateCurrentTags(['tag1', 'tag2']);
      service.currentTags$.subscribe(tags => {
        expect(tags).toEqual(['tag1', 'tag2']);
      });
    });

    it('should handle empty tags', () => {
      service.updateCurrentTags([]);
      service.currentTags$.subscribe(tags => {
        expect(tags).toEqual([]);
      });
    });
  });
});

