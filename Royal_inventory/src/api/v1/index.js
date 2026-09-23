'use strict';

const router = require('express').Router();

/**
 * API v1 Route Aggregator
 * All routes registered here under /api/v1
 */

router.use('/auth',  require('./auth/auth.routes'));
router.use('/users', require('./users/user.routes'));
router.use('/sync',  require('./sync/sync.routes'));
router.use('/warehouses', require('./warehouses/warehouses.routes'));
router.use('/master-data', require('./masterData/masterData.routes'));
router.use('/hierarchy', require('./hierarchy/hierarchy.routes'));
router.use('/transactions/transfers', require('./transactions/transfer.routes'));
router.use('/admin/permissions',      require('./admin/permissions.routes'));
router.use('/laundry',                require('./laundry/laundry.routes'));
router.use('/operational',            require('./operationalDistribution/operationalDistribution.routes'));

module.exports = router;
