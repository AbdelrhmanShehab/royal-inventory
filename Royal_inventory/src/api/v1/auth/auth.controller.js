'use strict';

const service      = require('./auth.service');
const asyncHandler = require('../../../utils/asyncHandler');
const R            = require('../../../utils/response.helper');
const config       = require('../../../config/index');

/**
 * Auth Controller — thin layer that calls service and formats response.
 * No business logic here.
 */

// POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await service.login(username, password);

  return R.success(res, {
    user:        result.user,
    accessToken: result.accessToken,
  }, 'تم تسجيل الدخول بنجاح');
});

// POST /api/v1/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  return R.badRequest(res, 'تم إلغاء ميزة رمز التجديد — صلاحية رمز الدخول الحالي 7 أيام', 'REFRESH_TOKEN_DISABLED');
});

// POST /api/v1/auth/logout
const logout = asyncHandler(async (req, res) => {
  await service.logout(req.user.jti);

  // Clear the refresh token cookie
  res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

  return R.success(res, null, 'تم تسجيل الخروج بنجاح');
});

// POST /api/v1/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await service.changePassword(req.user.id, currentPassword, newPassword);
  return R.success(res, null, result.message);
});

// GET /api/v1/auth/me
const me = asyncHandler(async (req, res) => {
  const permissionsCache = require('../../../services/permissions.cache');
  const matrix = await permissionsCache.getMatrix();
  const rolePermissions = matrix[req.user.role] || {};
  const permissions = Object.keys(rolePermissions).filter(key => rolePermissions[key] === true);

  return R.success(res, {
    ...req.user,
    permissions
  }, 'بيانات المستخدم الحالي');
});

module.exports = { login, refresh, logout, changePassword, me };
