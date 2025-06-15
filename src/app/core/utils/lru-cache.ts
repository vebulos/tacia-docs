interface CacheItem<T> {
  value: T;
  lastAccessed: number;
  expires: number;
}

export class LruCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private hits = 0;
  private misses = 0;
  private maxSize: number;
  private defaultTtl: number;
  private cleanupInterval: number | null = null;

  constructor(maxSize: number = 50, defaultTtl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  set(key: string, value: T, ttl: number = this.defaultTtl): void {
    // If we exceed max size, remove the least recently used item
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.getLruKey();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, {
      value,
      lastAccessed: Date.now(),
      expires: Date.now() + ttl
    });

    // Schedule periodic cleanup
    this.scheduleCleanup();
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return undefined;
    }

    // Check if item has expired
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Update last access time
    item.lastAccessed = Date.now();
    this.hits++;
    return item.value;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: this.hits + this.misses > 0 
        ? (this.hits / (this.hits + this.misses)) * 100 
        : 0,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  private getLruKey(): string | undefined {
    let lruKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestAccess) {
        oldestAccess = item.lastAccessed;
        lruKey = key;
      }
    }

    return lruKey;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expires < now) {
        this.cache.delete(key);
      }
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanupInterval !== null) return;
    
    this.cleanupInterval = window.setTimeout(() => {
      this.cleanup();
      this.cleanupInterval = null;
    }, 60000); // Nettoyage toutes les minutes
  }
}
