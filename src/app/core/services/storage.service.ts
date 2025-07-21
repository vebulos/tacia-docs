import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getLogger } from './logging/logger';
const LOG = getLogger('StorageService');

declare global {
  interface Window {
    localforage?: {
      createInstance(config: any): LocalForageInstance;
      INDEXEDDB: string;
      WEBSQL: string;
      LOCALSTORAGE: string;
    };
  }
}

interface LocalForageInstance {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<T>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  length(): Promise<number>;
  key(keyIndex: number): Promise<string>;
  keys(): Promise<string[]>;
  iterate<T, U>(
    iteratee: (value: T, key: string, iterationNumber: number) => U,
    callback?: (err: any, result: U) => void
  ): Promise<U>;
}

interface FallbackStorage {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<T>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface CacheItem<T> {
  data: T;
  expires: number;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private store: LocalForageInstance | FallbackStorage;
  private readonly PREFIX = 'mxc-docs-';
  private readonly isLocalForageAvailable: boolean;

  constructor() {
    this.isLocalForageAvailable = this.checkLocalForageAvailability();
    
    if (this.isLocalForageAvailable && window.localforage) {
      try {
        this.store = window.localforage.createInstance({
          name: 'mxc-docs-cache',
          storeName: 'content_cache',
          driver: [
            window.localforage.INDEXEDDB,
            window.localforage.WEBSQL,
            window.localforage.LOCALSTORAGE
          ]
        });
        LOG.info('Using localforage with IndexedDB/WebSQL', {
          storageType: 'IndexedDB/WebSQL',
          storeName: 'content_cache'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      LOG.warn('Failed to initialize localforage, falling back to localStorage', {
        error: errorMessage,
        stack: errorStack
      });
        this.store = this.createFallbackStorage();
      }
    } else {
      LOG.warn('localforage not available, using localStorage fallback', {
        reason: this.isLocalForageAvailable ? 'Initialization error' : 'localforage not detected'
      });
      this.store = this.createFallbackStorage();
    }
  }

  private checkLocalForageAvailability(): boolean {
    return typeof window !== 'undefined' && 
           !!window.localforage &&
           typeof window.localforage.createInstance === 'function';
  }

  private createFallbackStorage(): FallbackStorage {
    const service = this; // Capture 'this' for use in callbacks
    
    return {
      getItem: <T>(key: string): Promise<T | null> => {
        try {
          const item = localStorage.getItem(service.PREFIX + key);
          return Promise.resolve(item ? JSON.parse(item) : null);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          LOG.error('Error reading from localStorage', {
            key: service.PREFIX + key,
            error: errorMessage,
            stack: errorStack
          });
          return Promise.resolve(null);
        }
      },
      setItem: <T>(key: string, value: T): Promise<T> => {
        try {
          localStorage.setItem(service.PREFIX + key, JSON.stringify(value));
          return Promise.resolve(value);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          LOG.error('Error writing to localStorage', {
            key: service.PREFIX + key,
            error: errorMessage,
            stack: errorStack
          });
          return Promise.reject(error);
        }
      },
      removeItem: (key: string): Promise<void> => {
        try {
          localStorage.removeItem(service.PREFIX + key);
          return Promise.resolve();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          LOG.error('Error removing from localStorage', {
            key: service.PREFIX + key,
            error: errorMessage,
            stack: errorStack
          });
          return Promise.reject(error);
        }
      },
      clear: (): Promise<void> => {
        try {
          Object.keys(localStorage)
            .filter(key => key.startsWith(service.PREFIX))
            .forEach(key => localStorage.removeItem(key));
          return Promise.resolve();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          LOG.error('Error clearing storage', {
            prefix: service.PREFIX,
            error: errorMessage,
            stack: errorStack
          });
          return Promise.reject(error);
        }
      }
    };
  }

  /**
   * Get item from storage
   */
  get<T>(key: string): Observable<T | null> {
    if (!this.store) {
      LOG.error('Store is not initialized', { method: 'set', key });
      return of(null);
    }
    return from(Promise.resolve(this.store.getItem<CacheItem<T>>(key))).pipe(
      map((item: CacheItem<T> | null) => {
        if (!item) return null;
        if (item.expires && item.expires < Date.now()) {
          this.remove(key).subscribe();
          return null;
        }
        return item.data;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Set item in storage with TTL
   */
  set<T>(key: string, value: T, ttl: number = 24 * 60 * 60 * 1000): Observable<T> {
    if (!this.store) {
      LOG.error('Store is not initialized', { method: 'set', key });
      return of(value);
    }
    const item: CacheItem<T> = {
      data: value,
      expires: Date.now() + ttl
    };
    return from(Promise.resolve(this.store.setItem<CacheItem<T>>(key, item))).pipe(
      map(() => value),
      catchError(() => of(value))
    );
  }

  /**
   * Remove item from storage
   */
  remove(key: string): Observable<void> {
    if (!this.store) {
      LOG.error('Store is not initialized', { method: 'set', key });
      return of(undefined);
    }
    return from(Promise.resolve(this.store.removeItem(key))).pipe(
      map(() => undefined),
      catchError(error => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        LOG.error('Storage remove error', {
          key,
          error: errorMessage,
          stack: errorStack
        });
        return of(undefined);
      })
    );
  }

  /**
   * Clear all cached items
   */
  clear(): Observable<void> {
    if (!this.store) {
      LOG.error('Store is not initialized', { method: 'clear' });
      return of(undefined);
    }
    return from(Promise.resolve(this.store.clear())).pipe(
      map(() => undefined),
      catchError(error => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        LOG.error('Storage clear error', {
          error: errorMessage,
          stack: errorStack
        });
        return of(undefined);
      })
    );
  }
}
