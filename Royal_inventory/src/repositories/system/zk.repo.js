'use strict';

const { getZkDB, sql } = require('../../config/zk.database');
const config = require('../../config/index');
const { DatabaseError, AppError } = require('../../utils/errors');

/**
 * ZK Fingerprint Handover Repository
 * Interacts with dbo schema tables inside Zktime database on 192.168.50.6
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
          COALESCE(u.NAME, N'مستخدم غير معروف') AS employeeName,
          d.DEPTNAME AS department
        FROM dbo.CHECKINOUT c
        LEFT JOIN dbo.USERINFO u ON c.USERID = u.USERID
        LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
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
        SELECT 
          u.USERID AS userId, 
          u.BADGENUMBER AS userCode, 
          u.NAME AS name, 
          u.TITLE AS title, 
          d.DEPTNAME AS department
        FROM dbo.USERINFO u
        LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
        WHERE u.BADGENUMBER = @userCode
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
          lastTxn.TransactionType AS lastAction,
          COALESCE((
            SELECT COUNT(*)
            FROM dbo.ItemTransactions t
            WHERE t.UserItemID = ui.UserItemID
              AND t.TransactionType = 'Handover'
          ), 0) AS handedOverQty,
          COALESCE((
            SELECT COUNT(*)
            FROM dbo.ItemTransactions t
            WHERE t.UserItemID = ui.UserItemID
              AND t.TransactionType = 'Receive'
          ), 0) AS receivedQty
        FROM dbo.UserItems ui
        JOIN dbo.Items i ON ui.ItemID = i.ItemID
        OUTER APPLY (
          SELECT TOP 1 t.TransactionType
          FROM dbo.ItemTransactions t
          WHERE t.UserItemID = ui.UserItemID
          ORDER BY t.TransactionDate DESC, t.TransactionID DESC
        ) lastTxn
        WHERE ui.UserID = @userId
        ORDER BY ui.UserItemID ASC
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
        FROM dbo.ItemTransactions t
        JOIN dbo.UserItems ui ON t.UserItemID = ui.UserItemID
        JOIN dbo.Items i ON ui.ItemID = i.ItemID
        WHERE ui.UserID = @userId
        ORDER BY t.TransactionDate DESC
      `);

    return {
      employee: {
        userCode: employee.userCode,
        name: employee.name,
        title: employee.title,
        department: employee.department
      },
      custody: custodyResult.recordset.map(row => {
        const isInLaundry = row.lastAction === 'Receive';
        return {
          userItemId: row.userItemId,
          itemId: row.itemId,
          itemName: row.itemName,
          itemCode: row.itemCode,
          assignedDate: row.assignedDate,
          handedOverQty: row.handedOverQty,
          receivedQty: row.receivedQty,
          lastAction: row.lastAction,
          isInLaundry,
          pendingQty: isInLaundry ? 1 : 0
        };
      }),
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
      .query(`SELECT USERID FROM dbo.USERINFO WHERE BADGENUMBER = @userCode`);
    if (empResult.recordset.length === 0) {
      throw new AppError('الموظف المحدد غير موجود في قاعدة بيانات البصمة', 404, 'EMPLOYEE_NOT_FOUND');
    }
    const userId = empResult.recordset[0].USERID;

    // 2. Find UserItem custody assignment (ordered by UserItemID for consistency)
    const custodyResult = await transaction.request()
      .input('userId', sql.Int, userId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .query(`
        SELECT TOP 1 ui.UserItemID 
        FROM dbo.UserItems ui
        JOIN dbo.Items i ON ui.ItemID = i.ItemID
        WHERE ui.UserID = @userId AND (ui.ItemCode = @itemCode OR i.ItemName = @itemCode)
        ORDER BY ui.UserItemID ASC
      `);

    if (custodyResult.recordset.length === 0) {
      throw new AppError('هذا الصنف غير مخصص كعهدة لهذا الموظف في نظام البصمة', 404, 'CUSTODY_NOT_ASSIGNED');
    }
    const userItemId = custodyResult.recordset[0].UserItemID;

    // 3. Guard against duplicate transactions within 30 seconds (prevents double-click / retry issues)
    const dupCheck = await transaction.request()
      .input('dupUserItemId', sql.Int, userItemId)
      .input('dupAction', sql.NVarChar(20), action)
      .query(`
        SELECT TOP 1 TransactionID 
        FROM dbo.ItemTransactions
        WHERE UserItemID = @dupUserItemId
          AND TransactionType = @dupAction
          AND TransactionDate >= DATEADD(second, -30, GETDATE())
      `);
    if (dupCheck.recordset.length > 0) {
      throw new AppError(
        `تم تسجيل نفس العملية (${action}) على هذا الصنف خلال آخر 30 ثانية — منع التكرار تلقائياً`,
        409,
        'DUPLICATE_TRANSACTION'
      );
    }

    // 3. Insert transaction(s)
    let lastTxnId = null;
    for (let i = 0; i < quantity; i++) {
      const result = await transaction.request()
        .input('userItemId', sql.Int, userItemId)
        .input('action', sql.NVarChar(20), action)
        .input('createdBy', sql.NVarChar(100), createdBy)
        .input('notes', sql.NVarChar(500), notes)
        .query(`
          INSERT INTO dbo.ItemTransactions (UserItemID, TransactionType, TransactionDate, HandledBy, Notes)
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
      FROM dbo.ItemTransactions
    `);

    const { totalHandovers, totalReceives } = statsResult.recordset[0];
    const totalPending = Math.max(0, totalReceives - totalHandovers);

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
          t.TransactionDate AS transactionDate,
          t.HandledBy AS handledBy,
          t.Notes AS notes
        FROM dbo.ItemTransactions t
        JOIN dbo.UserItems ui ON t.UserItemID = ui.UserItemID
        LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
        JOIN dbo.Items i ON ui.ItemID = i.ItemID
        ORDER BY t.TransactionDate DESC
      `);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب أحدث العمليات: ${err.message}`);
  }
};

const getTransactionHistory = async ({ limit = 100, action, search } = {}) => {
  try {
    const pool = checkZkConnection();
    let query = `
      SELECT TOP (@limit)
        t.TransactionID AS txnId,
        u.BADGENUMBER AS userCode,
        COALESCE(u.NAME, N'مستخدم غير معروف') AS employeeName,
        ui.ItemCode AS itemCode,
        i.ItemName AS itemName,
        t.TransactionType AS action,
        1 AS quantity,
        t.TransactionDate AS transactionDate,
        t.HandledBy AS handledBy,
        t.Notes AS notes
      FROM dbo.ItemTransactions t
      JOIN dbo.UserItems ui ON t.UserItemID = ui.UserItemID
      LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
      JOIN dbo.Items i ON ui.ItemID = i.ItemID
      WHERE 1=1
    `;
    const request = pool.request().input('limit', sql.Int, limit);
    if (action && action !== 'all') {
      query += ` AND t.TransactionType = @action`;
      request.input('action', sql.NVarChar(20), action);
    }
    if (search && search.trim()) {
      query += ` AND (u.BADGENUMBER LIKE '%' + @search + '%' OR u.NAME LIKE '%' + @search + '%' OR i.ItemName LIKE '%' + @search + '%')`;
      request.input('search', sql.NVarChar(100), search.trim());
    }
    query += ` ORDER BY t.TransactionDate DESC`;
    const result = await request.query(query);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب سجل المعاملات: ${err.message}`);
  }
};

const searchEmployees = async (search = '', limit = 1000) => {
  try {
    const pool = checkZkConnection();
    let query = `
      SELECT TOP (${Number(limit) || 1000}) 
        u.USERID AS userId, 
        u.BADGENUMBER AS userCode, 
        u.NAME AS name, 
        u.TITLE AS title, 
        d.DEPTNAME AS department
      FROM dbo.USERINFO u
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
    `;
    const request = pool.request();
    if (search && search.trim()) {
      query += ` WHERE u.BADGENUMBER LIKE '%' + @search + '%' OR u.NAME LIKE '%' + @search + '%'`;
      request.input('search', sql.NVarChar(100), search.trim());
    }
    query += ` ORDER BY TRY_CAST(u.BADGENUMBER AS INT) ASC, u.BADGENUMBER ASC`;
    const result = await request.query(query);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في البحث عن الموظفين: ${err.message}`);
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
        FROM dbo.ItemTransactions
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
    const pool = getZkDB();
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
        FROM dbo.CHECKINOUT
        WHERE CAST(CHECKTIME AS DATE) = CAST(GETDATE() AS DATE)
          AND (SENSORID = @sensorId OR sn = @sn)
      `);

    // 2. Uniform handovers and receives today
    const uniformStatsResult = await pool.request().query(`
      SELECT 
          COALESCE(SUM(CASE WHEN TransactionType = 'Handover' THEN 1 ELSE 0 END), 0) AS uniformsHandedOverToday,
          COALESCE(SUM(CASE WHEN TransactionType = 'Receive' THEN 1 ELSE 0 END), 0) AS uniformsReceivedToday
      FROM dbo.ItemTransactions
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

// Get all available uniform items
const getAllItems = async () => {
  try {
    const pool = checkZkConnection();
    const result = await pool.request().query(`
      SELECT ItemID AS itemId, ItemName AS itemName, ItemDescription AS itemDescription
      FROM dbo.Items
      WHERE IsActive = 1
      ORDER BY ItemName
    `);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب قائمة الأصناف: ${err.message}`);
  }
};

// Get all items currently in the laundry (where the latest transaction is 'Receive')
const getInLaundryInventory = async (filters = {}) => {
  try {
    const pool = checkZkConnection();
    let query = `
      SELECT 
        ui.UserItemID AS userItemId,
        ui.ItemCode AS itemCode,
        i.ItemName AS itemName,
        u.BADGENUMBER AS userCode,
        u.NAME AS employeeName,
        u.TITLE AS jobTitle,
        COALESCE(d.DEPTNAME, N'غير محدد') AS department,
        lastTxn.TransactionID AS txnId,
        lastTxn.TransactionType AS lastAction,
        lastTxn.TransactionDate AS receivedDate,
        lastTxn.HandledBy AS handledBy,
        lastTxn.Notes AS notes,
        DATEDIFF(HOUR, lastTxn.TransactionDate, GETDATE()) AS hoursInLaundry,
        DATEDIFF(DAY, lastTxn.TransactionDate, GETDATE()) AS daysInLaundry
      FROM dbo.UserItems ui
      INNER JOIN dbo.Items i ON ui.ItemID = i.ItemID
      INNER JOIN dbo.USERINFO u ON ui.UserID = u.USERID
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      CROSS APPLY (
        SELECT TOP 1 t.TransactionID, t.TransactionType, t.TransactionDate, t.HandledBy, t.Notes
        FROM dbo.ItemTransactions t
        WHERE t.UserItemID = ui.UserItemID
        ORDER BY t.TransactionDate DESC, t.TransactionID DESC
      ) lastTxn
      WHERE lastTxn.TransactionType = 'Receive'
    `;

    const request = pool.request();

    if (filters.department) {
      query += ` AND d.DEPTNAME = @department`;
      request.input('department', sql.NVarChar(100), filters.department);
    }

    if (filters.itemName) {
      query += ` AND i.ItemName = @itemName`;
      request.input('itemName', sql.NVarChar(100), filters.itemName);
    }

    if (filters.search) {
      query += ` AND (u.BADGENUMBER LIKE @search OR u.NAME LIKE @search OR ui.ItemCode LIKE @search OR i.ItemName LIKE @search)`;
      request.input('search', sql.NVarChar(100), `%${filters.search}%`);
    }

    query += ` ORDER BY lastTxn.TransactionDate DESC`;

    const result = await request.query(query);
    const items = result.recordset;

    // Aggregations
    const itemBreakdown = {};
    const departmentBreakdown = {};
    const employeesSet = new Set();
    let delayedOver24h = 0;
    let delayedOver48h = 0;
    let receivedToday = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    items.forEach(row => {
      employeesSet.add(row.userCode);
      itemBreakdown[row.itemName] = (itemBreakdown[row.itemName] || 0) + 1;
      departmentBreakdown[row.department] = (departmentBreakdown[row.department] || 0) + 1;

      if (row.hoursInLaundry >= 48) delayedOver48h++;
      if (row.hoursInLaundry >= 24) delayedOver24h++;

      const rDateStr = row.receivedDate ? new Date(row.receivedDate).toISOString().split('T')[0] : '';
      if (rDateStr === todayStr) receivedToday++;
    });

    const byItem = Object.entries(itemBreakdown)
      .map(([name, count]) => ({
        name,
        count,
        percentage: items.length > 0 ? Number(((count / items.length) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const byDepartment = Object.entries(departmentBreakdown)
      .map(([name, count]) => ({
        name,
        count,
        percentage: items.length > 0 ? Number(((count / items.length) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      summary: {
        totalItems: items.length,
        totalEmployees: employeesSet.size,
        receivedToday,
        delayedOver24h,
        delayedOver48h
      },
      byItem,
      byDepartment,
      items
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب تقرير موجودات المغسلة: ${err.message}`);
  }
};

module.exports = {
  getLatestCheckins,
  getEmployeeDetails,
  createHandoverReceiveTxn,
  getDashboardStats,
  getRecentDashboardTxns,
  getDashboardChartData,
  getTransactionHistory,
  searchEmployees,
  getZkDashboardSummaryToday,
  getAllItems,
  getInLaundryInventory
};
