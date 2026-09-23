'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');
const OperationalLocation = require('../../api/v1/operationalDistribution/location.model');

const createLocation = async ({ tenantId = 1, nodeId, name, description = null, isActive = true, displayOrder = 0 }) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('tenantId', sql.Int, tenantId)
      .input('nodeId', sql.Int, nodeId)
      .input('name', sql.NVarChar(100), name.trim())
      .input('description', sql.NVarChar(500), description?.trim() || null)
      .input('isActive', sql.Bit, isActive)
      .input('displayOrder', sql.Int, displayOrder)
      .query(`
        INSERT INTO ops.operational_locations (
          tenant_id, node_id, name, description, is_active, display_order, created_at, updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @tenantId, @nodeId, @name, @description, @isActive, @displayOrder, GETDATE(), GETDATE()
        )
      `);
    return result.recordset[0].id;
  } catch (err) {
    throw new DatabaseError(`فشل في إنشاء الموقع التشغيلي: ${err.message}`);
  }
};

const getLocationById = async (id) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          id, tenant_id AS tenantId, node_id AS nodeId, name, description,
          is_active AS isActive, display_order AS displayOrder, created_at AS createdAt, updated_at AS updatedAt
        FROM ops.operational_locations
        WHERE id = @id
      `);
    return result.recordset[0] ? OperationalLocation.fromDatabase(result.recordset[0]) : null;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب الموقع التشغيلي: ${err.message}`);
  }
};

const getLocationsByNodeId = async (nodeId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .query(`
        SELECT 
          id, tenant_id AS tenantId, node_id AS nodeId, name, description,
          is_active AS isActive, display_order AS displayOrder, created_at AS createdAt, updated_at AS updatedAt
        FROM ops.operational_locations
        WHERE node_id = @nodeId
        ORDER BY display_order, id
      `);
    return result.recordset.map(OperationalLocation.fromDatabase);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب المواقع التشغيلية للمستودع: ${err.message}`);
  }
};

const getLocationCountByNode = async (nodeId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .query(`
        SELECT COUNT(1) AS count
        FROM ops.operational_locations
        WHERE node_id = @nodeId
      `);
    return result.recordset[0].count;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب عدد المواقع التشغيلية: ${err.message}`);
  }
};

const updateLocation = async (id, { name, description, isActive, displayOrder }) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(100), name.trim())
      .input('description', sql.NVarChar(500), description?.trim() || null)
      .input('isActive', sql.Bit, isActive)
      .input('displayOrder', sql.Int, displayOrder)
      .query(`
        UPDATE ops.operational_locations
        SET name = @name,
            description = @description,
            is_active = @isActive,
            display_order = @displayOrder,
            updated_at = GETDATE()
        WHERE id = @id
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في تحديث الموقع التشغيلي: ${err.message}`);
  }
};

const deleteLocation = async (id) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM ops.operational_locations
        WHERE id = @id
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في حذف الموقع التشغيلي من قاعدة البيانات: ${err.message}`);
  }
};

module.exports = {
  createLocation,
  getLocationById,
  getLocationsByNodeId,
  getLocationCountByNode,
  updateLocation,
  deleteLocation,
};
