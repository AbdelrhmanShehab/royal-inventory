'use strict';

const router = require('express').Router();
const controller = require('./sync.controller');
const { authenticate }        = require('../../../middleware/auth.middleware');
const { authorizePermission } = require('../../../middleware/rbac.middleware');
const { syncLimiter }         = require('../../../middleware/rateLimiter.middleware');

/**
 * Sync Routes
 * Base: /api/v1/sync
 * All privileged operations are DB-permission-gated via authorizePermission.
 */

// GET /health — check Comsys connection
router.get('/health', authenticate, authorizePermission('run_sync'), controller.healthCheck);

// POST /run — trigger full manual sync
router.post('/run', authenticate, syncLimiter, authorizePermission('run_sync'), controller.runSync);

// GET /comsys-inbound — get inbound receipts (authenticated users, no extra perm)
router.get('/comsys-inbound', authenticate, controller.getComsysInbound);

// GET /explore/tables — list all Comsys DB tables (admin-tier tool)
router.get('/explore/tables',         authenticate, authorizePermission('manage_permissions'), controller.exploreTables);

// GET /explore/table/:tableName — describe columns
router.get('/explore/table/:tableName',   authenticate, authorizePermission('manage_permissions'), controller.exploreTable);

// GET /explore/preview/:tableName — preview rows
router.get('/explore/preview/:tableName', authenticate, authorizePermission('manage_permissions'), controller.previewTable);

module.exports = router;