'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');
const { TransferLine, TransferTransaction } = require('../../api/v1/transactions/transfer.model');

/**
 * Transfer Repository — manages transaction headers, lines, and details for internal transfers.
 */

const createTransferHeader = async ({ txnType, nodeId, createdBy, notes = null, status = 'draft' }, connection) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('txnType', sql.NVarChar(30), txnType)
      .input('nodeId', sql.Int, nodeId)
      .input('createdBy', sql.Int, createdBy)
      .input('notes', sql.NVarChar(500), notes)
      .input('status', sql.NVarChar(20), status)
      .query(`
        INSERT INTO ops.transaction_headers (
          txn_type, node_id, created_by, txn_date, notes, status, created_at
        )
        OUTPUT INSERTED.txn_id AS txnId
        VALUES (
          @txnType, @nodeId, @createdBy, CAST(GETDATE() AS DATE), @notes, @status, GETDATE()
        )
      `);
    return result.recordset[0].txnId;
  } catch (err) {
    throw new DatabaseError(`فشل في إنشاء ترويسة الحركة التشغيلية: ${err.message}`);
  }
};

const createTransferLine = async (txnId, { itemCode, quantity, unitCode = null, unitCost = 0, notes = null }, connection) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('txnId', sql.Int, txnId)
      .input('itemCode', sql.NVarChar(50), itemCode.trim())
      .input('quantity', sql.Decimal(18, 4), quantity)
      .input('unitCode', sql.NVarChar(20), unitCode)
      .input('unitCost', sql.Decimal(18, 4), unitCost)
      .input('notes', sql.NVarChar(200), notes)
      .query(`
        INSERT INTO ops.transaction_lines (
          txn_id, item_code, quantity, unit_code, unit_cost, notes
        )
        VALUES (
          @txnId, @itemCode, @quantity, @unitCode, @unitCost, @notes
        )
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في إضافة سطر التحويل الداخلي: ${err.message}`);
  }
};

const createTransferDetail = async (txnId, { fromNodeId, toNodeId, reason = null }, connection) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('txnId', sql.Int, txnId)
      .input('fromNodeId', sql.Int, fromNodeId)
      .input('toNodeId', sql.Int, toNodeId)
      .input('reason', sql.NVarChar(200), reason)
      .query(`
        INSERT INTO ops.transaction_details (
          txn_id, from_node_id, to_node_id, reason, created_at
        )
        VALUES (
          @txnId, @fromNodeId, @toNodeId, @reason, GETDATE()
        )
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في إضافة تفاصيل التحويل الداخلي: ${err.message}`);
  }
};

const getTransferById = async (txnId) => {
  try {
    const pool = getSystemDB();
    const headerResult = await pool.request()
      .input('txnId', sql.Int, txnId)
      .query(`
        SELECT 
          h.txn_id        AS txnId,
          h.txn_type      AS txnType,
          h.node_id       AS nodeId,
          h.created_by    AS createdBy,
          u.username      AS creatorUsername,
          h.txn_date      AS txnDate,
          h.notes,
          h.status,
          h.confirmed_by  AS confirmedBy,
          h.confirmed_at  AS confirmedAt,
          cu.username     AS confirmerUsername,
          h.created_at    AS createdAt,
          d.from_node_id  AS fromNodeId,
          fn.node_name_ar AS fromNodeNameAr,
          d.to_node_id    AS toNodeId,
          tn.node_name_ar AS toNodeNameAr,
          d.reason
        FROM ops.transaction_headers h
        INNER JOIN ops.transaction_details d ON h.txn_id = d.txn_id
        LEFT JOIN ops.app_users u ON h.created_by = u.user_id
        LEFT JOIN ops.app_users cu ON h.confirmed_by = cu.user_id
        LEFT JOIN ops.inventory_nodes fn ON d.from_node_id = fn.node_id
        LEFT JOIN ops.inventory_nodes tn ON d.to_node_id = tn.node_id
        WHERE h.txn_id = @txnId
      `);

    const rawHeader = headerResult.recordset[0] ?? null;
    if (!rawHeader) return null;

    const header = TransferTransaction.fromDatabase(rawHeader);

    const linesResult = await pool.request()
      .input('txnId', sql.Int, txnId)
      .query(`
        SELECT 
          l.line_id    AS lineId,
          l.item_code  AS itemCode,
          i.item_name_ar AS itemNameAr,
          l.quantity,
          l.unit_code  AS unitCode,
          l.unit_cost  AS unitCost,
          l.total_cost AS totalCost,
          l.notes
        FROM ops.transaction_lines l
        LEFT JOIN ops.comsys_items i ON l.item_code = i.item_code
        WHERE l.txn_id = @txnId
      `);

    header.lines = linesResult.recordset.map(TransferLine.fromDatabase);
    return header;
  } catch (err) {
    throw new DatabaseError(`فشل في جلب تفاصيل التحويل: ${err.message}`);
  }
};

const getAllTransfers = async (nodeId = null, allowedNodeIds = null) => {
  try {
    const pool = getSystemDB();
    let queryText = `
      SELECT 
        h.txn_id        AS txnId,
        h.txn_type      AS txnType,
        h.txn_date      AS txnDate,
        h.notes,
        h.status,
        d.from_node_id  AS fromNodeId,
        fn.node_name_ar AS fromNodeNameAr,
        d.to_node_id    AS toNodeId,
        tn.node_name_ar AS toNodeNameAr,
        u.username      AS creatorUsername,
        cu.username     AS confirmerUsername,
        h.created_at    AS createdAt,
        (SELECT COUNT(1) FROM ops.transaction_lines l WHERE l.txn_id = h.txn_id) AS itemCount
      FROM ops.transaction_headers h
      INNER JOIN ops.transaction_details d ON h.txn_id = d.txn_id
      LEFT JOIN ops.app_users u ON h.created_by = u.user_id
      LEFT JOIN ops.app_users cu ON h.confirmed_by = cu.user_id
      LEFT JOIN ops.inventory_nodes fn ON d.from_node_id = fn.node_id
      LEFT JOIN ops.inventory_nodes tn ON d.to_node_id = tn.node_id
      WHERE 1 = 1
    `;
    const request = pool.request();
    if (nodeId) {
      request.input('nodeId', sql.Int, nodeId);
      queryText += ' AND (d.from_node_id = @nodeId OR d.to_node_id = @nodeId)';
    } else if (allowedNodeIds) {
      if (allowedNodeIds.length === 0) {
        queryText += ' AND 1 = 0';
      } else {
        queryText += ` AND (d.from_node_id IN (${allowedNodeIds.join(',')}) OR d.to_node_id IN (${allowedNodeIds.join(',')}))`;
      }
    }
    queryText += ' ORDER BY h.txn_id DESC';
    const result = await request.query(queryText);
    return result.recordset.map(TransferTransaction.fromDatabase);
  } catch (err) {
    throw new DatabaseError(`فشل في جلب قائمة التحويلات الداخلية: ${err.message}`);
  }
};

const updateTransferStatus = async (txnId, status, userId, connection) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('txnId', sql.Int, txnId)
      .input('status', sql.NVarChar(20), status)
      .input('userId', sql.Int, userId)
      .query(`
        UPDATE ops.transaction_headers
        SET status = @status,
            confirmed_by = CASE WHEN @status = 'confirmed' THEN @userId ELSE confirmed_by END,
            confirmed_at = CASE WHEN @status = 'confirmed' THEN GETDATE() ELSE confirmed_at END,
            cancelled_by = CASE WHEN @status = 'cancelled' THEN @userId ELSE cancelled_by END,
            cancelled_at = CASE WHEN @status = 'cancelled' THEN GETDATE() ELSE cancelled_at END
        WHERE txn_id = @txnId
      `);
  } catch (err) {
    throw new DatabaseError(`فشل في تحديث حالة التحويل الداخلي: ${err.message}`);
  }
};

module.exports = {
  createTransferHeader,
  createTransferLine,
  createTransferDetail,
  getTransferById,
  getAllTransfers,
  updateTransferStatus,
};
