'use strict';

const bcrypt = require('bcryptjs');
const repo   = require('./auth.repository');
const { issueTokenPair, verifyRefreshToken, blacklistToken } = require('../../../utils/token');
const {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} = require('../../../utils/errors');

const BCRYPT_ROUNDS = 12;

/**
 * Auth Service — all business logic for authentication.
 * Never directly touches the DB — uses repo for data access.
 */

// ── Login ─────────────────────────────────────────────────────────────────────
const login = async (username, password) => {
  const logger = require('../../../utils/logger');
  const config = require('../../../config/index');
  logger.info('[AuthService] Login attempt', { username });

  // 1. Find user
  const user = await repo.findByUsername(username);
  if (!user) {
    logger.warn('[AuthService] User not found in database', { username });
    // Timing-safe: always do a bcrypt compare even if user not found
    await bcrypt.compare(password, '$2a$12$dummyhashtopreventtimingattacks00000000000000000000000');
    throw new AuthenticationError('اسم المستخدم أو كلمة المرور غير صحيحة');
  }

  logger.info('[AuthService] User found in database', { username, isActive: user.isActive, hash: user.passwordHash });

  // 2. Check if account is active
  if (!user.isActive) {
    logger.warn('[AuthService] User account is inactive', { username });
    throw new AuthorizationError('الحساب معطل — يرجى التواصل مع المدير');
  }

  // 3. Check account lockout (Bypassed in development mode to prevent test lockouts)
  if (!config.isDev && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
    logger.warn('[AuthService] User account is locked', { username, minutesLeft });
    throw new AuthenticationError(
      `الحساب مقفل بسبب محاولات خاطئة متكررة — يرجى الانتظار ${minutesLeft} دقيقة`
    );
  }

  // 4. Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  logger.info('[AuthService] Password validation result', { username, isPasswordValid });

  if (!isPasswordValid) {
    if (!config.isDev) {
      await repo.recordFailedLogin(user.id);
    }
    throw new AuthenticationError('اسم المستخدم أو كلمة المرور غير صحيحة');
  }

  // 5. Issue token pair
  if (!config.isDev) {
    await repo.recordSuccessfulLogin(user.id);
  } else {
    // Just update login time in dev, don't worry about resetting failed count since it's bypassed
    try {
      await repo.recordSuccessfulLogin(user.id);
    } catch (e) {
      logger.warn('[AuthService] Failed to record login time (non-fatal)', { error: e.message });
    }
  }
  const tokens = issueTokenPair(user);
  
  const permissionsCache = require('../../../services/permissions.cache');
  const matrix = await permissionsCache.getMatrix();
  const rolePermissions = matrix[user.role] || {};
  const permissions = Object.keys(rolePermissions).filter(key => rolePermissions[key] === true);

  return {
    user: {
      id:         user.id,
      username:   user.username,
      fullNameAr: user.fullNameAr,
      role:       user.role,
      nodeId:     user.nodeId,
      nodeIds:    user.nodeIds,
      permissions,
    },
    ...tokens,
  };
};

// ── Refresh Tokens ────────────────────────────────────────────────────────────
const refreshTokens = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthenticationError('رمز التجديد غير صالح أو منتهي الصلاحية');
  }

  const user = await repo.findById(decoded.sub);
  if (!user) throw new AuthenticationError('المستخدم غير موجود');

  const tokens = issueTokenPair(user);
  return tokens;
};

// ── Logout ────────────────────────────────────────────────────────────────────
const logout = async (jti) => {
  // Blacklist the access token's JTI — prevents reuse until expiry
  blacklistToken(jti);
  return { message: 'تم تسجيل الخروج بنجاح' };
};

// ── Change Password ───────────────────────────────────────────────────────────
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError('المستخدم غير موجود');

  // Verify current password
  const userWithHash = await repo.findByUsername(user.username);
  const isValid = await bcrypt.compare(currentPassword, userWithHash.passwordHash);
  if (!isValid) throw new AuthenticationError('كلمة المرور الحالية غير صحيحة');

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await repo.updatePasswordHash(userId, newHash);

  return { message: 'تم تغيير كلمة المرور بنجاح' };
};

// ── Hash password (used when creating users) ──────────────────────────────────
const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
};

module.exports = { login, refreshTokens, logout, changePassword, hashPassword };
