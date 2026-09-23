'use strict';

const router = require('express').Router();
const controller = require('./warehouses.controller');
const { authenticate } = require('../../../middleware/auth.middleware');

/**
 * local Warehouses Routes
 * Base: /api/v1/warehouses
 */
router.get('/', authenticate, controller.listWarehouses);

module.exports = router;
