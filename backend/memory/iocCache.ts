/**
 * AEGIS-X Backend — IOC Cache
 * Transparent TTL-based cache for IOC lookups.
 * Agents call lookupIOC() without knowing cache vs. live.
 */

import type { IOCItem, IOCType } from '../core/types.js';
import { config } from '../core/config.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('memory:ioc-cache');

interface CacheEntry {
  ioc: IOCItem;
  cachedAt: number;
  expiresAt: number;
  hitCount: number;
}

class IOCCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  set(value: string, ioc: IOCItem): void {
    const now = Date.now();
    if (this.store.size >= config.iocCache.maxEntries) {
      this.evictOldest();
    }
    this.store.set(value.toLowerCase(), {
      ioc,
      cachedAt: now,
      expiresAt: now + config.iocCache.ttlMs,
      hitCount: 0,
    });
  }

  get(value: string): IOCItem | null {
    const entry = this.store.get(value.toLowerCase());
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(value.toLowerCase());
      this.misses++;
      return null;
    }
    entry.hitCount++;
    this.hits++;
    return entry.ioc;
  }

  has(value: string): boolean {
    return this.get(value) !== null;
  }

  invalidate(value: string): void {
    this.store.delete(value.toLowerCase());
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [k, v] of this.store.entries()) {
      if (v.cachedAt < oldestTime) {
        oldestTime = v.cachedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) this.store.delete(oldestKey);
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : Math.round((this.hits / total) * 100);
  }

  get size(): number {
    return this.store.size;
  }

  getStats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hitRate,
      maxEntries: config.iocCache.maxEntries,
      ttlMs: config.iocCache.ttlMs,
    };
  }

  // Periodic cleanup of expired entries
  cleanup(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [k, v] of this.store.entries()) {
      if (now > v.expiresAt) {
        this.store.delete(k);
        evicted++;
      }
    }
    if (evicted > 0) {
      log.debug(`IOC cache cleanup: evicted ${evicted} expired entries`);
    }
  }
}

export const iocCache = new IOCCache();

// Run cleanup every 10 minutes
setInterval(() => iocCache.cleanup(), 600_000);
