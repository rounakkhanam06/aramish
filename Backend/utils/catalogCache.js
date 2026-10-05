// Short-lived in-memory cache for public catalog GET responses (homepage, product lists).
// Every app open hits these endpoints; caching for CACHE_TTL_MS turns thousands of identical
// requests into one database query per URL. Concurrent misses for the same URL share a single
// computation. Any successful admin catalog write clears the cache (see clearCatalogCache in app.js),
// so admins see their changes immediately; stock/sales shown in lists may lag by up to the TTL,
// which is fine because checkout always re-reads stock from the database.

const CACHE_TTL_MS = 45 * 1000;
const MAX_ENTRIES = 300; // URLs with cache-busting params (?t=...) would otherwise grow the map forever

const store = new Map();    // url -> { body, expiresAt }
const inFlight = new Map(); // url -> Promise<body | null>
let generation = 0;         // bumped on clear, so a computation started before a clear isn't stored

const clearCatalogCache = () => {
  generation += 1;
  store.clear();
};

const remember = (key, body) => {
  if (store.size >= MAX_ENTRIES) {
    // Maps iterate in insertion order: drop the oldest entry
    store.delete(store.keys().next().value);
  }
  store.set(key, { body, expiresAt: Date.now() + CACHE_TTL_MS });
};

// Express middleware. Place after attachAdminIfPresent where it is used, so admin requests
// (which can include admin-only fields) are never served from or written to the cache.
const cachePublicCatalog = (req, res, next) => {
  if (req.method !== 'GET' || req.admin) return next();

  const key = req.originalUrl;
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    res.set('X-Cache', 'HIT');
    return res.status(200).json(hit.body);
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending.then((body) => (body ? res.status(200).json(body) : next()));
  }

  let settle;
  const promise = new Promise((resolve) => { settle = resolve; });
  inFlight.set(key, promise);
  const startedAt = generation;

  const finish = (body) => {
    if (inFlight.get(key) !== promise) return;
    inFlight.delete(key);
    settle(body);
  };

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const cacheable = res.statusCode === 200 && body && body.success !== false;
    if (cacheable && startedAt === generation) remember(key, body);
    finish(cacheable ? body : null);
    return originalJson(body);
  };
  // The handler threw or the client went away before a response: release any waiters
  res.on('close', () => finish(null));

  res.set('X-Cache', 'MISS');
  next();
};

module.exports = { cachePublicCatalog, clearCatalogCache, CACHE_TTL_MS };
