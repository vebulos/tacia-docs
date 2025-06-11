import { Injectable } from '@angular/core';
import * as localforage from 'localforage';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface CacheItem<T> {
  data: T;
  expires: number;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private store: LocalForage;

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
    return from(this.store.getItem<CacheItem<T>>(key)).pipe(
      map(item => {
        if (!item) return null;
        if (item.expires && item.expires < Date.now()) {
          this.remove(key).subscribe(); // Clean up expired item
          return null;
        }
        return item.data;
      }),
      catchError(error => {
        console.error('Storage get error:', error);
        return of(null);
      })
    );
  }

  /**
   * Set item in storage with TTL
   */
  set<T>(key: string, value: T, ttl?: number): Observable<T> {
    const item: CacheItem<T> = {
      data: value,
      expires: ttl ? Date.now() + ttl : 0
    };

    return from(this.store.setItem<CacheItem<T>>(key, item)).pipe(
      map(() => value),
      catchError(error => {
        console.error('Storage set error:', error);
        throw error;
      })
    );
  }

  /**
   * Remove item from storage
   */
  remove(key: string): Observable<void> {
    return from(this.store.removeItem(key)).pipe(
      catchError(error => {
        console.error('Storage remove error:', error);
        throw error;
      })
    );
  }

  /**
   * Clear all cached items
   */
  clear(): Observable<void> {
    return from(this.store.clear()).pipe(
      catchError(error => {
        console.error('Storage clear error:', error);
        throw error;
      })
    );
  }
}
