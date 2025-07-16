import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';

// Mock console.error
const originalConsoleError = console.error;
console.error = vi.fn();

describe('StorageService', () => {
  let service: StorageService;
  let fallbackStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fallbackStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    // Patch global window/localStorage/localforage for fallback logic
    (globalThis as any).window = {
      localforage: undefined
    };
    (globalThis as any).localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    service = new StorageService();
    // Force fallback for all tests
    (service as any).store = fallbackStorage;
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

  describe('get', () => {
    it('should return null if store is not initialized', async () => {
      (service as any).store = undefined;
      const result = await firstValueFrom(service.get('foo'));
      expect(result).toBeNull();
    });

    it('should return null if item not found', async () => {
      fallbackStorage.getItem.mockResolvedValueOnce(null);
      const result = await firstValueFrom(service.get('notfound'));
      expect(result).toBeNull();
    });

    it('should return data if item found and not expired', async () => {
      const now = Date.now();
      fallbackStorage.getItem.mockResolvedValueOnce({ data: 'bar', expires: now + 10000 });
      const result = await firstValueFrom(service.get('found'));
      expect(result).toBe('bar');
    });

    it('should remove and return null if expired', async () => {
      const now = Date.now();
      fallbackStorage.getItem.mockResolvedValueOnce({ data: 'baz', expires: now - 100 });
      fallbackStorage.removeItem.mockResolvedValueOnce(undefined);
      const result = await firstValueFrom(service.get('expired'));
      expect(result).toBeNull();
      expect(fallbackStorage.removeItem).toHaveBeenCalled();
    });

    it('should catch errors and return null', async () => {
      fallbackStorage.getItem.mockRejectedValueOnce(new Error('fail'));
      const result = await firstValueFrom(service.get('fail'));
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set an item and return value', async () => {
      fallbackStorage.setItem.mockResolvedValueOnce({ data: 'foo', expires: 123 });
      const result = await firstValueFrom(service.set('key', 'val', 1000));
      expect(result).toBe('val');
      expect(fallbackStorage.setItem).toHaveBeenCalled();
    });

    it('should return value if store is not initialized', async () => {
      (service as any).store = undefined;
      const result = await firstValueFrom(service.set('key', 'val', 1000));
      expect(result).toBe('val');
    });

    it('should catch errors and return value', async () => {
      fallbackStorage.setItem.mockRejectedValueOnce(new Error('fail'));
      const result = await firstValueFrom(service.set('key', 'val', 1000));
      expect(result).toBe('val');
    });
  });

  describe('remove', () => {
    it('should remove an item', async () => {
      fallbackStorage.removeItem.mockResolvedValueOnce(undefined);
      const result = await firstValueFrom(service.remove('key'));
      expect(result).toBeUndefined();
      expect(fallbackStorage.removeItem).toHaveBeenCalled();
    });

    it('should return undefined if store is not initialized', async () => {
      (service as any).store = undefined;
      const result = await firstValueFrom(service.remove('key'));
      expect(result).toBeUndefined();
    });

    it('should catch errors and return undefined', async () => {
      fallbackStorage.removeItem.mockRejectedValueOnce(new Error('fail'));
      const result = await firstValueFrom(service.remove('key'));
      expect(result).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all items', async () => {
      fallbackStorage.clear.mockResolvedValueOnce(undefined);
      const result = await firstValueFrom(service.clear());
      expect(result).toBeUndefined();
      expect(fallbackStorage.clear).toHaveBeenCalled();
    });

    it('should return undefined if store is not initialized', async () => {
      (service as any).store = undefined;
      const result = await firstValueFrom(service.clear());
      expect(result).toBeUndefined();
    });

    it('should catch errors and return undefined', async () => {
      fallbackStorage.clear.mockRejectedValueOnce(new Error('fail'));
      const result = await firstValueFrom(service.clear());
      expect(result).toBeUndefined();
    });
  });
});

