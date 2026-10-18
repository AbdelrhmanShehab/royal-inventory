'use strict';

const router = require('express').Router();
const controller = require('./laundry.controller');
const validate = require('../../../middleware/validate.middleware');
const { authenticate } = require('../../../middleware/auth.middleware');
const { authorize, authorizeMinLevel } = require('../../../middleware/rbac.middleware');

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
router.post('/machines', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor'), validate(createMachineSchema), controller.createMachine);
router.get('/machines', controller.getMachines);
router.post('/machines/programs', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor'), validate(createProgramSchema), controller.createProgram);
router.get('/machines/:machineId/programs', controller.getProgramsByMachine);
router.put('/machines/programs/:id', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor'), controller.updateProgram);
router.delete('/machines/programs/:id', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor'), controller.deleteProgram);

// ─── 2. RECIPES & CHEMICALS ───────────────────────────────────────────────────
router.post('/recipes', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor'), validate(createRecipeSchema), controller.createRecipe);
router.get('/recipes', controller.getRecipes);
router.get('/recipes/:id', controller.getRecipeById);
router.delete('/recipes/:id', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor'), controller.deleteRecipe);
router.get('/chemicals', controller.getChemicals);
router.put('/chemicals/classification', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor'), validate(classifyChemicalSchema), controller.classifyChemical);

// ─── 3. TRANSFERS & RECEIVINGS (Warehouse ➔ Laundry) ───────────────────────────
router.post('/transfers', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_operator'), validate(createTransferSchema), controller.createTransferDraft);
router.get('/transfers', controller.getTransfers);
router.get('/transfers/:id', controller.getTransfer);
router.post('/transfers/:id/send', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_operator'), controller.sendTransfer);
router.post('/transfers/receive', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_operator'), validate(createReceivingSchema), controller.receiveTransfer);

// ─── 4. BATCH PROCESSING ──────────────────────────────────────────────────────
router.post('/batches', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_operator'), validate(createBatchSchema), controller.createBatch);
router.get('/batches', controller.getBatches);
router.get('/batches/:id', controller.getBatch);
router.put('/batches/:id/status', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_operator'), validate(updateBatchStatusSchema), controller.updateBatchStatus);

// ─── 5. RETURNS (Laundry ➔ Warehouse) ──────────────────────────────────────────
router.post('/returns', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_operator'), validate(createReturnSchema), controller.createReturnDraft);
router.get('/returns', controller.getReturns);
router.get('/returns/:id', controller.getReturn);
router.put('/returns/:id/verify', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor'), validate(verifyReturnSchema), controller.verifyReturn);

// ─── 6. LOSSES ────────────────────────────────────────────────────────────────
router.post('/losses', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor'), validate(createLossSchema), controller.createLoss);
router.get('/losses', controller.getLosses);

// ─── 7. TICKETS (Guest & Staff Laundry) ───────────────────────────────────────
router.post('/tickets', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_cashier'), validate(createTicketSchema), controller.createTicket);
router.get('/tickets', controller.getTickets);
router.get('/tickets/:id', controller.getTicket);
router.put('/tickets/:id/status', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'laundry_cashier'), validate(updateTicketStatusSchema), controller.updateTicketStatus);

// ─── 8. POS / COMSYS SYNC ─────────────────────────────────────────────────────
router.post('/pos-sync', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor', 'laundry_cashier'), controller.syncComsysPOSOrders);
router.get('/pos-sync/status', authorize('admin', 'manager', 'warehouse_manager', 'laundry_supervisor', 'laundry_cashier'), controller.getLastPosSync);

// ─── 9. REPORTING & ANALYTICS ─────────────────────────────────────────────────
router.get('/reports/profitability', authorize('admin', 'manager', 'accountant', 'warehouse_manager', 'laundry_supervisor'), controller.getProfitabilityReport);
router.get('/reports/reconciliation', authorize('admin', 'manager', 'accountant', 'warehouse_manager', 'laundry_supervisor'), controller.getReconciliationReport);
router.get('/reports/reconciliation/:nodeId', controller.getNodeReconciliationReport);
router.get('/reports/dashboard-summary', authorize('admin', 'manager', 'accountant', 'warehouse_manager', 'laundry_supervisor'), controller.getUnifiedDashboardSummary);
router.get('/stock', controller.getLaundryStock);

// ─── 10. ZK FINGERPRINT HANDOVER & CUSTODY ─────────────────────────────────────
router.get('/zk/checkins', controller.getLatestZkCheckins);
router.get('/zk/transactions', controller.getZkTransactions);
router.get('/zk/employees', controller.getZkEmployees);
router.get('/zk/employee/:userCode', controller.getZkEmployeeDetails);
router.post('/zk/transactions', authorize('admin', 'manager', 'warehouse_manager', 'warehouse_head', 'laundry_supervisor', 'uniform_clerk'), validate(createHandoverTxnSchema), controller.createZkHandoverTxn);
router.get('/zk/dashboard', controller.getZkHandoverDashboard);
router.get('/zk/in-laundry-inventory', controller.getInLaundryInventory);

module.exports = router;
