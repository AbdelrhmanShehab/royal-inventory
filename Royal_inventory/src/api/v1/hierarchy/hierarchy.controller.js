'use strict';

const service = require('./hierarchy.service');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

// ─── Group Controllers ───────────────────────────────────────────────────────

const createGroup = asyncHandler(async (req, res) => {
  const { groupNameAr, groupNameEn, groupCode, isActive } = req.body;
  if (!groupNameAr || !groupCode) {
    return R.badRequest(res, 'اسم المجموعة باللغة العربية والرمز مطلوبان');
  }

  const id = await service.createGroup({ groupNameAr, groupNameEn, groupCode, isActive });
  return R.created(res, { id }, 'تم إنشاء المجموعة بنجاح');
});

const listGroups = asyncHandler(async (req, res) => {
  let groups = await service.listGroups();

  // Scoped user: restrict to their own hotel group
  if (req.user.nodeId) {
    try {
      const node = await service.getNode(req.user.nodeId);
      if (node && node.groupId) {
        groups = groups.filter(g => g.id === node.groupId);
      }
    } catch (err) {
      console.error('Error filtering groups for user:', err);
    }
  }

  return R.success(res, groups, 'تم جلب المجموعات بنجاح');
});

const getGroup = asyncHandler(async (req, res) => {
  const group = await service.getGroup(req.params.id);
  return R.success(res, group, 'تم جلب تفاصيل المجموعة');
});

const updateGroup = asyncHandler(async (req, res) => {
  const { groupNameAr, groupNameEn, isActive } = req.body;
  if (!groupNameAr) {
    return R.badRequest(res, 'اسم المجموعة باللغة العربية مطلوب');
  }

  const result = await service.updateGroup(req.params.id, { groupNameAr, groupNameEn, isActive });
  return R.success(res, result, 'تم تحديث المجموعة بنجاح');
});

const deleteGroup = asyncHandler(async (req, res) => {
  const result = await service.deleteGroup(req.params.id);
  return R.success(res, result, 'تم حذف المجموعة بنجاح');
});

// ─── Node Controllers ────────────────────────────────────────────────────────

const createNode = asyncHandler(async (req, res) => {
  const { comsysStoreCode, groupId, parentNodeId, nodeNameAr, nodeType, managerName, isActive, division, hasLaundryAccess } = req.body;
  if (!groupId || !nodeNameAr || !nodeType) {
    return R.badRequest(res, 'اسم العقدة، القسم، ونوع العقدة مطلوبة');
  }

  const id = await service.createNode({
    comsysStoreCode,
    groupId: parseInt(groupId),
    parentNodeId: parentNodeId ? parseInt(parentNodeId) : null,
    nodeNameAr,
    nodeType,
    managerName,
    isActive,
    division,
    hasLaundryAccess: hasLaundryAccess === true || hasLaundryAccess === 'true'
  });

  return R.created(res, { id }, 'تم إنشاء عقدة شجرة المخازن بنجاح');
});

const getNode = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لعرض بيانات هذا المستودع');
  }
  const node = await service.getNode(nodeId);
  return R.success(res, node, 'تم جلب تفاصيل العقدة');
});

const updateNode = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لتعديل بيانات هذا المستودع');
  }
  const { comsysStoreCode, parentNodeId, nodeNameAr, nodeType, managerName, isActive, division, hasLaundryAccess } = req.body;
  if (!nodeNameAr || !nodeType) {
    return R.badRequest(res, 'اسم العقدة ونوعها مطلوبان');
  }

  const result = await service.updateNode(nodeId, {
    comsysStoreCode,
    parentNodeId: parentNodeId ? parseInt(parentNodeId) : null,
    nodeNameAr,
    nodeType,
    managerName,
    isActive,
    division,
    hasLaundryAccess: hasLaundryAccess === true || hasLaundryAccess === 'true'
  });

  return R.success(res, result, 'تم تحديث العقدة بنجاح');
});

const deleteNode = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لحذف هذا المستودع');
  }
  const result = await service.deleteNode(nodeId);
  return R.success(res, result, 'تم حذف العقدة بنجاح');
});

// ─── Tree Controller ─────────────────────────────────────────────────────────

const getTree = asyncHandler(async (req, res) => {
  const groupId = req.query.groupId ? parseInt(req.query.groupId) : null;
  const allowIgnoreScope = req.query.ignoreScope === 'true' || req.user.role === 'admin';
  const effectiveScope = allowIgnoreScope ? null : req.user.allowedNodeIds;
  const tree = await service.getTree(groupId, effectiveScope);
  return R.success(res, tree, 'تم جلب شجرة المخازن بنجاح');
});

const getNodeStock = asyncHandler(async (req, res) => {
  const nodeId = parseInt(req.params.id);
  if (req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لعرض أرصدة هذا المستودع');
  }
  const stockData = await service.getNodeStock(nodeId);
  return R.success(res, stockData, 'تم جلب رصيد المستودع بنجاح');
});

const getAllStock = asyncHandler(async (req, res) => {
  const groupId = req.query.groupId ? parseInt(req.query.groupId) : null;
  const stocks = await service.getAllStock(groupId, req.user.allowedNodeIds);
  return R.success(res, stocks, 'تم جلب الأرصدة التشغيلية العامة بنجاح');
});

module.exports = {
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  createNode,
  getNode,
  updateNode,
  deleteNode,
  getTree,
  getNodeStock,
  getAllStock,
};
