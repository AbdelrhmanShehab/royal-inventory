'use strict';

/**
 * permissions.cache.js
 * In-memory cache for role permissions loaded from ops.role_permissions table.
 * Refreshes automatically every CACHE_TTL_MS or on explicit invalidation.
 *
 * Usage:
 *   const { hasPermission, invalidateCache } = require('./permissions.cache');
 *   if (!await hasPermission('warehouse_manager', 'submit_approval')) { ... }
 */

const { getSystemDB } = require('../config/database');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cache = null;       // { [role]: { [permKey]: boolean } }
let _loadedAt = 0;       // timestamp of last successful load
let _loadPromise = null; // in-flight load promise (prevents stampede)

/**
 * Load permissions from DB and store in cache.
 */
async function _loadFromDB() {
  const pool = getSystemDB();
  const result = await pool.request().query(`
    SELECT role, permission_key AS permKey, allowed
    FROM ops.role_permissions
  `);

  const matrix = {};
  for (const row of result.recordset) {
    if (!matrix[row.role]) matrix[row.role] = {};
    matrix[row.role][row.permKey] = row.allowed === true || row.allowed === 1;
  }

  _cache    = matrix;
  _loadedAt = Date.now();
  return matrix;
}

/**
 * Get the permissions matrix, loading from DB if needed.
 */
async function getMatrix() {
  if (_cache && (Date.now() - _loadedAt) < CACHE_TTL_MS) {
    return _cache;
  }

  // Prevent concurrent DB hits (promise coalescing)
  if (!_loadPromise) {
    _loadPromise = _loadFromDB().finally(() => { _loadPromise = null; });
  }
  return _loadPromise;
}

/**
 * Check if a role has a specific permission.
 * @param {string} role
 * @param {string} permKey
 * @returns {Promise<boolean>}
 */
async function hasPermission(role, permKey) {
  try {
    const matrix = await getMatrix();
    return matrix[role]?.[permKey] === true;
  } catch (err) {
    // Fail-safe: if DB is unreachable, deny access (never silently allow)
    console.error('[PermCache] Failed to load permissions:', err.message);
    return false;
  }
}

/**
 * Force-invalidate the cache (call after admin saves permissions).
 */
function invalidateCache() {
  _cache    = null;
  _loadedAt = 0;
  console.log('[PermCache] Cache invalidated — will reload on next request');
}

module.exports = { hasPermission, invalidateCache, getMatrix };
