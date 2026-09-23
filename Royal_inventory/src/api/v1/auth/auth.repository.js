'use strict';

const { getSystemDB, sql } = require('../../../config/database');
const { DatabaseError }    = require('../../../utils/errors');

/**
 * Auth Repository — queries the app_users table in our System DB.
 * Never touches Comsys DB.
 */

const User = require('../auth/../users/user.model');

/**
 * Find a user by username (case-insensitive).
 * Returns the full user row including password_hash.
 */
const findByUsername = async (username) => {
  try {
    const pool   = getSystemDB();
    const result = await pool.request()
      .input('username', sql.NVarChar(50), username.toLowerCase().trim())
      .query(`
        SELECT
          u.user_id         AS id,
          u.username,
          u.full_name_ar    AS fullNameAr,
          u.password_hash   AS passwordHash,
          u.role,
          u.node_id         AS nodeId,
          u.is_active       AS isActive,
          u.last_login_at   AS lastLoginAt,
          u.failed_attempts AS failedAttempts,
          u.locked_until    AS lockedUntil
        FROM ops.app_users u
        WHERE u.username = @username
      `);

    const user = User.fromDatabase(result.recordset[0]);
    if (user) {
      const nodesResult = await pool.request()
        .input('userId', sql.Int, user.id)
        .query('SELECT node_id FROM ops.user_nodes WHERE user_id = @userId');
      user.nodeIds = nodesResult.recordset.map(r => r.node_id);
    }
    return user;
  } catch (err) {
    throw new DatabaseError(`فشل في البحث عن المستخدم: ${err.message}`);
  }
};

/**
 * Find a user by ID.
 */
const findById = async (userId) => {
  try {
    const pool   = getSystemDB();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT
          u.user_id       AS id,
          u.username,
          u.full_name_ar  AS fullNameAr,
          u.password_hash AS passwordHash,
          u.role,
          u.node_id       AS nodeId,
          u.is_active     AS isActive
        FROM ops.app_users u
        WHERE u.user_id = @userId AND u.is_active = 1
      `);

    const user = User.fromDatabase(result.recordset[0]);
    if (user) {
      const nodesResult = await pool.request()
        .input('userId', sql.Int, user.id)
        .query('SELECT node_id FROM ops.user_nodes WHERE user_id = @userId');
      user.nodeIds = nodesResult.recordset.map(r => r.node_id);
    }
    return user;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب بيانات المستخدم: ${err.message}`);
  }
};

/**
 * Update last_login_at and reset failed_attempts after successful login.
 */
const recordSuccessfulLogin = async (userId) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE ops.app_users
        SET last_login_at   = GETDATE(),
            failed_attempts = 0,
            locked_until    = NULL
        WHERE user_id = @userId
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في تحديث بيانات الدخول: ${err.message}`);
  }
};

/**
 * Increment failed login attempts.
 * Locks account after 5 failed attempts for 15 minutes.
 */
const recordFailedLogin = async (userId) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE ops.app_users
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE
              WHEN failed_attempts + 1 >= 5
              THEN DATEADD(MINUTE, 15, GETDATE())
              ELSE NULL
            END
        WHERE user_id = @userId
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في تسجيل محاولة الدخول الفاشلة: ${err.message}`);
  }
};

/**
 * Update password hash (for change password flow).
 */
const updatePasswordHash = async (userId, newHash) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('userId',  sql.Int,          userId)
      .input('newHash', sql.NVarChar(255), newHash)
      .query(`
        UPDATE ops.app_users
        SET password_hash      = @newHash,
            password_changed_at = GETDATE()
        WHERE user_id = @userId
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في تحديث كلمة المرور: ${err.message}`);
  }
};

module.exports = {
  findByUsername,
  findById,
  recordSuccessfulLogin,
  recordFailedLogin,
  updatePasswordHash,
};
