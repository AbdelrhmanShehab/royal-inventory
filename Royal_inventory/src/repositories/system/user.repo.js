'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');

/**
 * User Repository — CRUD operations for ops.app_users.
 */

const User = require('../../api/v1/users/user.model');

/** Full SELECT projection used in all read queries */
const USER_SELECT = `
  u.user_id         AS id,
  u.username,
  u.full_name_ar    AS fullNameAr,
  u.password_hash   AS passwordHash,
  u.role,
  u.node_id         AS nodeId,
  u.is_active       AS isActive,
  n.node_name_ar    AS nodeNameAr,
  u.last_login_at   AS lastLoginAt,
  u.locked_until    AS lockedUntil,
  u.failed_attempts AS failedAttempts,
  u.created_at      AS createdAt
`;

const createUser = async ({ username, fullNameAr, passwordHash, role, nodeId = null, isActive = true, nodeIds = [] }) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input('username',     sql.NVarChar(50),  username.toLowerCase().trim())
      .input('fullNameAr',   sql.NVarChar(100), fullNameAr.trim())
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('role',         sql.NVarChar(20),  role)
      .input('nodeId',       sql.Int,           nodeId)
      .input('isActive',     sql.Bit,           isActive)
      .query(`
        INSERT INTO ops.app_users
          (username, full_name_ar, password_hash, role, node_id, is_active, created_at, updated_at)
        OUTPUT INSERTED.user_id AS id
        VALUES
          (@username, @fullNameAr, @passwordHash, @role, @nodeId, @isActive, GETDATE(), GETDATE())
      `);
    const newUserId = result.recordset[0].id;

    // Deduplicate and filter out nulls
    const uniqueNodeIds = Array.from(new Set([nodeId, ...nodeIds].filter(id => id !== null && id !== undefined)));

    // Insert multiple scopes inside same transaction
    for (const nId of uniqueNodeIds) {
      await new sql.Request(transaction)
        .input('userId', sql.Int, newUserId)
        .input('nodeId', sql.Int, nId)
        .query('INSERT INTO ops.user_nodes (user_id, node_id) VALUES (@userId, @nodeId)');
    }

    await transaction.commit();
    return newUserId;
  } catch (err) {
    await transaction.rollback();
    if (err.message.includes('uq_username')) {
      throw new DatabaseError('اسم المستخدم موجود بالفعل في النظام');
    }
    throw new DatabaseError(`فشل في إنشاء المستخدم: ${err.message}`);
  }
};

const getUserById = async (userId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT ${USER_SELECT}
        FROM ops.app_users u
        LEFT JOIN ops.inventory_nodes n ON u.node_id = n.node_id
        WHERE u.user_id = @userId
      `);
    const user = User.fromDatabase(result.recordset[0]);
    if (user) {
      const nodesResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT node_id FROM ops.user_nodes WHERE user_id = @userId');
      user.nodeIds = nodesResult.recordset.map(r => r.node_id);
    }
    return user;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب بيانات المستخدم: ${err.message}`);
  }
};

const getAllUsers = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT ${USER_SELECT}
      FROM ops.app_users u
      LEFT JOIN ops.inventory_nodes n ON u.node_id = n.node_id
      ORDER BY u.user_id
    `);
    const users = result.recordset.map(User.fromDatabase);
    if (users.length > 0) {
      const nodesResult = await pool.request().query('SELECT user_id, node_id FROM ops.user_nodes');
      const nodeMap = {};
      for (const r of nodesResult.recordset) {
        if (!nodeMap[r.user_id]) nodeMap[r.user_id] = [];
        nodeMap[r.user_id].push(r.node_id);
      }
      for (const u of users) {
        u.nodeIds = nodeMap[u.id] || [];
      }
    }
    return users;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب المستخدمين: ${err.message}`);
  }
};

const updateUser = async (userId, { fullNameAr, role, nodeId = null, isActive, nodeIds = [] }) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input('userId',     sql.Int,          userId)
      .input('fullNameAr', sql.NVarChar(100), fullNameAr.trim())
      .input('role',       sql.NVarChar(20),  role)
      .input('nodeId',     sql.Int,           nodeId)
      .input('isActive',   sql.Bit,           isActive)
      .query(`
        UPDATE ops.app_users
        SET full_name_ar = @fullNameAr,
            role         = @role,
            node_id      = @nodeId,
            is_active    = @isActive,
            updated_at   = GETDATE()
        WHERE user_id = @userId
      `);

    // Clear existing scopes
    await new sql.Request(transaction)
      .input('userId', sql.Int, userId)
      .query('DELETE FROM ops.user_nodes WHERE user_id = @userId');

    // Deduplicate and filter out nulls
    const uniqueNodeIds = Array.from(new Set([nodeId, ...nodeIds].filter(id => id !== null && id !== undefined)));

    // Insert updated scopes
    for (const nId of uniqueNodeIds) {
      await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .input('nodeId', sql.Int, nId)
        .query('INSERT INTO ops.user_nodes (user_id, node_id) VALUES (@userId, @nodeId)');
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في تحديث المستخدم: ${err.message}`);
  }
};

/**
 * Reset a user's password hash — admin action, no old-password check.
 */
const resetPasswordHash = async (userId, newHash) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('userId',  sql.Int,          userId)
      .input('newHash', sql.NVarChar(255), newHash)
      .query(`
        UPDATE ops.app_users
        SET password_hash       = @newHash,
            password_changed_at = GETDATE(),
            failed_attempts     = 0,
            locked_until        = NULL,
            updated_at          = GETDATE()
        WHERE user_id = @userId
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في إعادة تعيين كلمة المرور: ${err.message}`);
  }
};

const deleteUser = async (userId) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM ops.app_users WHERE user_id = @userId');
  } catch (err) {
    throw new DatabaseError(`فشل في حذف المستخدم: ${err.message}`);
  }
};

module.exports = {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  resetPasswordHash,
  deleteUser,
};
