'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');

/**
 * Get all role permissions as a matrix: { role: { permission_key: bool } }
 */
const getAllPermissions = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT role, permission_key AS permissionKey, allowed
      FROM ops.role_permissions
      ORDER BY role, permission_key
    `);

    // Build matrix
    const matrix = {};
    for (const row of result.recordset) {
      if (!matrix[row.role]) matrix[row.role] = {};
      matrix[row.role][row.permissionKey] = row.allowed === true || row.allowed === 1;
    }
    return matrix;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب صلاحيات الأدوار: ${err.message}`);
  }
};

/**
 * Update a single role+permission combination
 * @param {string} role
 * @param {string} permissionKey
 * @param {boolean} allowed
 */
const updatePermission = async (role, permissionKey, allowed) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('role',          sql.NVarChar(50),  role)
      .input('permKey',       sql.NVarChar(100), permissionKey)
      .input('allowed',       sql.Bit,           allowed ? 1 : 0)
      .query(`
        MERGE ops.role_permissions AS target
        USING (SELECT @role AS role, @permKey AS permission_key) AS source
          ON target.role = source.role AND target.permission_key = source.permission_key
        WHEN MATCHED THEN
          UPDATE SET allowed = @allowed, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (role, permission_key, allowed, updated_at)
          VALUES (@role, @permKey, @allowed, GETDATE());
      `);
    return { role, permissionKey, allowed };
  } catch (err) {
    throw new DatabaseError(`فشل في تحديث الصلاحية: ${err.message}`);
  }
};

/**
 * Bulk update: save entire matrix at once
 * @param {Array<{role, permissionKey, allowed}>} updates
 */
const bulkUpdatePermissions = async (updates) => {
  try {
    const pool = getSystemDB();
    for (const u of updates) {
      await pool.request()
        .input('role',    sql.NVarChar(50),  u.role)
        .input('permKey', sql.NVarChar(100), u.permissionKey)
        .input('allowed', sql.Bit,           u.allowed ? 1 : 0)
        .query(`
          MERGE ops.role_permissions AS target
          USING (SELECT @role AS role, @permKey AS permission_key) AS source
            ON target.role = source.role AND target.permission_key = source.permission_key
          WHEN MATCHED THEN
            UPDATE SET allowed = @allowed, updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (role, permission_key, allowed, updated_at)
            VALUES (@role, @permKey, @allowed, GETDATE());
        `);
    }
    return { updated: updates.length };
  } catch (err) {
    throw new DatabaseError(`فشل في الحفظ الجماعي للصلاحيات: ${err.message}`);
  }
};

module.exports = { getAllPermissions, updatePermission, bulkUpdatePermissions };
