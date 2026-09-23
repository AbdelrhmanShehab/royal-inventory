'use strict';

const { invalidateByPrefix, CACHE_KEYS } = require('../config/cache');

/**
 * Domain-specific cache invalidation helpers for the Operational Distribution Layer.
 */
function invalidateLocationCache(nodeId) {
  const key = CACHE_KEYS.OP_LOCATIONS(nodeId);
  invalidateByPrefix(key);
}

function invalidateSummaryCache(nodeId, itemCode = null) {
  // Clear general summary for this node
  invalidateByPrefix(CACHE_KEYS.OP_STOCK_SUMMARY(nodeId));
  
  // Clear specific item summaries
  if (itemCode) {
    invalidateByPrefix(CACHE_KEYS.OP_STOCK_SUMMARY_ITEM(nodeId, itemCode));
  } else {
    // If no item code is provided, invalidate all item summaries under this node prefix
    invalidateByPrefix(`ops:summary:${nodeId}:`);
  }
}

module.exports = {
  invalidateLocationCache,
  invalidateSummaryCache,
};
