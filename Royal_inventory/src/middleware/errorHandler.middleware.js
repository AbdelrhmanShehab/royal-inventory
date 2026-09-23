'use strict';

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const config = require('../config/index');

/**
 * Global Error Handler Middleware
 *
 * Must be registered LAST in Express middleware chain.
 * Handles:
 *   - Our custom AppError subclasses (operational errors)
 *   - mssql DB errors
 *   - JWT errors (caught before here by auth middleware, but just in case)
 *   - Unexpected errors (bugs)
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // ── Log the error ────────────────────────────────────────────────────────────
  if (err.isOperational) {
    // Known, expected error — log at warn level
    logger.warn('[ErrorHandler] Operational error', {
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      path: req.path,
      userId: req.user?.id,
    });
  } else {
    // Unexpected bug — log full stack at error level
    logger.error('[ErrorHandler] Unexpected error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      body: config.isDev ? req.body : '[hidden in production]',
    });
  }

  // ── SQL Server error handling ──────────────────────────────────────────────
  if (err.code === 'ETIMEOUT' || err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'قاعدة البيانات غير متاحة مؤقتاً',
      data: null,
      meta: null,
      errors: null,
      code: 'DB_UNAVAILABLE',
    });
  }

  // Unique constraint violation (SQL Server error number 2627)
  if (err.number === 2627 || err.number === 2601) {
    return res.status(409).json({
      success: false,
      message: 'هذه البيانات موجودة مسبقاً',
      data: null,
      meta: null,
      errors: null,
      code: 'DUPLICATE_ENTRY',
    });
  }

  // ── AppError (our custom errors) ─────────────────────────────────────────────
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
      meta: null,
      errors: err.errors ?? null,
      code: err.code,
    });
  }

  // ── Fallback: unexpected server error ─────────────────────────────────────────
  const statusCode = err.statusCode ?? err.status ?? 500;

  return res.status(statusCode).json({
    success: false,
    message: config.isDev ? err.message : 'خطأ داخلي في الخادم — يرجى المحاولة لاحقاً',
    data: null,
    meta: null,
    errors: config.isDev ? err.stack : null,
    code: 'SERVER_ERROR',
  });
};

/**
 * 404 handler — for routes that don't exist.
 * Register this BEFORE the error handler but AFTER all routes.
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `المسار "${req.originalUrl}" غير موجود`,
    data: null,
    meta: null,
    errors: null,
    code: 'ROUTE_NOT_FOUND',
  });
};

module.exports = { errorHandler, notFoundHandler };
