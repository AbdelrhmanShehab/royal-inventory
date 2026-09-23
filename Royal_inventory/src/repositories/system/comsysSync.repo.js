'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');

/**
 * Sync Repository — writes cached Comsys data to our System DB (ops schema).
 */

/**
 * Upsert warehouses in ops.comsys_warehouses
 * @param {Array} warehouses - list of warehouses mapped from Comsys
 * @param {'fb'|'gs'} division - F&B or General
 */
const upsertWarehouses = async (warehouses, division) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Truncate staging table
    const request = new sql.Request(transaction);
    await request.query('TRUNCATE TABLE ops.comsys_warehouses_staging;');

    // 2. Prepare bulk insert using sql.Table
    const stagingTable = new sql.Table('ops.comsys_warehouses_staging');
    stagingTable.create = false; // already exists
    stagingTable.columns.add('store_code', sql.NVarChar(50), { nullable: false });
    stagingTable.columns.add('store_name_ar', sql.NVarChar(200), { nullable: false });
    stagingTable.columns.add('store_name_en', sql.NVarChar(200), { nullable: true });
    stagingTable.columns.add('is_active', sql.Bit, { nullable: false });

    // 3. Add rows to table
    for (const w of warehouses) {
      if (w.warehouse_code == null || w.warehouse_name_ar == null) continue;
      stagingTable.rows.add(
        w.warehouse_code.trim(),
        w.warehouse_name_ar.trim(),
        w.warehouse_name_en?.trim() || '',
        w.is_active ? 1 : 0
      );
    }

    // 4. Execute Bulk copy into staging table
    await request.bulk(stagingTable);

    // 5. Execute MERGE query joining with target table
    const mergeRequest = new sql.Request(transaction);
    mergeRequest.input('division', sql.NVarChar(10), division);
    await mergeRequest.query(`
      MERGE ops.comsys_warehouses AS target
      USING ops.comsys_warehouses_staging AS source
      ON (target.store_code = source.store_code AND target.division = @division)
      WHEN MATCHED THEN
        UPDATE SET 
          store_name_ar = source.store_name_ar,
          store_name_en = source.store_name_en,
          is_active     = source.is_active,
          synced_at     = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (store_code, store_name_ar, store_name_en, is_active, division, synced_at)
        VALUES (source.store_code, source.store_name_ar, source.store_name_en, source.is_active, @division, GETDATE());
    `);

    // 6. Clean up staging table by truncating it
    const truncateRequest = new sql.Request(transaction);
    await truncateRequest.query('TRUNCATE TABLE ops.comsys_warehouses_staging;');

    await transaction.commit();
    return warehouses.length;
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في حفظ مستودعات كوم سيس بطريقة Bulk: ${err.message}`);
  }
};

/**
 * Upsert items in ops.comsys_items
 * @param {Array} items - list of items mapped from Comsys
 * @param {'fb'|'gs'} division - F&B or General
 */
const upsertItems = async (items, division) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Truncate staging table
    const request = new sql.Request(transaction);
    await request.query('TRUNCATE TABLE ops.comsys_items_staging;');

    // 2. Prepare bulk insert using sql.Table
    const stagingTable = new sql.Table('ops.comsys_items_staging');
    stagingTable.create = false; // already exists
    stagingTable.columns.add('item_code', sql.NVarChar(50), { nullable: false });
    stagingTable.columns.add('item_name_ar', sql.NVarChar(200), { nullable: false });
    stagingTable.columns.add('item_name_en', sql.NVarChar(200), { nullable: true });
    stagingTable.columns.add('category_code', sql.NVarChar(50), { nullable: true });
    stagingTable.columns.add('unit_code', sql.NVarChar(20), { nullable: true });
    stagingTable.columns.add('unit_name_ar', sql.NVarChar(50), { nullable: true });
    stagingTable.columns.add('is_active', sql.Bit, { nullable: false });

    // 3. Add rows to table
    for (const item of items) {
      if (item.item_code == null || item.item_name_ar == null) continue;
      stagingTable.rows.add(
        item.item_code.trim(),
        item.item_name_ar.trim(),
        item.item_name_en?.trim() || '',
        item.category_code?.trim() || '',
        item.unit_code?.trim() || '',
        item.unit_name_ar?.trim() || '',
        item.is_active ? 1 : 0
      );
    }

    // 4. Execute Bulk copy into staging table using the same transaction request
    await request.bulk(stagingTable);

    // 5. Execute MERGE query joining with target table
    const mergeRequest = new sql.Request(transaction);
    mergeRequest.input('division', sql.NVarChar(10), division);
    await mergeRequest.query(`
      MERGE ops.comsys_items AS target
      USING ops.comsys_items_staging AS source
      ON (target.item_code = source.item_code AND target.division = @division)
      WHEN MATCHED THEN
        UPDATE SET 
          item_name_ar  = source.item_name_ar,
          item_name_en  = source.item_name_en,
          category_code = source.category_code,
          unit_code     = source.unit_code,
          unit_name_ar  = source.unit_name_ar,
          is_active     = source.is_active,
          synced_at     = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (item_code, item_name_ar, item_name_en, category_code, unit_code, unit_name_ar, is_active, division, synced_at)
        VALUES (source.item_code, source.item_name_ar, source.item_name_en, source.category_code, source.unit_code, source.unit_name_ar, source.is_active, @division, GETDATE());
    `);

    // 6. Clean up staging table by truncating it
    const truncateRequest = new sql.Request(transaction);
    await truncateRequest.query('TRUNCATE TABLE ops.comsys_items_staging;');

    await transaction.commit();
    return items.length;
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في حفظ أصناف كوم سيس بطريقة Bulk: ${err.message}`);
  }
};

/**
 * Log sync operations in ops.sync_logs
 */
const createSyncLog = async (syncType, triggeredBy) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('syncType', sql.NVarChar(50), syncType)
      .input('triggeredBy', sql.NVarChar(50), triggeredBy)
      .query(`
        INSERT INTO ops.sync_logs (sync_type, triggered_by, started_at, status)
        OUTPUT INSERTED.sync_id AS syncId
        VALUES (@syncType, @triggeredBy, GETDATE(), 'running')
      `);
    return result.recordset[0].syncId;
  } catch (err) {
    // Log error but don't fail the sync job
    console.error('[SyncLog] Failed to create sync log:', err.message);
    return null;
  }
};

const updateSyncLog = async (syncId, status, recordsSynced, errorMessage = null) => {
  if (!syncId) return;
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('syncId', sql.Int, syncId)
      .input('status', sql.NVarChar(20), status)
      .input('recordsSynced', sql.Int, recordsSynced)
      .input('errorMessage', sql.NVarChar(sql.MAX), errorMessage)
      .query(`
        UPDATE ops.sync_logs
        SET status         = @status,
            records_synced = @recordsSynced,
            completed_at   = GETDATE(),
            error_message  = @errorMessage
        WHERE sync_id = @syncId
      `);
  } catch (err) {
    console.error('[SyncLog] Failed to update sync log:', err.message);
  }
};

/**
 * Upsert stock balances in ops.operational_stock from Comsys average costs/hold data
 * @param {Array} balances - list of balances from Comsys
 * @param {'fb'|'gs'} division
 */
const upsertStockBalances = async (balances, division) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 1. Truncate staging table
    const request = new sql.Request(transaction);
    await request.query('TRUNCATE TABLE ops.comsys_balances_staging;');

    // 2. Prepare bulk insert using sql.Table
    const stagingTable = new sql.Table('ops.comsys_balances_staging');
    stagingTable.create = false; // already exists
    stagingTable.columns.add('store_code', sql.NVarChar(50), { nullable: true });
    stagingTable.columns.add('division', sql.NVarChar(10), { nullable: true });
    stagingTable.columns.add('item_code', sql.NVarChar(50), { nullable: true });
    stagingTable.columns.add('qty', sql.Decimal(18, 4), { nullable: true });

    // 3. Add rows to table
    for (const b of balances) {
      if (b.warehouse_code == null || b.item_code == null) continue;
      stagingTable.rows.add(
        b.warehouse_code.trim(),
        division,
        b.item_code.trim(),
        parseFloat(b.quantity_on_hand || 0)
      );
    }

    // 4. Execute Bulk copy into staging table using the same transaction request
    await request.bulk(stagingTable);

    // 5. Execute MERGE query joining with ops.inventory_nodes
    const mergeRequest = new sql.Request(transaction);
    await mergeRequest.query(`
      MERGE ops.operational_stock AS target
      USING (
        SELECT n.node_id, t.item_code, t.qty
        FROM ops.comsys_balances_staging t
        INNER JOIN ops.inventory_nodes n ON t.store_code = n.comsys_store_code AND t.division = n.division
      ) AS source
      ON (target.node_id = source.node_id AND target.item_code = source.item_code)
      WHEN MATCHED THEN
        UPDATE SET 
          qty_received = source.qty,
          last_updated = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (node_id, item_code, qty_received, last_updated)
        VALUES (source.node_id, source.item_code, source.qty, GETDATE());
    `);

    // 6. Clean up staging table by truncating it
    const truncateRequest = new sql.Request(transaction);
    await truncateRequest.query('TRUNCATE TABLE ops.comsys_balances_staging;');

    await transaction.commit();
    return balances.length;
  } catch (err) {
    await transaction.rollback();
    throw new DatabaseError(`فشل في حفظ أرصدة مخازن كوم سيس بطريقة Bulk: ${err.message}`);
  }
};

module.exports = {
  upsertWarehouses,
  upsertItems,
  upsertStockBalances,
  createSyncLog,
  updateSyncLog,
};
