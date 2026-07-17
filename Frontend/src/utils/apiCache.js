/**
 * apiCache.js — Lightweight in-memory + sessionStorage API cache
 *
 * Usage:
 *   import { cachedFetch } from '../utils/apiCache';
 *   const data = await cachedFetch('/admin/catalog/products?status=Approved', { ttl: 300 });
 *
 * Options:
 *   ttl  — Time-To-Live in seconds (default: 300 = 5 minutes)
 *   persist — Also store in sessionStorage (survives soft refreshes, default: true)
 */

// In-memory store: { key: { data, expiresAt } }
const memCache = new Map();

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
console.log('--- API Base URL loaded in frontend apiCache.js: ---', API_BASE);

export function invalidateCache(path) {
  const key = API_BASE + path;
  memCache.delete(key);
  try { sessionStorage.removeItem(`apicache:${key}`); } catch (_) {}
}

/** Clear all cached entries */
export function clearAllCache() {
  memCache.clear();
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('apicache:'))
      .forEach(k => sessionStorage.removeItem(k));
  } catch (_) {}
}

/**
 * Main cached fetch function.
 * Returns the parsed JSON data (not the Response).
 * On network failure, returns stale cached data if available (offline resilience).
 */
export async function cachedFetch(path, { ttl = 300, persist = true, signal } = {}) {
  const url = API_BASE + path;
  const cacheKey = url;
  const storageKey = `apicache:${cacheKey}`;
  const now = Date.now();

  // 1. Check in-memory cache first (fastest)
  const mem = memCache.get(cacheKey);
  if (mem && now < mem.expiresAt) {
    return mem.data;
  }

  // 2. Check sessionStorage (survives soft refresh / HMR)
  if (persist) {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const { data, expiresAt } = JSON.parse(raw);
        if (now < expiresAt) {
          // Re-hydrate in-memory cache from storage
          memCache.set(cacheKey, { data, expiresAt });
          return data;
        }
      }
    } catch (_) {}
  }

  // 3. Network fetch
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const expiresAt = now + ttl * 1000;
    memCache.set(cacheKey, { data, expiresAt });

    if (persist) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ data, expiresAt }));
      } catch (_) {} // Quota errors – silently ignore
    }

    return data;
  } catch (err) {
    // Network error: return stale data if we have any
    if (mem) {
      console.warn('[apiCache] Network error, returning stale data for:', path);
      return mem.data;
    }
    // Try stale sessionStorage
    if (persist) {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const { data } = JSON.parse(raw);
          console.warn('[apiCache] Network error, returning stale sessionStorage for:', path);
          return data;
        }
      } catch (_) {}
    }
    throw err; // Nothing cached, re-throw
  }
}

/**
 * Prefetch a set of common paths immediately (call on app boot).
 * Errors are silently swallowed.
 */
export async function prefetchCritical() {
  const PATHS = [
    ['/homepage', 30], // 30 seconds to avoid long-lived stale home data
  ];
  await Promise.allSettled(
    PATHS.map(([path, ttl]) => cachedFetch(path, { ttl }))
  );
}
