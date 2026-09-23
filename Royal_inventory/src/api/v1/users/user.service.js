'use strict';

const repo = require('../../../repositories/system/user.repo');
const nodeRepo = require('../../../repositories/system/hierarchy.repo');
const { NotFoundError, BadRequestError } = require('../../../utils/errors');
const bcrypt = require('bcryptjs');
const nodeCache = require('../../../services/node.cache');

const BCRYPT_ROUNDS = 12;

/**
 * User Service — business logic for local app users management.
 */

const createUser = async ({ username, fullNameAr, password, role, nodeId = null, nodeIds = [], isActive = true }) => {
  if (!username || !fullNameAr || !password || !role) {
    throw new BadRequestError('جميع حقول المستخدم الأساسية مطلوبة');
  }

  // Ensure nodeIds has at least the primary nodeId
  const mergedNodeIds = Array.from(new Set([nodeId, ...nodeIds].filter(id => id !== null && id !== undefined)));

  // Validate all nodeIds exist
  for (const nId of mergedNodeIds) {
    const node = await nodeRepo.getNodeById(nId);
    if (!node) throw new NotFoundError(`عقدة المخزن المحددة للمستخدم (${nId}) غير موجودة`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const newUserId = await repo.createUser({ username, fullNameAr, passwordHash, role, nodeId, nodeIds: mergedNodeIds, isActive });
  nodeCache.invalidateCache();
  return newUserId;
};

const getUser = async (userId) => {
  const user = await repo.getUserById(userId);
  if (!user) throw new NotFoundError('المستخدم غير موجود في النظام');
  return user;
};

const listUsers = async () => {
  return repo.getAllUsers();
};

const updateUser = async (userId, { fullNameAr, role, nodeId = null, nodeIds = [], isActive }) => {
  await getUser(userId);

  // Ensure nodeIds has at least the primary nodeId
  const mergedNodeIds = Array.from(new Set([nodeId, ...nodeIds].filter(id => id !== null && id !== undefined)));

  // Validate all nodeIds exist
  for (const nId of mergedNodeIds) {
    const node = await nodeRepo.getNodeById(nId);
    if (!node) throw new NotFoundError(`عقدة المخزن المحددة للمستخدم (${nId}) غير موجودة`);
  }

  await repo.updateUser(userId, { fullNameAr, role, nodeId, nodeIds: mergedNodeIds, isActive });
  nodeCache.invalidateCache();
  return { message: 'تم تحديث حساب المستخدم بنجاح' };
};

/**
 * resetUserPassword — admin can force-reset any user's password.
 * Does NOT require the old password.
 */
const resetUserPassword = async (targetUserId, newPassword, requestingUser = null) => {
  const user = await getUser(targetUserId);

  if (user.username === 'admin' && requestingUser && Number(requestingUser.id) !== Number(targetUserId)) {
    throw new BadRequestError('لا يمكن إعادة تعيين كلمة مرور المدير الرئيسي للنظام إلا من قبله شخصياً');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await repo.resetPasswordHash(targetUserId, newHash);

  return { message: `تم إعادة تعيين كلمة مرور المستخدم "${user.username}" بنجاح` };
};

const deleteUser = async (userId) => {
  const user = await getUser(userId);
  if (user.username === 'admin') {
    throw new BadRequestError('لا يمكن إيقاف المستخدم الرئيسي للنظام (admin)');
  }
  await repo.updateUser(userId, { ...user, isActive: false });
  nodeCache.invalidateCache();
  return { message: 'تم إيقاف تفعيل حساب المستخدم وتجميد صلاحياته بنجاح' };
};

module.exports = {
  createUser,
  getUser,
  listUsers,
  updateUser,
  resetUserPassword,
  deleteUser,
};
