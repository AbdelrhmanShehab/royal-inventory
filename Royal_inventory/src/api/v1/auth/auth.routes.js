'use strict';

const router = require('express').Router();

const controller  = require('./auth.controller');
const validate    = require('../../../middleware/validate.middleware');
const { authenticate }  = require('../../../middleware/auth.middleware');
const { authLimiter }   = require('../../../middleware/rateLimiter.middleware');
const { loginSchema, refreshSchema, changePasswordSchema } = require('./auth.validation');

/**
 * Auth Routes
 * Base: /api/v1/auth
 */

// POST /login — public, strict rate limit
router.post('/login',
  authLimiter,
  validate(loginSchema),
  controller.login
);

// POST /refresh — use refresh token from cookie or body
router.post('/refresh',
  validate(refreshSchema),
  controller.refresh
);

// POST /logout — must be authenticated
router.post('/logout',
  authenticate,
  controller.logout
);

// POST /change-password — must be authenticated
router.post('/change-password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword
);

// GET /me — get current user info
router.get('/me',
  authenticate,
  controller.me
);

module.exports = router;
