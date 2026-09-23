'use strict';

const router = require('express').Router();
const controller = require('./laundry.controller');
const validate = require('../../../middleware/validate.middleware');
const { authenticate } = require('../../../middleware/auth.middleware');
const { authorizeMinLevel } = require('../../../middleware/rbac.middleware');

const {
  createMachineSchema,
  createProgramSchema,
  createRecipeSchema,
  createTransferSchema,
  createReceivingSchema,
  createBatchSchema,
  updateBatchStatusSchema,
  createReturnSchema,
  verifyReturnSchema,
  createLossSchema,
  createTicketSchema,
  updateTicketStatusSchema,
  createHandoverTxnSchema,
  classifyChemicalSchema,
} = require('./laundry.validation');

// All routes require authentication
router.use(authenticate);

// ─── 1. MACHINES & PROGRAMS ───────────────────────────────────────────────────
router.post('/machines', authorizeMinLevel('warehouse_manager'), validate(createMachineSchema), controller.createMachine);
router.get('/machines', controller.getMachines);
router.post('/machines/programs', authorizeMinLevel('warehouse_manager'), validate(createProgramSchema), controller.createProgram);
router.get('/machines/:machineId/programs', controller.getProgramsByMachine);
router.put('/machines/programs/:id', authorizeMinLevel('warehouse_manager'), controller.updateProgram);
router.delete('/machines/programs/:id', authorizeMinLevel('warehouse_manager'), controller.deleteProgram);

// ─── 2. RECIPES & CHEMICALS ───────────────────────────────────────────────────
router.post('/recipes', authorizeMinLevel('warehouse_manager'), validate(createRecipeSchema), controller.createRecipe);
router.get('/recipes', controller.getRecipes);
router.get('/recipes/:id', controller.getRecipeById);
router.delete('/recipes/:id', authorizeMinLevel('warehouse_manager'), controller.deleteRecipe);
router.get('/chemicals', controller.getChemicals);
router.put('/chemicals/classification', authorizeMinLevel('warehouse_manager'), validate(classifyChemicalSchema), controller.classifyChemical);

// ─── 3. TRANSFERS & RECEIVINGS (Warehouse ➔ Laundry) ───────────────────────────
router.post('/transfers', authorizeMinLevel('warehouse_head'), validate(createTransferSchema), controller.createTransferDraft);
router.get('/transfers', controller.getTransfers);
router.get('/transfers/:id', controller.getTransfer);
router.post('/transfers/:id/send', authorizeMinLevel('warehouse_head'), controller.sendTransfer);
router.post('/transfers/receive', authorizeMinLevel('warehouse_head'), validate(createReceivingSchema), controller.receiveTransfer);

// ─── 4. BATCH PROCESSING ──────────────────────────────────────────────────────
router.post('/batches', authorizeMinLevel('warehouse_head'), validate(createBatchSchema), controller.createBatch);
router.get('/batches', controller.getBatches);
router.get('/batches/:id', controller.getBatch);
router.put('/batches/:id/status', authorizeMinLevel('warehouse_head'), validate(updateBatchStatusSchema), controller.updateBatchStatus);

// ─── 5. RETURNS (Laundry ➔ Warehouse) ──────────────────────────────────────────
router.post('/returns', authorizeMinLevel('warehouse_head'), validate(createReturnSchema), controller.createReturnDraft);
router.get('/returns', controller.getReturns);
router.get('/returns/:id', controller.getReturn);
router.put('/returns/:id/verify', authorizeMinLevel('warehouse_head'), validate(verifyReturnSchema), controller.verifyReturn);

// ─── 6. LOSSES ────────────────────────────────────────────────────────────────
router.post('/losses', authorizeMinLevel('warehouse_head'), validate(createLossSchema), controller.createLoss);
router.get('/losses', controller.getLosses);

// ─── 7. TICKETS (Guest & Staff Laundry) ───────────────────────────────────────
router.post('/tickets', authorizeMinLevel('warehouse_head'), validate(createTicketSchema), controller.createTicket);
router.get('/tickets', controller.getTickets);
router.get('/tickets/:id', controller.getTicket);
router.put('/tickets/:id/status', authorizeMinLevel('warehouse_head'), validate(updateTicketStatusSchema), controller.updateTicketStatus);

// ─── 8. POS / COMSYS SYNC ─────────────────────────────────────────────────────
router.post('/pos-sync', authorizeMinLevel('warehouse_manager'), controller.syncComsysPOSOrders);
router.get('/pos-sync/status', authorizeMinLevel('warehouse_manager'), controller.getLastPosSync);

// ─── 9. REPORTING & ANALYTICS ─────────────────────────────────────────────────
router.get('/reports/profitability', authorizeMinLevel('accountant'), controller.getProfitabilityReport);
router.get('/reports/reconciliation', authorizeMinLevel('accountant'), controller.getReconciliationReport);
router.get('/reports/reconciliation/:nodeId', controller.getNodeReconciliationReport);
router.get('/reports/dashboard-summary', authorizeMinLevel('accountant'), controller.getUnifiedDashboardSummary);
router.get('/stock', controller.getLaundryStock);

// ─── 10. ZK FINGERPRINT HANDOVER & CUSTODY ─────────────────────────────────────
router.get('/zk/checkins', controller.getLatestZkCheckins);
router.get('/zk/employee/:userCode', controller.getZkEmployeeDetails);
router.post('/zk/transactions', validate(createHandoverTxnSchema), controller.createZkHandoverTxn);
router.get('/zk/dashboard', controller.getZkHandoverDashboard);

module.exports = router;
