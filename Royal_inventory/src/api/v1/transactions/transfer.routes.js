'use strict';

const router = require('express').Router();
const controller = require('./transfer.controller');
const { authenticate } = require('../../../middleware/auth.middleware');
const { authorizePermission } = require('../../../middleware/rbac.middleware');

const validate = require('../../../middleware/validate.middleware');
const { createTransferSchema, listTransfersQuerySchema } = require('./transfer.validation');

/**
 * Internal Transfer Routes (Approval Workflow Flow)
 * Base: /api/v1/transactions/transfers
 *
 * All action guards are now DB-driven via authorizePermission(permKey).
 * Permissions are configured in the admin panel and stored in ops.role_permissions.
 */

// List & Create
router.route('/')
  .post(authenticate, authorizePermission('create_draft'), validate(createTransferSchema), controller.createTransferDraft)
  .get(authenticate, validate(listTransfersQuerySchema, 'query'), controller.listTransfers);

// Get single transfer
router.route('/:id')
  .get(authenticate, controller.getTransfer);

// ─── Multi-step Workflow Endpoints ───────────────────────────────────────────

// 1. Submit draft for approval
router.post('/:id/submit-approval',
  authenticate,
  authorizePermission('submit_approval'),
  controller.submitForApproval
);

// 2. Approve request
router.post('/:id/approve',
  authenticate,
  authorizePermission('approve_transfer'),
  controller.approveTransfer
);

// 3. Dispatch/Ship items from source node (deducts source stock)
router.post('/:id/dispatch',
  authenticate,
  authorizePermission('dispatch_transfer'),
  controller.dispatchTransfer
);

// 4. Receive and confirm items at destination node (adds destination stock)
router.post('/:id/receive',
  authenticate,
  authorizePermission('receive_transfer'),
  controller.receiveTransfer
);

// 5. Cancel request at any stage before completion (reverses stock if shipped)
router.post('/:id/cancel',
  authenticate,
  authorizePermission('cancel_transfer'),
  controller.cancelTransfer
);

// 6. Direct confirm (for single-node actions: consumption, waste, damage, disposal)
router.route('/:id/confirm')
  .post(authenticate, authorizePermission('confirm_transfer'), controller.confirmTransfer);

module.exports = router;
