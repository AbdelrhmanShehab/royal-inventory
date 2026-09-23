'use strict';

const rateLimit = require('express-rate-limit');
const config    = require('../config/index');
const { tooManyRequests } = require('../utils/response.helper');

/**
 * Rate Limiter Middleware
 *
 * Three tiers:
 *   1. generalLimiter  — all API routes (100 req / 15 min per IP)
 *   2. authLimiter     — login/register only (10 req / 15 min per IP)
 *   3. syncLimiter     — manual sync trigger (5 req / hour per user)
 */

const buildLimiter = (options) => {
  const limiterConfig = {
    windowMs:         options.windowMs  ?? config.rateLimit.windowMs,
    max:              options.max,
    standardHeaders:  true,   // Return rate limit info in RateLimit-* headers
    legacyHeaders:    false,
    skipSuccessfulRequests: options.skipSuccessful ?? false,
    handler: (_req, res) => tooManyRequests(res, options.message),
  };

  if (options.keyGenerator) {
    limiterConfig.keyGenerator = options.keyGenerator;
    // Suppress express-rate-limit validation warnings for custom key generators
    limiterConfig.validate = false;
  }

  return rateLimit(limiterConfig);
};

// ── General API limiter ───────────────────────────────────────────────────────
const generalLimiter = buildLimiter({
  max:     config.rateLimit.maxRequests, // 100 per 15 min
  message: 'عدد الطلبات تجاوز الحد المسموح — يرجى الانتظار 15 دقيقة',
});

// ── Auth limiter (strict) ─────────────────────────────────────────────────────
const authLimiter = buildLimiter({
  max:     config.rateLimit.authMax, // 10 per 15 min
  message: 'محاولات تسجيل دخول كثيرة — يرجى الانتظار 15 دقيقة',
  skipSuccessful: true, // don't count successful logins against the limit
});

// ── Sync limiter (per user, not per IP) ──────────────────────────────────────
const syncLimiter = buildLimiter({
  max:       10,
  windowMs:  60 * 60 * 1000, // 1 hour
  message:   'لا يمكن تشغيل المزامنة أكثر من 5 مرات في الساعة',
  keyGenerator: (req) => req.user?.id?.toString() ?? req.ip,
});

module.exports = { generalLimiter, authLimiter, syncLimiter };
