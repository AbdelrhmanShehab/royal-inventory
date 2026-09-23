'use strict';

const service = require('./laundry.service');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

// ─── 1. MACHINES & PROGRAMS ───────────────────────────────────────────────────

const createMachine = asyncHandler(async (req, res) => {
  const result = await service.createMachine(req.body);
  return R.created(res, { machineId: result }, 'تم إضافة الغسالة بنجاح');
});

const getMachines = asyncHandler(async (req, res) => {
  const result = await service.getMachines();
  return R.success(res, result, 'تم جلب الغسالات بنجاح');
});

const createProgram = asyncHandler(async (req, res) => {
  const result = await service.createProgram(req.body);
  return R.created(res, { programId: result }, 'تم إضافة برنامج التشغيل بنجاح');
});

const getProgramsByMachine = asyncHandler(async (req, res) => {
  const result = await service.getProgramsByMachine(parseInt(req.params.machineId));
  return R.success(res, result, 'تم جلب برامج التشغيل بنجاح');
});

// ─── 2. RECIPES ───────────────────────────────────────────────────────────────

const createRecipe = asyncHandler(async (req, res) => {
  const result = await service.createRecipe(req.body);
  return R.created(res, result, 'تم إضافة وصفة كيميائية جديدة بنجاح');
});

const getRecipes = asyncHandler(async (req, res) => {
  const result = await service.getRecipes();
  return R.success(res, result, 'تم جلب الوصفات الكيميائية بنجاح');
});

const getRecipeById = asyncHandler(async (req, res) => {
  const result = await service.getRecipeById(parseInt(req.params.id));
  return R.success(res, result, 'تم جلب تفاصيل الوصفة بنجاح');
});

// ─── 3. TRANSFERS & RECEIVING ─────────────────────────────────────────────────

const createTransferDraft = asyncHandler(async (req, res) => {
  const result = await service.createTransferDraft(req.user.id, req.body);
  return R.created(res, result, 'تم إنشاء مسودة تحويل المغسلة بنجاح');
});

const sendTransfer = asyncHandler(async (req, res) => {
  const result = await service.sendTransfer(req.user.id, parseInt(req.params.id));
  return R.success(res, result, result.message);
});

const receiveTransfer = asyncHandler(async (req, res) => {
  const result = await service.receiveTransfer(req.user.id, req.body);
  return R.success(res, result, 'تم استلام وتأكيد شحنة المغسلة بنجاح');
});

const getTransfer = asyncHandler(async (req, res) => {
  const result = await service.getTransfer(parseInt(req.params.id));
  return R.success(res, result, 'تم جلب تفاصيل مستند الشحن بنجاح');
});

const getTransfers = asyncHandler(async (req, res) => {
  const result = await service.getTransfers();
  return R.success(res, result, 'تم جلب قائمة معاملات الشحن بنجاح');
});

// ─── 4. BATCH PROCESSING ──────────────────────────────────────────────────────

const createBatch = asyncHandler(async (req, res) => {
  const result = await service.createBatch(req.user.id, req.body);
  return R.created(res, result, 'تم إنشاء دورة غسيل تشغيلية بنجاح');
});

const updateBatchStatus = asyncHandler(async (req, res) => {
  const result = await service.updateBatchStatus(req.user.id, parseInt(req.params.id), req.body.status);
  return R.success(res, result, 'تم تحديث حالة دورة التشغيل وتحديث الأرصدة بنجاح');
});

const getBatch = asyncHandler(async (req, res) => {
  const result = await service.getBatch(parseInt(req.params.id));
  return R.success(res, result, 'تم جلب تفاصيل دورة التشغيل بنجاح');
});

const getBatches = asyncHandler(async (req, res) => {
  const result = await service.getBatches();
  return R.success(res, result, 'تم جلب قائمة دورات التشغيل بنجاح');
});

// ─── 5. RETURNS ───────────────────────────────────────────────────────────────

const createReturnDraft = asyncHandler(async (req, res) => {
  const result = await service.createReturnDraft(req.user.id, req.body);
  return R.created(res, result, 'تم إنشاء مسودة إرجاع للمخزن بنجاح');
});

const verifyReturn = asyncHandler(async (req, res) => {
  const result = await service.verifyReturn(req.user.id, {
    returnId: parseInt(req.params.id),
    ...req.body,
  });
  return R.success(res, result, 'تم مراجعة وتأكيد استلام المرتجعات بالمستودع بنجاح');
});

const getReturn = asyncHandler(async (req, res) => {
  const result = await service.getReturn(parseInt(req.params.id));
  return R.success(res, result, 'تم جلب تفاصيل مستند المرتجع بنجاح');
});

const getReturns = asyncHandler(async (req, res) => {
  const result = await service.getReturns();
  return R.success(res, result, 'تم جلب قائمة مستندات المرتجعات بنجاح');
});

// ─── 6. LOSSES ────────────────────────────────────────────────────────────────

const createLoss = asyncHandler(async (req, res) => {
  const result = await service.createLoss(req.user.id, req.body);
  return R.created(res, result, 'تم تسجيل هدر / تلف أصناف تشغيل بنجاح');
});

const getLosses = asyncHandler(async (req, res) => {
  const result = await service.getLosses();
  return R.success(res, result, 'تم جلب سجل الهوالك بنجاح');
});

// ─── 7. TICKETS ───────────────────────────────────────────────────────────────

const createTicket = asyncHandler(async (req, res) => {
  const result = await service.createTicket(req.user.id, req.body);
  return R.created(res, result, 'تم إنشاء تذكرة غسيل نزيل / موظف بنجاح');
});

const updateTicketStatus = asyncHandler(async (req, res) => {
  const result = await service.updateTicketStatus(req.user.id, parseInt(req.params.id), req.body.status);
  return R.success(res, result, 'تم تحديث حالة تذكرة الغسيل بنجاح');
});

const getTicket = asyncHandler(async (req, res) => {
  const result = await service.getTicket(parseInt(req.params.id));
  return R.success(res, result, 'تم جلب تفاصيل تذكرة الغسيل بنجاح');
});

const getTickets = asyncHandler(async (req, res) => {
  const result = await service.getTickets();
  return R.success(res, result, 'تم جلب قائمة تذاكر الغسيل بنجاح');
});

// ─── 8. POS / COMSYS SYNC ─────────────────────────────────────────────────────

const syncComsysPOSOrders = asyncHandler(async (req, res) => {
  const result = await service.syncComsysPOSOrders(req.user.id);
  return R.success(res, result, 'تم مزامنة واستيراد حركات المبيعات من كومسيس بنجاح');
});

// ─── 9. REPORTING ─────────────────────────────────────────────────────────────

const getProfitabilityReport = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;
  if (!fromDate || !toDate) {
    return R.badRequest(res, 'يجب تحديد نطاق التواريخ من وإلى بشكل صحيح');
  }
  const result = await service.getProfitabilityReport(fromDate, toDate);
  return R.success(res, result, 'تم جلب تقرير ربحية المغسلة بنجاح');
});

const getReconciliationReport = asyncHandler(async (req, res) => {
  const result = await service.getReconciliationReport();
  return R.success(res, result, 'تم جلب تقرير مطابقة الأرصدة بنجاح');
});

const getNodeReconciliationReport = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.nodeId);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'غير مصرح لك بنطاق هذا المستودع');
  }
  const result = await service.getNodeReconciliationReport(nodeId);
  return R.success(res, result, 'تم جلب تقرير مطابقة الأرصدة للمستودع بنجاح');
});

const getLastPosSync = asyncHandler(async (req, res) => {
  const result = await service.getLastPosSync();
  return R.success(res, result, 'تم جلب حالة آخر مزامنة بنجاح');
});

const deleteProgram = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await service.deleteProgram(parseInt(id));
  return R.success(res, null, 'تم حذف برنامج تشغيل الغسالة بنجاح');
});

const updateProgram = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await service.updateProgram(parseInt(id), req.body);
  return R.success(res, null, 'تم تحديث برنامج تشغيل الغسالة بنجاح');
});

const deleteRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await service.deleteRecipe(parseInt(id));
  return R.success(res, null, 'تم حذف الوصفة الكيميائية بنجاح');
});

const getChemicals = asyncHandler(async (req, res) => {
  const result = await service.getChemicals();
  return R.success(res, result, 'تم جلب المواد الكيميائية بنجاح');
});

const classifyChemical = asyncHandler(async (req, res) => {
  const { itemCode, classification } = req.body;
  await service.classifyChemical(itemCode, classification);
  return R.success(res, null, 'تم تصنيف المادة الكيميائية بنجاح');
});

const getLaundryStock = asyncHandler(async (req, res) => {
  const result = await service.getLaundryStock();
  return R.success(res, result, 'تم جلب رصيد مخزون المغسلة بنجاح');
});

// ─── 10. ZK FINGERPRINT HANDOVER & CUSTODY ─────────────────────────────────────

const getLatestZkCheckins = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  const result = await service.getLatestZkCheckins(limit);
  return R.success(res, result, 'تم جلب آخر عمليات البصمة بنجاح');
});

const getZkEmployeeDetails = asyncHandler(async (req, res) => {
  const { userCode } = req.params;
  const result = await service.getZkEmployeeDetails(userCode);
  return R.success(res, result, 'تم جلب تفاصيل الموظف والعهدة بنجاح');
});

const createZkHandoverTxn = asyncHandler(async (req, res) => {
  const operator = req.user?.username || 'System';
  const result = await service.recordZkHandoverReceive(operator, req.body);
  const actionMessage = req.body.action === 'Handover' ? 'تسليم' : 'استلام';
  return R.created(res, { transactionId: result }, `تم تسجيل عملية ${actionMessage} العهدة بنجاح`);
});

const getZkHandoverDashboard = asyncHandler(async (req, res) => {
  const result = await service.getZkHandoverDashboard();
  return R.success(res, result, 'تم جلب بيانات لوحة التحكم بنجاح');
});

const getUnifiedDashboardSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await service.getUnifiedDashboardSummary(startDate, endDate);
  return R.success(res, result, 'تم جلب تقرير أداء لوحة تحكم المغسلة الموحد بنجاح');
});

module.exports = {
  createMachine,
  getMachines,
  createProgram,
  getProgramsByMachine,
  createRecipe,
  getRecipes,
  getRecipeById,
  createTransferDraft,
  sendTransfer,
  receiveTransfer,
  getTransfer,
  getTransfers,
  createBatch,
  updateBatchStatus,
  getBatch,
  getBatches,
  createReturnDraft,
  verifyReturn,
  getReturn,
  getReturns,
  createLoss,
  getLosses,
  createTicket,
  updateTicketStatus,
  getTicket,
  getTickets,
  syncComsysPOSOrders,
  getProfitabilityReport,
  getReconciliationReport,
  getNodeReconciliationReport,
  getLastPosSync,
  deleteProgram,
  updateProgram,
  deleteRecipe,
  getChemicals,
  classifyChemical,
  getLaundryStock,
  getLatestZkCheckins,
  getZkEmployeeDetails,
  createZkHandoverTxn,
  getZkHandoverDashboard,
  getUnifiedDashboardSummary,
};
