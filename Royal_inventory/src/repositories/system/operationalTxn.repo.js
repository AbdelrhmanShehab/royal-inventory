'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');
const OperationalTransaction = require('../../api/v1/operationalDistribution/operationalTxn.model');

const createTransaction = async ({ tenantId = 1, nodeId, locationId, itemCode, transactionType, quantity, notes = null, referenceType = null, referenceId = null, createdBy }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('tenantId', sql.Int, tenantId)
      .input('nodeId', sql.Int, nodeId)
      .input('locationId', sql.Int, locationId)
      .input('itemCode', sql.NVarChar(50), itemCode.trim())
      .input('transactionType', sql.NVarChar(20), transactionType)
      .input('quantity', sql.Decimal(18, 4), quantity)
      .input('notes', sql.NVarChar(500), notes?.trim() || null)
      .input('referenceType', sql.NVarChar(50), referenceType?.trim() || null)
      .input('referenceId', sql.NVarChar(100), referenceId?.trim() || null)
      .input('createdBy', sql.Int, createdBy)
      .query(`
        INSERT INTO ops.operational_transactions (
          tenant_id, node_id, location_id, item_code, transaction_type, quantity, notes, reference_type, reference_id, created_by, created_at
        )
        OUTPUT INSERTED.id
        VALUES (
          @tenantId, @nodeId, @locationId, @itemCode, @transactionType, @quantity, @notes, @referenceType, @referenceId, @createdBy, GETDATE()
        )
      `);
    return result.recordset[0].id;
  } catch (err) {
    throw new DatabaseError(`فشل في تسجيل الحركة التشغيلية: ${err.message}`);
  }
};

const getTransactionCountByLocation = async (locationId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('locationId', sql.Int, locationId)
      .query(`
        SELECT COUNT(1) AS count
        FROM ops.operational_transactions
        WHERE location_id = @locationId
      `);
    return result.recordset[0].count;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب عدد حركات الموقع التشغيلي: ${err.message}`);
  }
};

const getLocationAggregatedBalances = async (locationId, itemCode = null) => {
  try {
    const pool = getSystemDB();
    let queryText = `
      SELECT 
        item_code AS itemCode,
        SUM(CASE WHEN transaction_type = 'ALLOCATE' THEN quantity ELSE 0 END) AS allocated,
        SUM(CASE WHEN transaction_type = 'CONSUME' THEN quantity ELSE 0 END) AS consumed,
        SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity ELSE 0 END) AS returned,
        SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity ELSE 0 END) AS adjusted
      FROM ops.operational_transactions
      WHERE location_id = @locationId
    `;
    const request = pool.request().input('locationId', sql.Int, locationId);
    if (itemCode) {
      request.input('itemCode', sql.NVarChar(50), itemCode.trim());
      queryText += ' AND item_code = @itemCode';
    }
    queryText += ' GROUP BY item_code';
    const result = await request.query(queryText);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب أرصدة الموقع التشغيلي المتجمعة: ${err.message}`);
  }
};

const getNodeAggregatedBalances = async (nodeId, itemCode = null) => {
  try {
    const pool = getSystemDB();
    let queryText = `
      SELECT 
        t.location_id AS locationId,
        l.name AS locationName,
        t.item_code AS itemCode,
        SUM(CASE WHEN t.transaction_type = 'ALLOCATE' THEN t.quantity ELSE 0 END) AS allocated,
        SUM(CASE WHEN t.transaction_type = 'CONSUME' THEN t.quantity ELSE 0 END) AS consumed,
        SUM(CASE WHEN t.transaction_type = 'RETURN' THEN t.quantity ELSE 0 END) AS returned,
        SUM(CASE WHEN t.transaction_type = 'ADJUSTMENT' THEN t.quantity ELSE 0 END) AS adjusted
      FROM ops.operational_transactions t
      INNER JOIN ops.operational_locations l ON t.location_id = l.id
      WHERE t.node_id = @nodeId
    `;
    const request = pool.request().input('nodeId', sql.Int, nodeId);
    if (itemCode) {
      request.input('itemCode', sql.NVarChar(50), itemCode.trim());
      queryText += ' AND t.item_code = @itemCode';
    }
    queryText += ' GROUP BY t.location_id, l.name, t.item_code';
    const result = await request.query(queryText);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب أرصدة المستودع التشغيلية المتجمعة: ${err.message}`);
  }
};

module.exports = {
  createTransaction,
  getTransactionCountByLocation,
  getLocationAggregatedBalances,
  getNodeAggregatedBalances,
};
