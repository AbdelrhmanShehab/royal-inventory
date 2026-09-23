'use strict';

/**
 * node.cache.js
 * In-memory cache for warehouse node descendants scoped to users.
 * Supports multiple warehouse nodes assigned to a single user.
 *
 * Usage:
 *   const { getAllowedNodeIdsForUser, invalidateCache } = require('./node.cache');
 *   const allowedNodeIds = await getAllowedNodeIdsForUser(req.user.id);
 */

const { getSystemDB, sql } = require('../config/database');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cache = {};       // { [userId]: { allowedNodeIds: number[], loadedAt: number } }
let _loadPromises = {}; // { [userId]: Promise<number[]> } (prevents stampede)

/**
 * Fetch descendants for all nodes linked to a user in a single recursive CTE.
 */
async function _fetchUserDescendantsFromDB(userId) {
  const pool = getSystemDB();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      WITH Descendants AS (
        SELECT node_id 
        FROM ops.inventory_nodes 
        WHERE node_id IN (
          SELECT node_id FROM ops.user_nodes WHERE user_id = @userId
          UNION
          SELECT node_id FROM ops.app_users WHERE user_id = @userId AND node_id IS NOT NULL
        )
        
        UNION ALL
        
        SELECT child.node_id
        FROM ops.inventory_nodes child
        INNER JOIN Descendants parent ON child.parent_node_id = parent.node_id
      )
      SELECT DISTINCT node_id FROM Descendants
    `);

  const allowedNodeIds = result.recordset.map(r => r.node_id);
  _cache[userId] = {
    allowedNodeIds,
    loadedAt: Date.now(),
  };
  return allowedNodeIds;
}

/**
 * Get all allowed node IDs for a user (including descendants of all their assigned nodes).
 * Uses cache if fresh.
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
async function getAllowedNodeIdsForUser(userId) {
  if (!userId) return [];

  const cached = _cache[userId];
  if (cached && (Date.now() - cached.loadedAt) < CACHE_TTL_MS) {
    return cached.allowedNodeIds;
  }

  // Prevent concurrent DB queries for the same userId (promise coalescing)
  if (!_loadPromises[userId]) {
    _loadPromises[userId] = _fetchUserDescendantsFromDB(userId).finally(() => {
      delete _loadPromises[userId];
    });
  }

  return _loadPromises[userId];
}

/**
 * Invalidate the cache (call when node tree or user assignments change)
 */
function invalidateCache() {
  _cache = {};
  _loadPromises = {};
  console.log('[NodeCache] Cache invalidated — will reload on next request');
}

module.exports = {
  getAllowedNodeIdsForUser,
  invalidateCache,
};
