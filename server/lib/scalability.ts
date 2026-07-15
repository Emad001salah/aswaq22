/**
 * Scalability & Performance Utility Layer
 * 
 * This service provides abstractions for:
 * 1. Simple In-Memory Caching (Ready for Redis upgrade)
 * 2. Rate Limiting Protection
 */

class ScalabilityService {
  private cache: Map<string, { data: any, expiry: number }> = new Map();
  private rateLimitMap: Map<string, { count: number, resetTime: number }> = new Map();
  private burstMap: Map<string, { count: number, resetTime: number }> = new Map();
  private pendingPromises: Map<string, Promise<any>> = new Map();
  
  // Telemetry
  private hits = 0;
  private misses = 0;

  // --- CACHE SECTION ---
  
  /**
   * Enhanced Get or Set (Prevents Cache Stampede)
   * If a key is being fetched, return the existing promise.
   */
  async getOrSet<T>(namespace: string, key: string, fetchFn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const fullKey = `${namespace}:${key}`;
    const cached = this.getCache(namespace, key);
    
    if (cached) {
      this.hits++;
      return cached;
    }

    // Check if another request is already fetching this exact key
    if (this.pendingPromises.has(fullKey)) {
      this.hits++; // "Virtual" hit on the pending promise
      return this.pendingPromises.get(fullKey);
    }

    this.misses++;
    const fetchPromise = fetchFn().finally(() => {
      this.pendingPromises.delete(fullKey);
    });

    this.pendingPromises.set(fullKey, fetchPromise);
    
    const result = await fetchPromise;
    this.setCache(namespace, key, result, ttlSeconds);
    return result;
  }
  /**
   * Set data in cache with TTL (Time To Live)
   * Namespaces are used to logically separate ads, categories, etc.
   */
  setCache(namespace: string, key: string, data: any, ttlSeconds: number = 300) {
    const fullKey = `${namespace}:${key}`;
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(fullKey, { data, expiry });
  }

  /**
   * Get data from cache. Cleans up if expired.
   */
  getCache(namespace: string, key: string): any | null {
    const fullKey = `${namespace}:${key}`;
    const cached = this.cache.get(fullKey);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(fullKey);
      return null;
    }

    return cached.data;
  }

  /**
   * Explicit Invalidation for a specific namespace or key
   */
  invalidate(namespace: string, key?: string) {
    if (key) {
      this.cache.delete(`${namespace}:${key}`);
    } else {
      // Invalidate whole namespace (In-memory scan - okay for MVP)
      for (const k of this.cache.keys()) {
        if (k.startsWith(`${namespace}:`)) {
          this.cache.delete(k);
        }
      }
    }
  }

  // --- RATE LIMITING SECTION ---

  /**
   * Unified Security Check (Standard + Burst Protection)
   * Prevents standard flooding and sudden spike (burst) attacks.
   */
  checkSecurity(identifier: string): { limited: boolean, reason?: 'burst' | 'standard' } {
    // 1. Burst Check (e.g., 10 requests per 2 seconds)
    if (this.isBurstLimited(identifier, 10, 2000)) {
      return { limited: true, reason: 'burst' };
    }

    // 2. Standard Check (e.g., 100 requests per minute)
    if (this.isRateLimited(identifier, 100, 60000)) {
      return { limited: true, reason: 'standard' };
    }

    return { limited: false };
  }

  /**
   * Internal Burst Limiter
   */
  private isBurstLimited(identifier: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const record = this.burstMap.get(identifier);

    if (!record || now > record.resetTime) {
      this.burstMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return false;
    }

    if (record.count >= limit) return true;
    record.count += 1;
    return false;
  }

  /**
   * Simple Rate Limiter to prevent API abuse
   * Default: 100 requests per minute per identifier (e.g., IP)
   */
  isRateLimited(identifier: string, limit: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return false;
    }

    if (record.count >= limit) {
      return true;
    }

    record.count += 1;
    return false;
  }

  /**
   * Clear cache periodically
   */
  flush() {
    this.cache.clear();
    this.pendingPromises.clear();
  }

  /**
   * Get telemetry status
   */
  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      cacheSize: this.cache.size,
      pending: this.pendingPromises.size,
      rateLimitEntries: this.rateLimitMap.size
    };
  }
}

export const scalability = new ScalabilityService();
