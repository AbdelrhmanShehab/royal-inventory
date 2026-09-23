'use strict';

const router = require('express').Router();
const locationController = require('./location.controller');
const txnController      = require('./operationalTxn.controller');
const summaryController  = require('./stockSummary.controller');

const { authenticate } = require('../../../middleware/auth.middleware');
const { authorizeMinLevel, authorizePermission } = require('../../../middleware/rbac.middleware');
const validate = require('../../../middleware/validate.middleware');

const {
  createLocationSchema,
  updateLocationSchema,
  locationPathParamsSchema,
  nodePathParamsSchema,
} = require('./location.validation');

const {
  allocateSchema,
  consumeSchema,
  returnSchema,
  adjustmentSchema,
  transactionPathParamsSchema,
  summaryPathParamsSchema,
} = require('./operationalTxn.validation');

/**
 * Operational Distribution Layer Routes
 * Base prefix: /api/v1/operational
 */

// ─── Operational Locations ───────────────────────────────────────────────────
router.route('/nodes/:nodeId/locations')
  .get(authenticate, authorizeMinLevel('staff'), validate(nodePathParamsSchema, 'params'), locationController.listLocations)
  .post(authenticate, authorizePermission('manage_nodes'), validate(nodePathParamsSchema, 'params'), validate(createLocationSchema), locationController.createLocation);

router.route('/locations/:id')
  .put(authenticate, authorizePermission('manage_nodes'), validate(locationPathParamsSchema, 'params'), validate(updateLocationSchema), locationController.updateLocation)
  .delete(authenticate, authorizePermission('manage_nodes'), validate(locationPathParamsSchema, 'params'), locationController.deleteLocation);

// ─── Stock Summary ────────────────────────────────────────────────────────────
router.get('/nodes/:nodeId/summary',
  authenticate,
  authorizeMinLevel('warehouse_head'),
  validate(summaryPathParamsSchema, 'params'),
  summaryController.getStockSummary
);

router.get('/nodes/:nodeId/summary/:itemCode',
  authenticate,
  authorizeMinLevel('warehouse_head'),
  validate(summaryPathParamsSchema, 'params'),
  summaryController.getStockSummary
);

// ─── Operational Transactions ─────────────────────────────────────────────────
router.post('/locations/:locationId/allocate',
  authenticate,
  authorizeMinLevel('warehouse_head'),
  validate(transactionPathParamsSchema, 'params'),
  validate(allocateSchema),
  txnController.allocate
);

router.post('/locations/:locationId/consume',
  authenticate,
  authorizeMinLevel('staff'),
  validate(transactionPathParamsSchema, 'params'),
  validate(consumeSchema),
  txnController.consume
);

router.post('/locations/:locationId/return',
  authenticate,
  authorizeMinLevel('warehouse_head'),
  validate(transactionPathParamsSchema, 'params'),
  validate(returnSchema),
  txnController.returnStock
);

router.post('/locations/:locationId/adjustment',
  authenticate,
  authorizeMinLevel('manager'),
  validate(transactionPathParamsSchema, 'params'),
  validate(adjustmentSchema),
  txnController.adjustment
);

module.exports = router;
