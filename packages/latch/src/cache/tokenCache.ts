import { TokenCacheOptions } from '../types';

/**
 * Cached token entry
 */
export interface CachedToken {
  /** Access token for downstream API */
  accessToken: string;

  /** Expiration timestamp (milliseconds since epoch) */
  expiresAt: number;

  /** Granted scopes */
  scopes: string[];

  /** CAE state for claims challenge (optional) */
  caeState?: string;
}

/**
 * In-memory token cache for OBO tokens
 *
 * Cache key format: `${tenantId}|${userId}|${resource}|${scopes}|${caeState}`
 *
 * Features:
 * - Thread-safe operations
 * - LRU eviction when maxCacheSize is reached
 * - Automatic expiration with TTL buffer
 * - Separate cache instances per config
 */
export class TokenCache {
  private cache: Map<string, CachedToken> = new Map();
  private accessOrder: string[] = []; // For LRU eviction

  constructor(private options: Required<TokenCacheOptions>) {}

  /**
   * Get token from cache if valid
   *
   * @param key - Cache key
   * @returns Full cached entry if found and not expired, null otherwise
   */
  get(key: string): CachedToken | null {
    if (!this.options.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if token is expired (with buffer)
    const now = Date.now();
    const expiryWithBuffer = entry.expiresAt - this.options.ttlBufferSeconds * 1000;

    if (now >= expiryWithBuffer) {
      // Token expired, remove from cache
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      return null;
    }

    // Update LRU: move to end (most recently used)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    return entry;
  }

  /**
   * Store token in cache
   *
   * @param key - Cache key
   * @param accessToken - Access token to cache
   * @param expiresIn - Token lifetime in seconds
   * @param scopes - Granted scopes
   * @param caeState - CAE state (optional)
   */
  set(
    key: string,
    accessToken: string,
    expiresIn: number,
    scopes: string[],
    caeState?: string
  ): void {
    if (!this.options.enabled) {
      return;
    }

    // Calculate expiration timestamp
    const expiresAt = Date.now() + expiresIn * 1000;

    // Check if we need to evict (LRU)
    if (this.cache.size >= this.options.maxCacheSize) {
      const lruKey = this.accessOrder.shift(); // Remove least recently used
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    // Store token
    this.cache.set(key, {
      accessToken,
      expiresAt,
      scopes,
      caeState,
    });

    // Update access order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
  }

  /**
   * Remove token from cache
   *
   * @param key - Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
  }

  /**
   * Clear all cached tokens
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats
   */
  getStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
  } {
    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      enabled: this.options.enabled,
    };
  }
}

/**
 * Build cache key for OBO token
 *
 * Format: `${clientId}|${tenantId}|${userId}|${resource}|${scopes}|${caeState}`
 *
 * @param clientId - Your API's client ID (for cross-app isolation)
 * @param tenantId - Azure AD tenant ID
 * @param userId - User subject (sub claim)
 * @param resource - Downstream API resource/audience
 * @param scopes - Requested scopes (sorted)
 * @param caeState - CAE state (optional)
 * @returns Cache key
 */
export function buildCacheKey(
  clientId: string,
  tenantId: string,
  userId: string,
  resource: string,
  scopes: string[],
  caeState?: string
): string {
  const sortedScopes = [...scopes].sort().join(',');
  const parts = [clientId, tenantId, userId, resource, sortedScopes];

  if (caeState) {
    parts.push(caeState);
  }

  return parts.join('|');
}

/**
 * Global token cache instance
 * Shared across all OBO calls within the same process
 */
let globalCache: TokenCache | null = null;

/**
 * Get or create global token cache
 *
 * @param options - Cache options
 * @returns Token cache instance
 */
export function getTokenCache(options?: TokenCacheOptions): TokenCache {
  const cacheOptions: Required<TokenCacheOptions> = {
    enabled: options?.enabled ?? true,
    ttlBufferSeconds: options?.ttlBufferSeconds ?? 300, // 5 minutes
    maxCacheSize: options?.maxCacheSize ?? 1000,
  };

  if (!globalCache) {
    globalCache = new TokenCache(cacheOptions);
  }

  return globalCache;
}

/**
 * Reset global token cache (useful for testing)
 */
export function resetTokenCache(): void {
  globalCache = null;
}
