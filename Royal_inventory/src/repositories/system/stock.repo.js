'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');

/**
 * Stock Repository — manages ops.operational_stock ledger.
 */

const ALLOWED_STOCK_FIELDS = [
  'qty_received',
  'qty_internal_in',
  'qty_returned_in',
  'qty_consumed',
  'qty_damaged',
  'qty_wasted',
  'qty_disposed',
  'qty_transferred_out',
  'qty_laundry',
  'qty_returned_out',
];

const getStockByNodeAndItem = async (nodeId, itemCode) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .input('itemCode', sql.NVarChar(50), itemCode.trim())
      .query(`
        SELECT 
          stock_id AS id, node_id AS nodeId, item_code AS itemCode,
          qty_received AS qtyReceived, qty_internal_in AS qtyInternalIn,
          qty_returned_in AS qtyReturnedIn, qty_consumed AS qtyConsumed,
          qty_damaged AS qtyDamaged, qty_wasted AS qtyWasted,
          qty_disposed AS qtyDisposed, qty_transferred_out AS qtyTransferredOut,
          qty_laundry AS qtyLaundry, qty_returned_out AS qtyReturnedOut,
          qty_operational AS qtyOperational, last_updated AS lastUpdated
        FROM ops.operational_stock
        WHERE node_id = @nodeId AND item_code = @itemCode
      `);
    return result.recordset[0] ?? null;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب رصيد المخزن للقطعة: ${err.message}`);
  }
};

const getStockByNode = async (nodeId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .query(`
        SELECT 
          s.stock_id AS id, s.node_id AS nodeId, s.item_code AS itemCode,
          i.item_name_ar AS itemNameAr, i.unit_name_ar AS unitNameAr, i.item_type AS itemType,
          s.qty_received AS qtyReceived, s.qty_internal_in AS qtyInternalIn,
          s.qty_returned_in AS qtyReturnedIn, s.qty_consumed AS qtyConsumed,
          s.qty_damaged AS qtyDamaged, s.qty_wasted AS qtyWasted,
          s.qty_disposed AS qtyDisposed, s.qty_transferred_out AS qtyTransferredOut,
          s.qty_laundry AS qtyLaundry, s.qty_returned_out AS qtyReturnedOut,
          s.qty_operational AS qtyOperational, s.last_updated AS lastUpdated
        FROM ops.operational_stock s
        INNER JOIN ops.inventory_nodes n ON s.node_id = n.node_id
        LEFT JOIN ops.comsys_warehouses w ON n.comsys_store_code = w.store_code AND n.division = w.division
        LEFT JOIN ops.comsys_items i ON s.item_code = i.item_code AND i.division = w.division
        WHERE s.node_id = @nodeId
      `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب الأرصدة التشغيلية للمستودع: ${err.message}`);
  }
};

/**
 * Adjust stock ledger for a specific node and item.
 * Must run inside a transaction if part of a transfer.
 * @param {number} nodeId
 * @param {string} itemCode
 * @param {string} field - column to increment
 * @param {number} qty - quantity to adjust (can be positive or negative)
 * @param {object} connection - optional mssql connection/transaction
 */
const adjustStock = async (nodeId, itemCode, field, qty, connection = null) => {
  if (!ALLOWED_STOCK_FIELDS.includes(field)) {
    throw new Error(`Invalid stock field: ${field}`);
  }

  try {
    const client = connection || getSystemDB();

    // Construct dynamic sql safely since field is whitelisted
    const query = `
      MERGE ops.operational_stock AS target
      USING (SELECT @nodeId AS node_id, @itemCode AS item_code) AS source
      ON (target.node_id = source.node_id AND target.item_code = source.item_code)
      WHEN MATCHED THEN
        UPDATE SET 
          ${field} = target.${field} + @qty,
          last_updated = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (node_id, item_code, ${field}, last_updated)
        VALUES (source.node_id, source.item_code, @qty, GETDATE());
    `;

    await client.request()
      .input('nodeId', sql.Int, nodeId)
      .input('itemCode', sql.NVarChar(50), itemCode.trim())
      .input('qty', sql.Decimal(18, 4), qty)
      .query(query);

  } catch (err) {
    throw new DatabaseError(`فشل في تحديث الرصيد الدفتري للمخزن: ${err.message}`);
  }
};

const getAllNodesTotalStock = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .query(`
        SELECT node_id AS nodeId, SUM(qty_operational) AS totalStock
        FROM ops.operational_stock
        GROUP BY node_id
      `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب الأرصدة الإجمالية للعقد: ${err.message}`);
  }
};

const getAllStock = async (groupId = null) => {
  try {
    const pool = getSystemDB();
    const request = pool.request();
    let queryText = `
      SELECT 
        s.stock_id AS id, s.node_id AS nodeId, s.item_code AS itemCode,
        i.item_name_ar AS itemNameAr, i.unit_name_ar AS unitNameAr, i.item_type AS itemType,
        i.category_code AS categoryCode,
        s.qty_received AS qtyReceived, s.qty_internal_in AS qtyInternalIn,
        s.qty_returned_in AS qtyReturnedIn, s.qty_consumed AS qtyConsumed,
        s.qty_damaged AS qtyDamaged, s.qty_wasted AS qtyWasted,
        s.qty_disposed AS qtyDisposed, s.qty_transferred_out AS qtyTransferredOut,
        s.qty_laundry AS qtyLaundry, s.qty_returned_out AS qtyReturnedOut,
        s.qty_operational AS qtyOperational, s.last_updated AS lastUpdated,
        n.node_name_ar AS nodeNameAr
      FROM ops.operational_stock s
      INNER JOIN ops.inventory_nodes n ON s.node_id = n.node_id
      LEFT JOIN ops.comsys_warehouses w ON n.comsys_store_code = w.store_code AND n.division = w.division
      LEFT JOIN ops.comsys_items i ON s.item_code = i.item_code AND i.division = w.division
    `;
    if (groupId) {
      request.input('groupId', sql.Int, groupId);
      queryText += ' WHERE n.group_id = @groupId';
    }
    const result = await request.query(queryText);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب الأرصدة التشغيلية العامة: ${err.message}`);
  }
};

const getBatchStockByNodeAndItems = async (nodeId, itemCodes) => {
  if (!itemCodes || itemCodes.length === 0) return [];
  try {
    const pool = getSystemDB();
    const request = pool.request();
    request.input('nodeId', sql.Int, nodeId);

    const paramNames = [];
    itemCodes.forEach((code, index) => {
      const paramName = `code_${index}`;
      request.input(paramName, sql.NVarChar(50), code.trim());
      paramNames.push(`@${paramName}`);
    });

    const result = await request.query(`
      SELECT item_code AS itemCode, qty_operational AS qtyOperational
      FROM ops.operational_stock
      WHERE node_id = @nodeId AND item_code IN (${paramNames.join(', ')})
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب أرصدة الأصناف دفعة واحدة: ${err.message}`);
  }
};

module.exports = {
  getStockByNodeAndItem,
  getStockByNode,
  adjustStock,
  getAllNodesTotalStock,
  getAllStock,
  getBatchStockByNodeAndItems,
};
