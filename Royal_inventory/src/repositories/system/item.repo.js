'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');
const { Item } = require('../../api/v1/masterData/masterData.model');

/**
 * System Item Repository — manages ops.comsys_items (local cache).
 */

const getAllItems = async (division = null, categoryCode = null) => {
  try {
    const pool = getSystemDB();
    let queryText = `
      SELECT 
        item_id       AS id,
        item_code     AS itemCode,
        item_name_ar  AS itemNameAr,
        item_name_en  AS itemNameEn,
        category_code AS categoryCode,
        unit_code     AS unitCode,
        unit_name_ar  AS unitNameAr,
        item_type     AS itemType,
        division,
        is_active     AS isActive,
        synced_at     AS syncedAt
      FROM ops.comsys_items
    `;
    const request = pool.request();
    const conditions = [];

    if (division) {
      request.input('division', sql.NVarChar(10), division);
      conditions.push('division = @division');
    }
    if (categoryCode) {
      request.input('categoryCode', sql.NVarChar(50), categoryCode.trim());
      conditions.push('category_code = @categoryCode');
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY item_code';
    const result = await request.query(queryText);
    return result.recordset.map(Item.fromDatabase);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب الأصناف المحلية: ${err.message}`);
  }
};

const getItemByCode = async (itemCode) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('itemCode', sql.NVarChar(50), itemCode.trim())
      .query(`
        SELECT TOP 1
          item_id       AS id,
          item_code     AS itemCode,
          item_name_ar  AS itemNameAr,
          item_name_en  AS itemNameEn,
          category_code AS categoryCode,
          unit_code     AS unitCode,
          unit_name_ar  AS unitNameAr,
          item_type     AS itemType,
          division,
          is_active     AS isActive,
          synced_at     AS syncedAt
        FROM ops.comsys_items
        WHERE item_code = @itemCode
      `);
    return result.recordset[0] ? Item.fromDatabase(result.recordset[0]) : null;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب بيانات الصنف بالرمز: ${err.message}`);
  }
};

module.exports = {
  getAllItems,
  getItemByCode,
};
