'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');
const { HotelGroup, InventoryNode } = require('../../api/v1/hierarchy/hierarchy.model');

/**
 * Hierarchy Repository — manages hotel groups and inventory nodes hierarchy
 * in our local System DB.
 */

// ─── 1. Hotel Groups CRUD ────────────────────────────────────────────────────

const createGroup = async ({ groupNameAr, groupNameEn, groupCode, isActive = true }) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('groupNameAr', sql.NVarChar(100), groupNameAr.trim())
      .input('groupNameEn', sql.NVarChar(100), groupNameEn?.trim() || null)
      .input('groupCode', sql.NVarChar(20), groupCode.toUpperCase().trim())
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO ops.hotel_groups (group_name_ar, group_name_en, group_code, is_active, created_at)
        OUTPUT INSERTED.group_id AS id
        VALUES (@groupNameAr, @groupNameEn, @groupCode, @isActive, GETDATE())
      `);
    return result.recordset[0].id;
  } catch (err) {
    throw new DatabaseError(`فشل في إنشاء المجموعة: ${err.message}`);
  }
};

const getGroupById = async (groupId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('groupId', sql.Int, groupId)
      .query(`
        SELECT 
          group_id AS id, group_name_ar AS groupNameAr, group_name_en AS groupNameEn, 
          group_code AS groupCode, is_active AS isActive, created_at AS createdAt
        FROM ops.hotel_groups
        WHERE group_id = @groupId
      `);
    return HotelGroup.fromDatabase(result.recordset[0]);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب بيانات المجموعة: ${err.message}`);
  }
};

const getAllGroups = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT 
        group_id AS id, group_name_ar AS groupNameAr, group_name_en AS groupNameEn, 
        group_code AS groupCode, is_active AS isActive, created_at AS createdAt
      FROM ops.hotel_groups
      ORDER BY group_id
    `);
    return result.recordset.map(HotelGroup.fromDatabase);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب المجموعات: ${err.message}`);
  }
};

const updateGroup = async (groupId, { groupNameAr, groupNameEn, isActive }) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('groupId', sql.Int, groupId)
      .input('groupNameAr', sql.NVarChar(100), groupNameAr.trim())
      .input('groupNameEn', sql.NVarChar(100), groupNameEn?.trim() || null)
      .input('isActive', sql.Bit, isActive)
      .query(`
        UPDATE ops.hotel_groups
        SET group_name_ar = @groupNameAr,
            group_name_en = @groupNameEn,
            is_active     = @isActive
        WHERE group_id = @groupId
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في تحديث المجموعة: ${err.message}`);
  }
};

const deleteGroup = async (groupId) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('groupId', sql.Int, groupId)
      .query('DELETE FROM ops.hotel_groups WHERE group_id = @groupId');
  } catch (err) {
    throw new DatabaseError(`فشل في حذف المجموعة: ${err.message}`);
  }
};

// ─── 2. Inventory Nodes CRUD ─────────────────────────────────────────────────

const createNode = async ({ comsysStoreCode, groupId, parentNodeId, nodeNameAr, nodeType, managerName, isActive = true, division = 'fb', hasLaundryAccess = false }) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('comsysStoreCode', sql.NVarChar(50), comsysStoreCode?.trim() || null)
      .input('groupId', sql.Int, groupId)
      .input('parentNodeId', sql.Int, parentNodeId || null)
      .input('nodeNameAr', sql.NVarChar(100), nodeNameAr.trim())
      .input('nodeType', sql.NVarChar(20), nodeType)
      .input('managerName', sql.NVarChar(100), managerName?.trim() || null)
      .input('isActive', sql.Bit, isActive)
      .input('division', sql.NVarChar(10), division)
      .input('hasLaundryAccess', sql.Bit, hasLaundryAccess)
      .query(`
        INSERT INTO ops.inventory_nodes (
          comsys_store_code, group_id, parent_node_id, node_name_ar, 
          node_type, manager_name, is_active, division, has_laundry_access, created_at, updated_at
        )
        OUTPUT INSERTED.node_id AS id
        VALUES (
          @comsysStoreCode, @groupId, @parentNodeId, @nodeNameAr, 
          @nodeType, @managerName, @isActive, @division, @hasLaundryAccess, GETDATE(), GETDATE()
        )
      `);
    return result.recordset[0].id;
  } catch (err) {
    throw new DatabaseError(`فشل في إنشاء عقدة شجرة المخازن: ${err.message}`);
  }
};

const getNodeById = async (nodeId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .query(`
        SELECT 
          node_id AS id, comsys_store_code AS comsysStoreCode, group_id AS groupId, 
          parent_node_id AS parentNodeId, node_name_ar AS nodeNameAr, node_type AS nodeType, 
          manager_name AS managerName, is_active AS isActive, division, has_laundry_access AS hasLaundryAccess
        FROM ops.inventory_nodes
        WHERE node_id = @nodeId
      `);
    return InventoryNode.fromDatabase(result.recordset[0]);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب بيانات العقدة: ${err.message}`);
  }
};

const getAllNodes = async (groupId = null) => {
  try {
    const pool = getSystemDB();
    let queryText = `
      SELECT 
        node_id AS id, comsys_store_code AS comsysStoreCode, group_id AS groupId, 
        parent_node_id AS parentNodeId, node_name_ar AS nodeNameAr, node_type AS nodeType, 
        manager_name AS managerName, is_active AS isActive, division, has_laundry_access AS hasLaundryAccess
      FROM ops.inventory_nodes
    `;
    const request = pool.request();
    if (groupId) {
      request.input('groupId', sql.Int, groupId);
      queryText += ' WHERE group_id = @groupId';
    }
    queryText += ' ORDER BY parent_node_id, node_id';
    const result = await request.query(queryText);
    return result.recordset.map(InventoryNode.fromDatabase);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب عقد الشجرة: ${err.message}`);
  }
};

const updateNode = async (nodeId, { comsysStoreCode, parentNodeId, nodeNameAr, nodeType, managerName, isActive, division, hasLaundryAccess }) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .input('comsysStoreCode', sql.NVarChar(50), comsysStoreCode?.trim() || null)
      .input('parentNodeId', sql.Int, parentNodeId || null)
      .input('nodeNameAr', sql.NVarChar(100), nodeNameAr.trim())
      .input('nodeType', sql.NVarChar(20), nodeType)
      .input('managerName', sql.NVarChar(100), managerName?.trim() || null)
      .input('isActive', sql.Bit, isActive)
      .input('division', sql.NVarChar(10), division || 'fb')
      .input('hasLaundryAccess', sql.Bit, hasLaundryAccess)
      .query(`
        UPDATE ops.inventory_nodes
        SET comsys_store_code = @comsysStoreCode,
            parent_node_id    = @parentNodeId,
            node_name_ar      = @nodeNameAr,
            node_type         = @nodeType,
            manager_name      = @managerName,
            is_active         = @isActive,
            division          = @division,
            has_laundry_access = @hasLaundryAccess,
            updated_at        = GETDATE()
        WHERE node_id = @nodeId
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في تحديث العقدة: ${err.message}`);
  }
};

const deleteNode = async (nodeId) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .query('DELETE FROM ops.inventory_nodes WHERE node_id = @nodeId');
  } catch (err) {
    throw new DatabaseError(`فشل في حذف العقدة: ${err.message}`);
  }
};

module.exports = {
  createGroup,
  getGroupById,
  getAllGroups,
  updateGroup,
  deleteGroup,
  createNode,
  getNodeById,
  getAllNodes,
  updateNode,
  deleteNode,
};
