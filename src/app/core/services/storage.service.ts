import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Type declaration for localforage
declare const localforage: {
  createInstance(config: any): LocalForage;
  INDEXEDDB: string;
  WEBSQL: string;
  LOCALSTORAGE: string;
};

interface LocalForage {
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

// Type assertion pour le store
interface LocalForageStore {
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
  private store: LocalForageStore | null = null;

  constructor() {
    this.store = localforage.createInstance({
      name: 'mxc-docs-cache',
      storeName: 'content_cache',
      driver: [
        localforage.INDEXEDDB,
        localforage.WEBSQL,
        localforage.LOCALSTORAGE
      ]
    });
  }

  /**
   * Get item from storage
   */
  get<T>(key: string): Observable<T | null> {
    if (!this.store) {
      console.error('LocalForage store is not initialized');
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
      console.error('LocalForage store is not initialized');
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
      console.error('LocalForage store is not initialized');
      return of(undefined);
    }
    return from(Promise.resolve(this.store.removeItem(key))).pipe(
      map(() => undefined),
      catchError(error => {
        console.error('Storage remove error:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Clear all cached items
   */
  clear(): Observable<void> {
    if (!this.store) {
      console.error('LocalForage store is not initialized');
      return of(undefined);
    }
    return from(Promise.resolve(this.store.clear())).pipe(
      map(() => undefined),
      catchError(error => {
        console.error('Storage clear error:', error);
        return of(undefined);
      })
    );
  }
}
