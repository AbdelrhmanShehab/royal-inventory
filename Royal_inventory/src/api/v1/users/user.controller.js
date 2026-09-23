'use strict';

const service = require('./user.service');
const asyncHandler = require('../../../utils/asyncHandler');
const R = require('../../../utils/response.helper');

const createUser = asyncHandler(async (req, res) => {
  const { username, fullNameAr, password, role, nodeId, nodeIds, isActive } = req.body;
  if (req.user.role !== 'admin') {
    if (role === 'admin' || role === 'manager') {
      return R.forbidden(res, 'لا يمكنك منح صلاحيات إدارة عليا للمستخدمين');
    }
    if (nodeId && req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(parseInt(nodeId))) {
      return R.forbidden(res, 'لا يمكنك تخصيص مستخدمين لمستودع خارج نطاق صلاحياتك');
    }
  }
  const id = await service.createUser({ username, fullNameAr, password, role, nodeId, nodeIds, isActive });
  return R.created(res, { id }, 'تم إنشاء المستخدم بنجاح');
});

const listUsers = asyncHandler(async (req, res) => {
  let users = await service.listUsers();
  if (req.user.role !== 'admin' && req.user.allowedNodeIds) {
    users = users.filter(u => !u.nodeId || req.user.allowedNodeIds.includes(u.nodeId));
  }
  return R.success(res, users, 'تم جلب المستخدمين بنجاح');
});

const getUser = asyncHandler(async (req, res) => {
  const user = await service.getUser(req.params.id);
  if (req.user.role !== 'admin' && req.user.allowedNodeIds && user.nodeId && !req.user.allowedNodeIds.includes(user.nodeId)) {
    return R.forbidden(res, 'ليس لديك صلاحية لعرض تفاصيل هذا المستخدم');
  }
  return R.success(res, user, 'تم جلب تفاصيل المستخدم');
});

const updateUser = asyncHandler(async (req, res) => {
  const { fullNameAr, role, nodeId, nodeIds, isActive } = req.body;
  if (req.user.role !== 'admin') {
    if (role === 'admin' || role === 'manager') {
      return R.forbidden(res, 'لا يمكنك الترقية إلى صلاحيات إدارة عليا');
    }
    if (nodeId && req.user.allowedNodeIds && !req.user.allowedNodeIds.includes(parseInt(nodeId))) {
      return R.forbidden(res, 'لا يمكنك تعيين مستودع خارج نطاق صلاحياتك');
    }
  }
  const result = await service.updateUser(req.params.id, { fullNameAr, role, nodeId, nodeIds, isActive });
  return R.success(res, result, 'تم تحديث المستخدم بنجاح');
});

const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const result = await service.resetUserPassword(req.params.id, newPassword, req.user);
  return R.success(res, result, result.message);
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await service.deleteUser(req.params.id);
  return R.success(res, result, 'تم حذف المستخدم بنجاح');
});

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  resetPassword,
  deleteUser,
};
