'use strict';

const NodeCache = require('node-cache');
const config    = require('./index');
const logger    = require('../utils/logger');

/**
 * Application-level in-memory cache (NodeCache).
 *
 * TTL strategy:
 *   - Comsys master data (items, warehouses):  long TTL (config default = 5 min)
 *   - Operational stock balances:              short TTL (60s) — data changes often
 *   - Auth tokens blacklist:                   matches JWT expiry
 */

const cache = new NodeCache({
  stdTTL:      config.cache.ttlSeconds, // default TTL in seconds
  maxKeys:     config.cache.maxKeys,    // max number of keys stored
  checkperiod: 120,                     // check for expired keys every 2 min
  useClones:   false,                   // return references for performance
  deleteOnExpire: true,
});

// ── Events ────────────────────────────────────────────────────────────────────
cache.on('set',     (key)        => logger.debug('[Cache] SET', { key }));
cache.on('del',     (key)        => logger.debug('[Cache] DEL', { key }));
cache.on('expired', (key, value) => logger.debug('[Cache] EXPIRED', { key }));
cache.on('flush',   ()           => logger.warn('[Cache] FLUSHED — all keys cleared'));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get or Set pattern — if key exists return it, else call fetchFn and store result.
 * @param {string}   key
 * @param {Function} fetchFn  - async function that returns the data
 * @param {number}   [ttl]    - override TTL in seconds
 */
const getOrSet = async (key, fetchFn, ttl) => {
  const cached = cache.get(key);
  if (cached !== undefined) {
    logger.debug('[Cache] HIT', { key });
    return cached;
  }

  logger.debug('[Cache] MISS', { key });
  const data = await fetchFn();

  if (data !== null && data !== undefined) {
    ttl !== undefined
      ? cache.set(key, data, ttl)
      : cache.set(key, data);
  }

  return data;
};

/**
 * Invalidate all cache keys matching a prefix.
 * Example: invalidateByPrefix('warehouses:') clears all warehouse keys.
 */
const invalidateByPrefix = (prefix) => {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length > 0) {
    cache.del(keys);
    logger.debug('[Cache] Invalidated by prefix', { prefix, count: keys.length });
  }
};

/**
 * Cache key namespaces (prevents key collisions)
 */
const CACHE_KEYS = {
  COMSYS_WAREHOUSES: 'comsys:warehouses',
  COMSYS_ITEMS:      'comsys:items',
  COMSYS_UNITS:      'comsys:units',
  HOTEL_GROUPS:      'system:hotel_groups',
  INVENTORY_NODES:   'system:inventory_nodes',
  STOCK_NODE:        (nodeId) => `system:stock:node:${nodeId}`,
  BLACKLIST_TOKEN:   (jti)    => `auth:blacklist:${jti}`,
  OP_LOCATIONS:      (nodeId) => `ops:locations:node:${nodeId}`,
  OP_STOCK_SUMMARY:  (nodeId) => `ops:summary:node:${nodeId}`,
  OP_STOCK_SUMMARY_ITEM: (nodeId, itemCode) => `ops:summary:${nodeId}:${itemCode}`,
};

// TTL overrides (seconds)
const TTL = {
  COMSYS_MASTER:  300,  // 5 minutes  — Comsys data changes infrequently
  STOCK_BALANCE:  60,   // 60 seconds — Stock changes often
  TOKEN_BLACKLIST: 900, // 15 minutes — matches JWT_ACCESS_EXPIRES
  OP_LOCATIONS:   300,  // 5 minutes  — Locations change infrequently
  OP_STOCK_SUMMARY: 30, // 30 seconds — Stock summaries change frequently
};

module.exports = { cache, getOrSet, invalidateByPrefix, CACHE_KEYS, TTL };
