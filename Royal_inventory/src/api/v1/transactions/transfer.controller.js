'use strict';

const service = require('./transfer.service');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

const createTransferDraft = asyncHandler(async (req, res) => {
  const { txnType, fromNodeId, toNodeId, notes, reason, lines, submitForApproval } = req.body;
  const isTransferOrReturn = !txnType || txnType === 'internal_transfer' || txnType === 'return';
  if (!fromNodeId || (isTransferOrReturn && !toNodeId) || !lines || lines.length === 0) {
    return R.badRequest(res, 'مخزن المصدر، مخزن الوجهة (للحركات التحويلية)، والأصناف مطلوبة');
  }

  const parsedFromNodeId = parseInt(fromNodeId);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(parsedFromNodeId)) {
    return R.forbidden(res, 'لا يمكنك إجراء أو إنشاء حركات لمستودع خارج نطاق صلاحياتك المعتمدة');
  }

  const result = await service.createTransferDraft({
    txnType: txnType || 'internal_transfer',
    createdBy: req.user.id,
    fromNodeId: parseInt(fromNodeId),
    toNodeId: toNodeId ? parseInt(toNodeId) : null,
    notes,
    reason,
    lines,
    submitForApproval: Boolean(submitForApproval),
  });

  const msg = submitForApproval ? 'تم إنشاء ورسالة طلب التحويل للاعتماد بنجاح' : 'تم إنشاء مسودة العملية بنجاح';
  return R.created(res, result, msg);
});

const submitForApproval = asyncHandler(async (req, res) => {
  const transfer = await service.getTransfer(req.params.id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(transfer.fromNodeId)) {
    return R.forbidden(res, 'لا يمكنك تقديم طلبات تحويل خارج نطاق مستودعاتك المخصصة');
  }
  const result = await service.submitForApproval(req.params.id, req.user.id);
  return R.success(res, result, result.message);
});

const approveTransfer = asyncHandler(async (req, res) => {
  const transfer = await service.getTransfer(req.params.id);
  if (req.user.allowedNodeIds && 
      !req.user.allowedNodeIds.includes(transfer.fromNodeId) && 
      (!transfer.toNodeId || !req.user.allowedNodeIds.includes(transfer.toNodeId))) {
    return R.forbidden(res, 'غير مصرح لك بإجراء الاعتماد خارج نطاق مستودعاتك المعتمدة');
  }
  const result = await service.approveTransfer(req.params.id, req.user.id);
  return R.success(res, result, result.message);
});

const dispatchTransfer = asyncHandler(async (req, res) => {
  const transfer = await service.getTransfer(req.params.id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(transfer.fromNodeId)) {
    return R.forbidden(res, 'لا يمكنك شحن البضاعة إلا من مستودعك المخصص');
  }
  const result = await service.dispatchTransfer(req.params.id, req.user.id);
  return R.success(res, result, result.message);
});

const receiveTransfer = asyncHandler(async (req, res) => {
  const transfer = await service.getTransfer(req.params.id);
  if (req.user.allowedNodeIds && (!transfer.toNodeId || !req.user.allowedNodeIds.includes(transfer.toNodeId))) {
    return R.forbidden(res, 'لا يمكنك تأكيد الاستلام إلا في مستودعك المخصص');
  }
  const result = await service.receiveTransfer(req.params.id, req.user.id);
  return R.success(res, result, result.message);
});

const cancelTransfer = asyncHandler(async (req, res) => {
  const transfer = await service.getTransfer(req.params.id);
  if (req.user.allowedNodeIds && 
      !req.user.allowedNodeIds.includes(transfer.fromNodeId) && 
      (!transfer.toNodeId || !req.user.allowedNodeIds.includes(transfer.toNodeId))) {
    return R.forbidden(res, 'ليس لديك صلاحية لإلغاء هذا المستند');
  }
  const result = await service.cancelTransfer(req.params.id, req.user.id);
  return R.success(res, result, result.message);
});

const confirmTransfer = asyncHandler(async (req, res) => {
  const transfer = await service.getTransfer(req.params.id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(transfer.fromNodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لتأكيد هذه المعاملة التشغيلية لمستودع آخر');
  }
  const result = await service.confirmTransfer(req.params.id, req.user.id);
  return R.success(res, result, result.message);
});

const getTransfer = asyncHandler(async (req, res) => {
  const transfer = await service.getTransfer(req.params.id);
  if (req.user.allowedNodeIds && 
      !req.user.allowedNodeIds.includes(transfer.fromNodeId) && 
      (!transfer.toNodeId || !req.user.allowedNodeIds.includes(transfer.toNodeId))) {
    return R.forbidden(res, 'ليس لديك صلاحية للوصول لتفاصيل هذا المستند');
  }
  return R.success(res, transfer, 'تم جلب تفاصيل التحويل');
});

const listTransfers = asyncHandler(async (req, res) => {
  const nodeId = req.query.nodeId ? parseInt(req.query.nodeId) : null;
  if (nodeId && req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لعرض حركات هذا المستودع');
  }
  const transfers = await service.listTransfers(nodeId, req.user.allowedNodeIds);
  return R.success(res, transfers, 'تم جلب قائمة التحويلات بنجاح');
});

module.exports = {
  createTransferDraft,
  submitForApproval,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  confirmTransfer,
  getTransfer,
  listTransfers,
};
