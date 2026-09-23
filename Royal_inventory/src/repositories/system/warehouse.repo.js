'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');

/**
 * System Warehouse Repository — manages ops.comsys_warehouses (local cache).
 */

const Warehouse = require('../../api/v1/warehouses/warehouse.model');

const getAllWarehouses = async (division = null) => {
  try {
    const pool = getSystemDB();
    let queryText = `
      SELECT 
        warehouse_id  AS id,
        store_code    AS storeCode,
        store_name_ar AS storeNameAr,
        store_name_en AS storeNameEn,
        division,
        is_active     AS isActive,
        synced_at     AS syncedAt
      FROM ops.comsys_warehouses
    `;
    const request = pool.request();
    if (division) {
      request.input('division', sql.NVarChar(10), division);
      queryText += ' WHERE division = @division';
    }
    queryText += ' ORDER BY store_code';
    const result = await request.query(queryText);
    return result.recordset.map(Warehouse.fromDatabase);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب المستودعات المحلية: ${err.message}`);
  }
};

module.exports = {
  getAllWarehouses,
};
