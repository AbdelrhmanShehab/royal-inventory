'use strict';

/**
 * asyncHandler — wraps async route handlers to catch errors automatically.
 * Eliminates try/catch boilerplate in every controller.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
