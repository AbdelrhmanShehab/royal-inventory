'use strict';

const { getZkDB, sql } = require('../../config/zk.database');
const config = require('../../config/index');
const { DatabaseError, AppError } = require('../../utils/errors');

/**
 * ZK Fingerprint Handover Repository
 * Interacts with Zktime database on 192.168.50.6
 */

const checkZkConnection = () => {
  const pool = getZkDB();
  if (!pool) {
    throw new AppError('قاعدة بيانات بصمة الإصبع غير متاحة حالياً، يرجى التحقق من الاتصال بالخادم 192.168.50.6', 503, 'ZK_DB_UNAVAILABLE');
  }
  return pool;
};

const getLatestCheckins = async (limit = 10) => {
  try {
    const pool = checkZkConnection();

    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .input('sensorId', sql.NVarChar(50), config.zkDb.laundrySensorId)
      .input('sn', sql.NVarChar(50), config.zkDb.laundrySn)
      .query(`
        SELECT TOP (@limit)
          u.BADGENUMBER AS userCode,
          c.CHECKTIME AS checkTime,
          c.SENSORID AS sensorId,
          c.sn AS serialNumber,
          COALESCE(u.NAME, N'مستخدم غير معروف') AS employeeName
        FROM CHECKINOUT c
        LEFT JOIN UserInfo u ON c.USERID = u.USERID
        WHERE c.SENSORID = @sensorId OR c.sn = @sn
        ORDER BY c.CHECKTIME DESC
      `);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب آخر عمليات البصمة: ${err.message}`);
  }
};

const getEmployeeDetails = async (userCode) => {
  try {
    const pool = checkZkConnection();

    // 1. Fetch Employee Profile
    const empResult = await pool.request()
      .input('userCode', sql.NVarChar(50), userCode)
      .query(`
        SELECT USERID AS userId, BADGENUMBER AS userCode, NAME AS name
        FROM UserInfo
        WHERE BADGENUMBER = @userCode
      `);
    
    const employee = empResult.recordset[0];
    if (!employee) return null;

    const userId = employee.userId;

    // 2. Fetch Employee Custody / Assigned Items and Handovers/Receives
    const custodyResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          ui.UserItemID AS userItemId,
          ui.ItemID AS itemId,
          i.ItemName AS itemName,
          ui.ItemCode AS itemCode,
          ui.AssignedDate AS assignedDate,
          COALESCE((
            SELECT COUNT(*)
            FROM ItemTransactions t
            WHERE t.UserItemID = ui.UserItemID
              AND t.TransactionType = 'Handover'
          ), 0) AS handedOverQty,
          COALESCE((
            SELECT COUNT(*)
            FROM ItemTransactions t
            WHERE t.UserItemID = ui.UserItemID
              AND t.TransactionType = 'Receive'
          ), 0) AS receivedQty
        FROM UserItems ui
        JOIN items i ON ui.ItemID = i.ItemID
        WHERE ui.UserID = @userId
      `);

    // 3. Fetch Transaction History for this Employee
    const historyResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 20
          t.TransactionID AS txnId,
          ui.ItemCode AS itemCode,
          i.ItemName AS itemName,
          t.TransactionType AS action,
          1 AS quantity,
          t.TransactionDate AS transactionDate,
          t.Notes AS notes
        FROM ItemTransactions t
        JOIN UserItems ui ON t.UserItemID = ui.UserItemID
        JOIN items i ON ui.ItemID = i.ItemID
        WHERE ui.UserID = @userId
        ORDER BY t.TransactionDate DESC
      `);

    return {
      employee: {
        userCode: employee.userCode,
        name: employee.name
      },
      custody: custodyResult.recordset.map(row => ({
        userItemId: row.userItemId,
        itemId: row.itemId,
        itemName: row.itemName,
        itemCode: row.itemCode,
        assignedDate: row.assignedDate,
        handedOverQty: row.handedOverQty,
        receivedQty: row.receivedQty,
        pendingQty: row.handedOverQty - row.receivedQty
      })),
      history: historyResult.recordset
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب تفاصيل عهدة الموظف: ${err.message}`);
  }
};

const createHandoverReceiveTxn = async ({ userCode, itemCode, action, quantity = 1, createdBy, notes = null }) => {
  const transaction = new sql.Transaction(checkZkConnection());
  try {
    await transaction.begin();

    // 1. Find employee
    const empResult = await transaction.request()
      .input('userCode', sql.NVarChar(50), userCode)
      .query(`SELECT USERID FROM UserInfo WHERE BADGENUMBER = @userCode`);
    if (empResult.recordset.length === 0) {
      throw new AppError('الموظف المحدد غير موجود في قاعدة بيانات البصمة', 404, 'EMPLOYEE_NOT_FOUND');
    }
    const userId = empResult.recordset[0].USERID;

    // 2. Find UserItem custody assignment
    const custodyResult = await transaction.request()
      .input('userId', sql.Int, userId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .query(`
        SELECT TOP 1 ui.UserItemID 
        FROM UserItems ui
        JOIN items i ON ui.ItemID = i.ItemID
        WHERE ui.UserID = @userId AND (ui.ItemCode = @itemCode OR i.ItemName = @itemCode)
      `);
    
    if (custodyResult.recordset.length === 0) {
      throw new AppError('هذا الصنف غير مخصص كعهدة لهذا الموظف في نظام البصمة', 404, 'CUSTODY_NOT_ASSIGNED');
    }
    const userItemId = custodyResult.recordset[0].UserItemID;

    // 3. Insert transaction(s) - run a loop to handle quantity > 1 since each transaction row is 1 piece
    let lastTxnId = null;
    for (let i = 0; i < quantity; i++) {
      const result = await transaction.request()
        .input('userItemId', sql.Int, userItemId)
        .input('action', sql.NVarChar(20), action)
        .input('createdBy', sql.NVarChar(100), createdBy)
        .input('notes', sql.NVarChar(500), notes)
        .query(`
          INSERT INTO ItemTransactions (UserItemID, TransactionType, TransactionDate, HandledBy, Notes)
          OUTPUT INSERTED.TransactionID AS txnId
          VALUES (@userItemId, @action, GETDATE(), @createdBy, @notes)
        `);
      lastTxnId = result.recordset[0].txnId;
    }

    await transaction.commit();
    return lastTxnId;
  } catch (err) {
    await transaction.rollback();
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في تسجيل حركة تسليم/استلام العهدة: ${err.message}`);
  }
};

const getDashboardStats = async () => {
  try {
    const pool = checkZkConnection();

    const statsResult = await pool.request().query(`
      SELECT
        COALESCE(SUM(CASE WHEN TransactionType = 'Handover' THEN 1 ELSE 0 END), 0) AS totalHandovers,
        COALESCE(SUM(CASE WHEN TransactionType = 'Receive' THEN 1 ELSE 0 END), 0) AS totalReceives
      FROM ItemTransactions
    `);

    const { totalHandovers, totalReceives } = statsResult.recordset[0];
    const totalPending = totalHandovers - totalReceives;

    return {
      totalHandovers,
      totalReceives,
      totalPending
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب إحصائيات لوحة التحكم: ${err.message}`);
  }
};

const getRecentDashboardTxns = async (limit = 10) => {
  try {
    const pool = checkZkConnection();

    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          t.TransactionID AS txnId,
          u.BADGENUMBER AS userCode,
          COALESCE(u.NAME, N'مستخدم غير معروف') AS employeeName,
          ui.ItemCode AS itemCode,
          i.ItemName AS itemName,
          t.TransactionType AS action,
          1 AS quantity,
          t.TransactionDate AS transactionDate
        FROM ItemTransactions t
        JOIN UserItems ui ON t.UserItemID = ui.UserItemID
        LEFT JOIN UserInfo u ON ui.UserID = u.USERID
        JOIN items i ON ui.ItemID = i.ItemID
        ORDER BY t.TransactionDate DESC
      `);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب أحدث العمليات: ${err.message}`);
  }
};

const getDashboardChartData = async (days = 7) => {
  try {
    const pool = checkZkConnection();

    const result = await pool.request()
      .input('days', sql.Int, days)
      .query(`
        SELECT 
          CAST(TransactionDate AS DATE) AS txnDate,
          TransactionType AS action,
          COUNT(*) AS totalQty
        FROM ItemTransactions
        WHERE TransactionDate >= DATEADD(day, -@days, GETDATE())
        GROUP BY CAST(TransactionDate AS DATE), TransactionType
        ORDER BY txnDate ASC
      `);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب بيانات المخطط البياني: ${err.message}`);
  }
};

const getZkDashboardSummaryToday = async () => {
  try {
    const pool = getZkDB(); // Direct get to handle fallback/unavailability gracefully
    if (!pool) {
      return {
        activeEmployeesToday: 0,
        uniformsHandedOverToday: 0,
        uniformsReceivedToday: 0,
        error: 'قاعدة بيانات البصمة غير متصلة'
      };
    }
    
    // 1. Active employees today (checked in on laundry device)
    const activeEmployeesResult = await pool.request()
      .input('sensorId', sql.NVarChar(50), config.zkDb.laundrySensorId)
      .input('sn', sql.NVarChar(50), config.zkDb.laundrySn)
      .query(`
        SELECT COUNT(DISTINCT USERID) AS activeEmployeesToday
        FROM CHECKINOUT
        WHERE CAST(CHECKTIME AS DATE) = CAST(GETDATE() AS DATE)
          AND (SENSORID = @sensorId OR sn = @sn)
      `);

    // 2. Uniform handovers and receives today
    const uniformStatsResult = await pool.request().query(`
      SELECT 
          COALESCE(SUM(CASE WHEN TransactionType = 'Handover' THEN 1 ELSE 0 END), 0) AS uniformsHandedOverToday,
          COALESCE(SUM(CASE WHEN TransactionType = 'Receive' THEN 1 ELSE 0 END), 0) AS uniformsReceivedToday
      FROM ItemTransactions
      WHERE CAST(TransactionDate AS DATE) = CAST(GETDATE() AS DATE)
    `);

    return {
      activeEmployeesToday: activeEmployeesResult.recordset[0].activeEmployeesToday,
      uniformsHandedOverToday: uniformStatsResult.recordset[0].uniformsHandedOverToday,
      uniformsReceivedToday: uniformStatsResult.recordset[0].uniformsReceivedToday
    };
  } catch (err) {
    return {
      activeEmployeesToday: 0,
      uniformsHandedOverToday: 0,
      uniformsReceivedToday: 0,
      error: err.message
    };
  }
};

module.exports = {
  getLatestCheckins,
  getEmployeeDetails,
  createHandoverReceiveTxn,
  getDashboardStats,
  getRecentDashboardTxns,
  getDashboardChartData,
  getZkDashboardSummaryToday
};
