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

const getLatestCheckins = async (options = 10) => {
  try {
    const pool = checkZkConnection();
    const opts = typeof options === 'number' ? { limit: options } : (options || {});
    const { limit = 100, page, pageSize, fromDate, toDate, search } = opts;

    let whereClause = 'WHERE (c.SENSORID = @sensorId OR c.sn = @sn)';
    const countReq = pool.request()
      .input('sensorId', sql.NVarChar(50), config.zkDb.laundrySensorId)
      .input('sn', sql.NVarChar(50), config.zkDb.laundrySn);

    const dataReq = pool.request()
      .input('sensorId', sql.NVarChar(50), config.zkDb.laundrySensorId)
      .input('sn', sql.NVarChar(50), config.zkDb.laundrySn);

    if (fromDate) {
      whereClause += ' AND c.CHECKTIME >= @fromDate';
      countReq.input('fromDate', sql.DateTime, new Date(fromDate));
      dataReq.input('fromDate', sql.DateTime, new Date(fromDate));
    }

    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === 'string' && toDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
      whereClause += ' AND c.CHECKTIME <= @toDate';
      countReq.input('toDate', sql.DateTime, end);
      dataReq.input('toDate', sql.DateTime, end);
    }

    if (search && search.trim()) {
      whereClause += ` AND (u.BADGENUMBER LIKE '%' + @search + '%' OR u.NAME LIKE '%' + @search + '%' OR d.DEPTNAME LIKE '%' + @search + '%')`;
      countReq.input('search', sql.NVarChar(100), search.trim());
      dataReq.input('search', sql.NVarChar(100), search.trim());
    }

    // 1. Calculate overall stats across all matching records
    const statsResult = await countReq.query(`
      SELECT 
        COUNT(1) AS total,
        COUNT(DISTINCT c.USERID) AS uniqueUsers,
        COUNT(CASE WHEN CAST(c.CHECKTIME AS DATE) = CAST(GETDATE() AS DATE) THEN 1 END) AS todayCount
      FROM dbo.CHECKINOUT c
      LEFT JOIN dbo.USERINFO u ON c.USERID = u.USERID
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      ${whereClause}
    `);

    const total = statsResult.recordset[0]?.total || 0;
    const uniqueUsers = statsResult.recordset[0]?.uniqueUsers || 0;
    const todayCount = statsResult.recordset[0]?.todayCount || 0;

    // 2. Paginated rows
    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(500, Math.max(1, parseInt(pageSize || limit, 10) || 50));
    const offset = (p - 1) * size;

    dataReq.input('offset', sql.Int, offset);
    dataReq.input('pageSize', sql.Int, size);

    const dataResult = await dataReq.query(`
      SELECT 
        c.USERID AS userId,
        u.BADGENUMBER AS userCode,
        c.CHECKTIME AS checkTime,
        c.SENSORID AS sensorId,
        c.sn AS serialNumber,
        COALESCE(u.NAME, N'مستخدم غير معروف') AS employeeName,
        d.DEPTNAME AS department
      FROM dbo.CHECKINOUT c
      LEFT JOIN dbo.USERINFO u ON c.USERID = u.USERID
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      ${whereClause}
      ORDER BY c.CHECKTIME DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

    // If caller requested pagination or filtering, return structured object
    if (page !== undefined || pageSize !== undefined || fromDate || toDate || search) {
      return {
        items: dataResult.recordset || [],
        stats: {
          total,
          uniqueUsers,
          todayCount,
        },
        pagination: {
          page: p,
          pageSize: size,
          total,
          totalPages: Math.ceil(total / size) || 1,
          hasNextPage: p * size < total,
          hasPrevPage: p > 1,
        },
      };
    }

    // Default backward compatibility for simple callers like getLatestCheckins(8)
    return dataResult.recordset || [];
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب آخر عمليات البصمة: ${err.message}`);
  }
};

const getEmployeeDetails = async (employeeUserId) => {
  try {
    const pool = checkZkConnection();

    // 1. Fetch Employee Profile
    const empResult = await pool.request()
      .input('employeeUserId', sql.Int, employeeUserId)
      .query(`
        SELECT 
          u.USERID AS userId, 
          u.BADGENUMBER AS userCode, 
          u.NAME AS name, 
          u.TITLE AS title, 
          d.DEPTNAME AS department
        FROM dbo.USERINFO u
        LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
        WHERE u.USERID = @employeeUserId
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
        userId: employee.userId,
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

const createHandoverReceiveTxn = async ({ userId: employeeUserId, itemCode, action, quantity = 1, createdBy, notes = null }) => {
  const transaction = new sql.Transaction(checkZkConnection());
  try {
    await transaction.begin();

    // 1. Find employee
    const empResult = await transaction.request()
      .input('employeeUserId', sql.Int, employeeUserId)
      .query(`SELECT USERID FROM dbo.USERINFO WHERE USERID = @employeeUserId`);
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

const getDashboardStats = async (filters = {}) => {
  try {
    const pool = checkZkConnection();
    const { fromDate, toDate } = filters;

    let whereClause = 'WHERE 1=1';
    const request = pool.request();

    if (fromDate) {
      whereClause += ' AND TransactionDate >= @fromDate';
      request.input('fromDate', sql.DateTime, new Date(fromDate));
    }
    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === 'string' && toDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
      whereClause += ' AND TransactionDate <= @toDate';
      request.input('toDate', sql.DateTime, end);
    }

    const statsResult = await request.query(`
      SELECT
        COALESCE(SUM(CASE WHEN TransactionType = 'Handover' THEN 1 ELSE 0 END), 0) AS totalHandovers,
        COALESCE(SUM(CASE WHEN TransactionType = 'Receive' THEN 1 ELSE 0 END), 0) AS totalReceives
      FROM dbo.ItemTransactions
      ${whereClause}
    `);

    // Live inventory status: exactly matching the custody transfer page
    let inLaundryCount = 0;
    let withStaffCount = 0;
    let totalCodedItems = 0;
    try {
      const liveInventoryRes = await pool.request().query(`
        SELECT 
          COUNT(1) AS totalCodedItems,
          COUNT(CASE WHEN lastTxn.TransactionType = 'Receive' THEN 1 END) AS inLaundryCount,
          COUNT(CASE WHEN lastTxn.TransactionType = 'Handover' OR lastTxn.TransactionType IS NULL THEN 1 END) AS withStaffCount
        FROM dbo.UserItems ui
        OUTER APPLY (
          SELECT TOP 1 TransactionType
          FROM dbo.ItemTransactions t
          WHERE t.UserItemID = ui.UserItemID
          ORDER BY t.TransactionDate DESC, t.TransactionID DESC
        ) lastTxn
        WHERE ui.UserID IS NOT NULL
      `);
      if (liveInventoryRes.recordset[0]) {
        totalCodedItems = liveInventoryRes.recordset[0].totalCodedItems || 0;
        inLaundryCount = liveInventoryRes.recordset[0].inLaundryCount || 0;
        withStaffCount = liveInventoryRes.recordset[0].withStaffCount || 0;
      }
    } catch (_) {}

    const { totalHandovers, totalReceives } = statsResult.recordset[0];
    const totalPending = Math.max(0, totalHandovers - totalReceives);

    return {
      totalHandovers,
      totalReceives,
      totalPending,
      inLaundryCount,
      withStaffCount,
      totalCodedItems
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب إحصائيات لوحة التحكم: ${err.message}`);
  }
};

const getRecentDashboardTxns = async (limit = 10, filters = {}) => {
  try {
    const pool = checkZkConnection();
    const { fromDate, toDate } = filters;

    let whereClause = 'WHERE 1=1';
    const request = pool.request().input('limit', sql.Int, limit);

    if (fromDate) {
      whereClause += ' AND t.TransactionDate >= @fromDate';
      request.input('fromDate', sql.DateTime, new Date(fromDate));
    }
    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === 'string' && toDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
      whereClause += ' AND t.TransactionDate <= @toDate';
      request.input('toDate', sql.DateTime, end);
    }

    const result = await request.query(`
      SELECT TOP (@limit)
        t.TransactionID AS txnId,
        ui.UserID AS userId,
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
      ${whereClause}
      ORDER BY t.TransactionDate DESC
    `);
    return result.recordset;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب أحدث العمليات: ${err.message}`);
  }
};

const getTransactionHistory = async ({ page = 1, pageSize = 50, limit, action, search, fromDate, toDate } = {}) => {
  try {
    const pool = checkZkConnection();
    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(500, Math.max(5, parseInt(pageSize || limit, 10) || 50));
    const offset = (p - 1) * size;

    let whereClause = 'WHERE 1=1';
    const countReq = pool.request();
    const dataReq = pool.request();

    if (action && action !== 'all') {
      whereClause += ' AND t.TransactionType = @action';
      countReq.input('action', sql.NVarChar(20), action);
      dataReq.input('action', sql.NVarChar(20), action);
    }

    if (fromDate) {
      whereClause += ' AND t.TransactionDate >= @fromDate';
      countReq.input('fromDate', sql.DateTime, new Date(fromDate));
      dataReq.input('fromDate', sql.DateTime, new Date(fromDate));
    }

    if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === 'string' && toDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
      whereClause += ' AND t.TransactionDate <= @toDate';
      countReq.input('toDate', sql.DateTime, end);
      dataReq.input('toDate', sql.DateTime, end);
    }

    if (search && search.trim()) {
      whereClause += ` AND (u.BADGENUMBER LIKE '%' + @search + '%' OR u.NAME LIKE '%' + @search + '%' OR i.ItemName LIKE '%' + @search + '%' OR ui.ItemCode LIKE '%' + @search + '%')`;
      countReq.input('search', sql.NVarChar(100), search.trim());
      dataReq.input('search', sql.NVarChar(100), search.trim());
    }

    // 1. Calculate 100% accurate overall stats across ALL matching database records
    const statsResult = await countReq.query(`
      SELECT 
        COUNT(1) AS total,
        COUNT(CASE WHEN t.TransactionType = 'Handover' THEN 1 END) AS totalHandover,
        COUNT(CASE WHEN t.TransactionType = 'Receive' THEN 1 END) AS totalReceive
      FROM dbo.ItemTransactions t
      JOIN dbo.UserItems ui ON t.UserItemID = ui.UserItemID
      LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
      JOIN dbo.Items i ON ui.ItemID = i.ItemID
      ${whereClause}
    `);

    const total = statsResult.recordset[0]?.total || 0;
    const totalHandover = statsResult.recordset[0]?.totalHandover || 0;
    const totalReceive = statsResult.recordset[0]?.totalReceive || 0;
    const totalPending = Math.max(0, totalHandover - totalReceive);

    // 2. Paginated rows for the table
    dataReq.input('offset', sql.Int, offset);
    dataReq.input('pageSize', sql.Int, size);

    const dataResult = await dataReq.query(`
      SELECT 
        t.TransactionID AS txnId,
        ui.UserID AS userId,
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
      ${whereClause}
      ORDER BY t.TransactionDate DESC, t.TransactionID DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

    return {
      items: dataResult.recordset || [],
      stats: {
        total,
        totalHandover,
        totalReceive,
        totalPending
      },
      pagination: {
        page: p,
        pageSize: size,
        total,
        totalPages: Math.ceil(total / size) || 1,
        hasNextPage: p * size < total,
        hasPrevPage: p > 1
      }
    };
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

const getDashboardChartData = async (options = 7) => {
  try {
    const pool = checkZkConnection();
    const opts = typeof options === 'number' ? { days: options } : (options || {});
    const { days = 7, fromDate, toDate } = opts;

    let whereClause = 'WHERE 1=1';
    const request = pool.request();

    if (fromDate && toDate) {
      whereClause += ' AND TransactionDate >= @fromDate AND TransactionDate <= @toDate';
      request.input('fromDate', sql.DateTime, new Date(fromDate));
      const end = new Date(toDate);
      if (typeof toDate === 'string' && toDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
      request.input('toDate', sql.DateTime, end);
    } else if (fromDate) {
      whereClause += ' AND TransactionDate >= @fromDate';
      request.input('fromDate', sql.DateTime, new Date(fromDate));
    } else if (toDate) {
      const end = new Date(toDate);
      if (typeof toDate === 'string' && toDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }
      whereClause += ' AND TransactionDate <= @toDate';
      request.input('toDate', sql.DateTime, end);
    } else {
      whereClause += ' AND TransactionDate >= DATEADD(day, -@days, GETDATE())';
      request.input('days', sql.Int, days);
    }

    const result = await request.query(`
      SELECT 
        CAST(TransactionDate AS DATE) AS txnDate,
        TransactionType AS action,
        COUNT(*) AS totalQty
      FROM dbo.ItemTransactions
      ${whereClause}
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
        ui.UserID AS userId,
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
      employeesSet.add(row.userId);
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

let zkIndexesChecked = false;
const ensureZkIndexes = async (pool = null) => {
  if (zkIndexesChecked) return;
  try {
    const db = pool || checkZkConnection();
    await db.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.ItemTransactions') AND name = 'ix_ItemTransactions_UserItem_Date')
      BEGIN
          CREATE NONCLUSTERED INDEX ix_ItemTransactions_UserItem_Date 
              ON dbo.ItemTransactions (UserItemID, TransactionDate DESC, TransactionID DESC) 
              INCLUDE (TransactionType, HandledBy);
      END;
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.UserItems') AND name = 'ix_UserItems_ItemCode')
      BEGIN
          CREATE NONCLUSTERED INDEX ix_UserItems_ItemCode 
              ON dbo.UserItems (ItemCode) 
              INCLUDE (UserID, ItemID, AssignedDate);
      END;
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.UserItems') AND name = 'ix_UserItems_UserID')
      BEGIN
          CREATE NONCLUSTERED INDEX ix_UserItems_UserID 
              ON dbo.UserItems (UserID) 
              INCLUDE (ItemID, ItemCode, AssignedDate);
      END;
    `);
    zkIndexesChecked = true;
  } catch (err) {
    // Non-fatal warning if user lacks DDL permission or DB is read-only
    console.warn(`[ZkDB] Auto-indexing check notice: ${err.message}`);
  }
};

// Get all custody items across all employees with server-side pagination
const getAllCustodyItems = async ({ search = '', department = '', itemName = '', assignmentStatus = 'all', laundryStatus = 'all', page = 1, pageSize = 20, limit } = {}) => {
  try {
    const pool = checkZkConnection();
    ensureZkIndexes(pool).catch(() => {});

    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(pageSize || limit, 10) || 20));
    const offset = (p - 1) * size;

    let whereClause = 'WHERE 1=1';
    const countReq = pool.request();
    const dataReq = pool.request();

    if (assignmentStatus === 'assigned') {
      whereClause += ' AND ui.UserID IS NOT NULL';
    } else if (assignmentStatus === 'unassigned') {
      whereClause += ' AND ui.UserID IS NULL';
    }

    if (department && department.trim() && department !== 'all') {
      whereClause += ' AND d.DEPTNAME = @department';
      countReq.input('department', sql.NVarChar(100), department.trim());
      dataReq.input('department', sql.NVarChar(100), department.trim());
    }
    if (itemName && itemName.trim() && itemName !== 'all') {
      whereClause += ' AND i.ItemName = @itemName';
      countReq.input('itemName', sql.NVarChar(100), itemName.trim());
      dataReq.input('itemName', sql.NVarChar(100), itemName.trim());
    }
    if (search && search.trim()) {
      whereClause += " AND (ui.ItemCode LIKE '%' + @search + '%' OR i.ItemName LIKE '%' + @search + '%' OR u.BADGENUMBER LIKE '%' + @search + '%' OR u.NAME LIKE '%' + @search + '%')";
      countReq.input('search', sql.NVarChar(100), search.trim());
      dataReq.input('search', sql.NVarChar(100), search.trim());
    }

    let laundryJoin = '';
    if (laundryStatus === 'in_laundry') {
      laundryJoin = `
        CROSS APPLY (
          SELECT TOP 1 t.TransactionType, t.TransactionDate
          FROM dbo.ItemTransactions t
          WHERE t.UserItemID = ui.UserItemID
          ORDER BY t.TransactionDate DESC, t.TransactionID DESC
        ) lastTxn
      `;
      whereClause += " AND lastTxn.TransactionType = 'Receive'";
    } else if (laundryStatus === 'with_staff') {
      laundryJoin = `
        OUTER APPLY (
          SELECT TOP 1 t.TransactionType, t.TransactionDate
          FROM dbo.ItemTransactions t
          WHERE t.UserItemID = ui.UserItemID
          ORDER BY t.TransactionDate DESC, t.TransactionID DESC
        ) lastTxn
      `;
      whereClause += " AND (lastTxn.TransactionType IS NULL OR lastTxn.TransactionType <> 'Receive')";
    } else {
      laundryJoin = `
        OUTER APPLY (
          SELECT TOP 1 t.TransactionType, t.TransactionDate
          FROM dbo.ItemTransactions t
          WHERE t.UserItemID = ui.UserItemID
          ORDER BY t.TransactionDate DESC, t.TransactionID DESC
        ) lastTxn
      `;
    }

    // 1. Fast Total Count
    const countResult = await countReq.query(`
      SELECT COUNT(1) AS total
      FROM dbo.UserItems ui
      INNER JOIN dbo.Items i ON ui.ItemID = i.ItemID
      LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      ${laundryJoin}
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.total ?? countResult.recordset?.length ?? 0;

    // 2. Paginated Data Query
    dataReq.input('offset', sql.Int, offset);
    dataReq.input('pageSize', sql.Int, size);

    const dataResult = await dataReq.query(`
      SELECT 
        ui.UserItemID AS userItemId,
        ui.ItemID AS itemId,
        i.ItemName AS itemName,
        ui.ItemCode AS itemCode,
        ui.AssignedDate AS assignedDate,
        ui.UserID AS userId,
        CASE WHEN ui.UserID IS NOT NULL THEN 1 ELSE 0 END AS isAssigned,
        u.BADGENUMBER AS userCode,
        COALESCE(u.NAME, N'غير مخصص (بالمخزن)') AS employeeName,
        u.TITLE AS jobTitle,
        COALESCE(d.DEPTNAME, N'غير محدد') AS department,
        lastTxn.TransactionType AS lastAction,
        lastTxn.TransactionDate AS lastTxnDate,
        CASE WHEN lastTxn.TransactionType = 'Receive' THEN 1 ELSE 0 END AS isInLaundry
      FROM dbo.UserItems ui
      INNER JOIN dbo.Items i ON ui.ItemID = i.ItemID
      LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      ${laundryJoin}
      ${whereClause}
      ORDER BY ui.AssignedDate DESC, ui.UserItemID DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

    return {
      items: dataResult.recordset || [],
      pagination: {
        page: p,
        pageSize: size,
        total: typeof total === 'number' ? total : 0,
        totalPages: Math.ceil((typeof total === 'number' ? total : 0) / size) || 1,
        hasNextPage: p * size < total,
        hasPrevPage: p > 1,
      }
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب قائمة أصناف العهد: ${err.message}`);
  }
};

const getCustodyStats = async () => {
  try {
    const pool = checkZkConnection();
    const result = await pool.request().query(`
      SELECT 
        COUNT(1) AS totalItems,
        COUNT(CASE WHEN UserID IS NOT NULL THEN 1 END) AS assignedItems,
        COUNT(CASE WHEN UserID IS NULL THEN 1 END) AS unassignedItems,
        COUNT(DISTINCT UserID) AS totalEmployeesWithCustody
      FROM dbo.UserItems
    `);
    
    // Quick count of items currently in laundry (last transaction is Receive)
    let inLaundryCount = 0;
    try {
      const inLaundryResult = await pool.request().query(`
        SELECT COUNT(1) AS inLaundryCount
        FROM dbo.UserItems ui
        CROSS APPLY (
          SELECT TOP 1 TransactionType
          FROM dbo.ItemTransactions t
          WHERE t.UserItemID = ui.UserItemID
          ORDER BY t.TransactionDate DESC, t.TransactionID DESC
        ) lastTxn
        WHERE lastTxn.TransactionType = 'Receive'
      `);
      inLaundryCount = inLaundryResult.recordset[0]?.inLaundryCount || 0;
    } catch (_) {
      inLaundryCount = 0;
    }

    const totalItems = result.recordset[0]?.totalItems || 0;
    const assignedItems = result.recordset[0]?.assignedItems || 0;
    const unassignedItems = result.recordset[0]?.unassignedItems || 0;

    return {
      totalItems,
      assignedItems,
      unassignedItems,
      totalEmployeesWithCustody: result.recordset[0]?.totalEmployeesWithCustody || 0,
      inLaundryCount,
      withStaffCount: Math.max(0, assignedItems - inLaundryCount),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب إحصائيات العهد: ${err.message}`);
  }
};

const getItemDefinitions = async () => {
  try {
    const pool = checkZkConnection();
    const result = await pool.request().query(`
      SELECT ItemID AS itemId, ItemName AS itemName
      FROM dbo.Items
      ORDER BY ItemID ASC
    `);
    return result.recordset || [];
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب تعريفات أصناف العهد: ${err.message}`);
  }
};

const getDepartmentsList = async () => {
  try {
    const pool = checkZkConnection();
    const result = await pool.request().query(`
      SELECT DISTINCT DEPTNAME AS department
      FROM dbo.DEPARTMENTS
      WHERE DEPTNAME IS NOT NULL AND RTRIM(LTRIM(DEPTNAME)) <> ''
      ORDER BY DEPTNAME ASC
    `);
    return result.recordset.map(r => r.department);
  } catch (err) {
    return [];
  }
};

const getCustodyItemByCode = async (itemCode) => {
  try {
    const pool = checkZkConnection();
    const result = await pool.request()
      .input('itemCode', sql.NVarChar(50), itemCode)
      .query(`
        SELECT TOP 1
          ui.UserItemID AS userItemId,
          ui.ItemID AS itemId,
          i.ItemName AS itemName,
          ui.ItemCode AS itemCode,
          ui.AssignedDate AS assignedDate,
          ui.UserID AS userId,
          CASE WHEN ui.UserID IS NOT NULL THEN 1 ELSE 0 END AS isAssigned,
          u.BADGENUMBER AS userCode,
          COALESCE(u.NAME, N'غير مخصص (بالمخزن)') AS employeeName,
          u.TITLE AS jobTitle,
          COALESCE(d.DEPTNAME, N'غير محدد') AS department,
          lastTxn.TransactionType AS lastAction,
          lastTxn.TransactionDate AS lastTxnDate,
          CASE WHEN lastTxn.TransactionType = 'Receive' THEN 1 ELSE 0 END AS isInLaundry
        FROM dbo.UserItems ui
        INNER JOIN dbo.Items i ON ui.ItemID = i.ItemID
        LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
        LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
        OUTER APPLY (
          SELECT TOP 1 t.TransactionType, t.TransactionDate
          FROM dbo.ItemTransactions t
          WHERE t.UserItemID = ui.UserItemID
          ORDER BY t.TransactionDate DESC, t.TransactionID DESC
        ) lastTxn
        WHERE ui.ItemCode = @itemCode
      `);
    return result.recordset[0] || null;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في جلب تفاصيل صنف العهدة: ${err.message}`);
  }
};

const createCustodyItem = async ({ itemCode, itemId, userId = null, notes = null, handledBy = 'System' }) => {
  const trimmedCode = (itemCode || '').trim();
  if (!trimmedCode) {
    throw new AppError('كود العهدة مطلوب', 400, 'ITEM_CODE_REQUIRED');
  }
  const pool = checkZkConnection();

  // Check duplicate
  const dupCheck = await pool.request()
    .input('itemCode', sql.NVarChar(50), trimmedCode)
    .query(`SELECT TOP 1 UserItemID FROM dbo.UserItems WHERE ItemCode = @itemCode`);
  if (dupCheck.recordset.length > 0) {
    throw new AppError(`كود العهدة [${trimmedCode}] مسجل بالفعل في النظام مسبقاً`, 409, 'DUPLICATE_ITEM_CODE');
  }

  // Verify Item exists
  const itemCheck = await pool.request()
    .input('itemId', sql.Int, itemId)
    .query(`SELECT TOP 1 ItemID, ItemName FROM dbo.Items WHERE ItemID = @itemId`);
  if (itemCheck.recordset.length === 0) {
    throw new AppError('نوع العهدة المحدد غير موجود', 404, 'ITEM_TYPE_NOT_FOUND');
  }
  const itemDef = itemCheck.recordset[0];

  // If userId provided, verify employee
  let employee = null;
  if (userId) {
    const empCheck = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT u.USERID, u.BADGENUMBER, u.NAME, d.DEPTNAME
        FROM dbo.USERINFO u
        LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
        WHERE u.USERID = @userId
      `);
    if (empCheck.recordset.length === 0) {
      throw new AppError('الموظف المحدد غير موجود في قاعدة بيانات البصمة', 404, 'EMPLOYEE_NOT_FOUND');
    }
    employee = empCheck.recordset[0];
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const defaultNote = userId
      ? `Assigned by admin via form on ${new Date().toLocaleString('en-GB')} - [${employee.NAME || employee.BADGENUMBER}]`
      : `New unassigned stock item on ${new Date().toLocaleString('en-GB')}`;
    const finalNote = notes ? `${defaultNote} - ${notes}` : defaultNote;

    const insertItemResult = await transaction.request()
      .input('userId', sql.Int, userId || null)
      .input('itemId', sql.Int, itemId)
      .input('itemCode', sql.VarChar(50), trimmedCode)
      .input('notes', sql.VarChar(255), finalNote.substring(0, 255))
      .query(`
        INSERT INTO dbo.UserItems (UserID, ItemID, ItemCode, AssignedDate, IsHandovered, IsReceived, Notes)
        OUTPUT INSERTED.UserItemID
        VALUES (@userId, @itemId, @itemCode, GETDATE(), 0, 0, @notes)
      `);
    const userItemId = insertItemResult.recordset[0]?.UserItemID;

    await transaction.commit();

    return {
      userItemId,
      itemCode: trimmedCode,
      itemId: itemDef.ItemID,
      itemName: itemDef.ItemName,
      userId: employee ? employee.USERID : null,
      isAssigned: !!employee,
      employeeName: employee ? employee.NAME : 'غير مخصص (بالمخزن)',
      badgeNumber: employee ? employee.BADGENUMBER : null,
      department: employee ? employee.DEPTNAME : null,
      assignedDate: new Date().toISOString(),
    };
  } catch (err) {
    await transaction.rollback();
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في تكويد وحفظ العهدة الجديدة: ${err.message}`);
  }
};

const unassignCustodyItem = async ({ itemCode, reason = null, handledBy = 'System' }) => {
  const trimmedCode = (itemCode || '').trim();
  const pool = checkZkConnection();

  // 1. Fetch item and current employee
  const itemResult = await pool.request()
    .input('itemCode', sql.NVarChar(50), trimmedCode)
    .query(`
      SELECT TOP 1
        ui.UserItemID,
        ui.ItemID,
        i.ItemName,
        ui.ItemCode,
        ui.UserID,
        u.BADGENUMBER,
        u.NAME,
        d.DEPTNAME
      FROM dbo.UserItems ui
      JOIN dbo.Items i ON ui.ItemID = i.ItemID
      LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      WHERE ui.ItemCode = @itemCode
    `);

  if (itemResult.recordset.length === 0) {
    throw new AppError(`الصنف ذو الكود [${trimmedCode}] غير موجود`, 404, 'ITEM_NOT_FOUND');
  }
  const item = itemResult.recordset[0];

  if (!item.UserID) {
    throw new AppError('هذا الصنف حر بالفعل في المخزن وغير مخصص لأي موظف', 400, 'ALREADY_UNASSIGNED');
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const note = `Unassigned from [${item.NAME || item.BADGENUMBER}] by ${handledBy}${reason ? ' - ' + reason : ''}`;

    // Update UserItems: set UserID = NULL
    await transaction.request()
      .input('userItemId', sql.Int, item.UserItemID)
      .input('notes', sql.VarChar(255), note.substring(0, 255))
      .query(`
        UPDATE dbo.UserItems
        SET UserID = NULL, AssignedDate = GETDATE(), Notes = @notes
        WHERE UserItemID = @userItemId
      `);

    await transaction.commit();

    return {
      userItemId: item.UserItemID,
      itemCode: item.ItemCode,
      itemName: item.ItemName,
      previousEmployee: {
        userId: item.UserID,
        name: item.NAME,
        badge: item.BADGENUMBER,
        department: item.DEPTNAME,
      },
      reason,
      unassignedAt: new Date().toISOString(),
    };
  } catch (err) {
    await transaction.rollback();
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في فك تخصيص العهدة: ${err.message}`);
  }
};

const assignCustodyItem = async ({ itemCode, toUserId, notes = null, handledBy = 'System' }) => {
  const trimmedCode = (itemCode || '').trim();
  const pool = checkZkConnection();

  // 1. Fetch item
  const itemResult = await pool.request()
    .input('itemCode', sql.NVarChar(50), trimmedCode)
    .query(`
      SELECT TOP 1
        ui.UserItemID,
        ui.ItemID,
        i.ItemName,
        ui.ItemCode,
        ui.UserID,
        u.BADGENUMBER,
        u.NAME,
        d.DEPTNAME
      FROM dbo.UserItems ui
      JOIN dbo.Items i ON ui.ItemID = i.ItemID
      LEFT JOIN dbo.USERINFO u ON ui.UserID = u.USERID
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      WHERE ui.ItemCode = @itemCode
    `);

  if (itemResult.recordset.length === 0) {
    throw new AppError(`الصنف ذو الكود [${trimmedCode}] غير موجود`, 404, 'ITEM_NOT_FOUND');
  }
  const item = itemResult.recordset[0];

  // 2. Fetch new employee
  const toEmpResult = await pool.request()
    .input('toUserId', sql.Int, toUserId)
    .query(`
      SELECT u.USERID, u.BADGENUMBER, u.NAME, d.DEPTNAME
      FROM dbo.USERINFO u
      LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
      WHERE u.USERID = @toUserId
    `);
  if (toEmpResult.recordset.length === 0) {
    throw new AppError('الموظف المستلم غير موجود في قاعدة بيانات البصمة', 404, 'EMPLOYEE_NOT_FOUND');
  }
  const toEmp = toEmpResult.recordset[0];

  if (item.UserID === toEmp.USERID) {
    throw new AppError('هذا الصنف مخصص بالفعل لهذا الموظف', 400, 'SAME_EMPLOYEE');
  }

  const previousEmployee = item.UserID ? {
    userId: item.UserID,
    name: item.NAME,
    badge: item.BADGENUMBER,
    department: item.DEPTNAME,
  } : null;

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const note = previousEmployee
      ? `Reassigned from [${previousEmployee.name || previousEmployee.badge}] to [${toEmp.NAME || toEmp.BADGENUMBER}] by ${handledBy}${notes ? ' - ' + notes : ''}`
      : `Assigned to [${toEmp.NAME || toEmp.BADGENUMBER}] by ${handledBy}${notes ? ' - ' + notes : ''}`;

    await transaction.request()
      .input('userItemId', sql.Int, item.UserItemID)
      .input('toUserId', sql.Int, toEmp.USERID)
      .input('notes', sql.VarChar(255), note.substring(0, 255))
      .query(`
        UPDATE dbo.UserItems
        SET UserID = @toUserId, AssignedDate = GETDATE(), Notes = @notes
        WHERE UserItemID = @userItemId
      `);

    await transaction.commit();

    return {
      userItemId: item.UserItemID,
      itemCode: item.ItemCode,
      itemName: item.ItemName,
      previousEmployee,
      assignedTo: {
        userId: toEmp.USERID,
        name: toEmp.NAME,
        badge: toEmp.BADGENUMBER,
        department: toEmp.DEPTNAME,
      },
      notes,
      assignedAt: new Date().toISOString(),
    };
  } catch (err) {
    await transaction.rollback();
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في تخصيص العهدة للموظف: ${err.message}`);
  }
};

const deleteCustodyItem = async ({ itemCode }) => {
  const trimmedCode = (itemCode || '').trim();
  const pool = checkZkConnection();

  const itemResult = await pool.request()
    .input('itemCode', sql.NVarChar(50), trimmedCode)
    .query(`SELECT TOP 1 UserItemID, ItemCode FROM dbo.UserItems WHERE ItemCode = @itemCode`);

  if (itemResult.recordset.length === 0) {
    throw new AppError(`الصنف ذو الكود [${trimmedCode}] غير موجود`, 404, 'ITEM_NOT_FOUND');
  }
  const userItemId = itemResult.recordset[0].UserItemID;

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // Delete related transactions in ItemTransactions if any
    await transaction.request()
      .input('userItemId', sql.Int, userItemId)
      .query(`DELETE FROM dbo.ItemTransactions WHERE UserItemID = @userItemId`);

    // Delete from UserItems
    await transaction.request()
      .input('userItemId', sql.Int, userItemId)
      .query(`DELETE FROM dbo.UserItems WHERE UserItemID = @userItemId`);

    await transaction.commit();
    return { success: true, itemCode: trimmedCode, userItemId };
  } catch (err) {
    await transaction.rollback();
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في حذف العهدة: ${err.message}`);
  }
};

const transferCustodyItem = async ({ itemCode, fromUserId, toUserId, reason = null, handledBy = 'System' }) => {
  if (fromUserId === toUserId) {
    throw new AppError('لا يمكن نقل العهدة إلى نفس الموظف الحالي', 400, 'SAME_EMPLOYEE_TRANSFER');
  }

  const transaction = new sql.Transaction(checkZkConnection());
  try {
    await transaction.begin();

    // 1. Verify fromEmployee
    const fromEmpResult = await transaction.request()
      .input('fromUserId', sql.Int, fromUserId)
      .query(`
        SELECT u.USERID, u.BADGENUMBER, u.NAME, d.DEPTNAME
        FROM dbo.USERINFO u
        LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
        WHERE u.USERID = @fromUserId
      `);
    if (fromEmpResult.recordset.length === 0) {
      throw new AppError('الموظف الحالي غير موجود في قاعدة بيانات البصمة', 404, 'FROM_EMPLOYEE_NOT_FOUND');
    }
    const fromEmp = fromEmpResult.recordset[0];

    // 2. Verify toEmployee
    const toEmpResult = await transaction.request()
      .input('toUserId', sql.Int, toUserId)
      .query(`
        SELECT u.USERID, u.BADGENUMBER, u.NAME, d.DEPTNAME
        FROM dbo.USERINFO u
        LEFT JOIN dbo.DEPARTMENTS d ON u.DEFAULTDEPTID = d.DEPTID
        WHERE u.USERID = @toUserId
      `);
    if (toEmpResult.recordset.length === 0) {
      throw new AppError('الموظف الجديد المستلم غير موجود في قاعدة بيانات البصمة', 404, 'TO_EMPLOYEE_NOT_FOUND');
    }
    const toEmp = toEmpResult.recordset[0];

    // 3. Find UserItem assigned to fromUserId
    const itemResult = await transaction.request()
      .input('fromUserId', sql.Int, fromUserId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .query(`
        SELECT TOP 1 ui.UserItemID, ui.ItemID, i.ItemName, ui.ItemCode
        FROM dbo.UserItems ui
        JOIN dbo.Items i ON ui.ItemID = i.ItemID
        WHERE ui.UserID = @fromUserId AND ui.ItemCode = @itemCode
      `);
    if (itemResult.recordset.length === 0) {
      throw new AppError('هذا الصنف غير مسجل كعهدة حالية للموظف المصدر', 404, 'ITEM_NOT_FOUND_FOR_USER');
    }
    const userItem = itemResult.recordset[0];
    const userItemId = userItem.UserItemID;

    const transferNote = `Reassigned from [${fromEmp.NAME || fromEmp.BADGENUMBER}] to [${toEmp.NAME || toEmp.BADGENUMBER}] by ${handledBy}${reason ? ' - ' + reason : ''}`;

    // 4. Update custody owner in dbo.UserItems
    await transaction.request()
      .input('userItemId', sql.Int, userItemId)
      .input('toUserId', sql.Int, toUserId)
      .input('notes', sql.VarChar(255), transferNote.substring(0, 255))
      .query(`
        UPDATE dbo.UserItems
        SET UserID = @toUserId, AssignedDate = GETDATE(), Notes = @notes
        WHERE UserItemID = @userItemId
      `);

    await transaction.commit();

    return {
      userItemId,
      itemCode: userItem.ItemCode,
      itemName: userItem.ItemName,
      fromEmployee: {
        userId: fromEmp.USERID,
        name: fromEmp.NAME,
        badge: fromEmp.BADGENUMBER,
        department: fromEmp.DEPTNAME,
      },
      toEmployee: {
        userId: toEmp.USERID,
        name: toEmp.NAME,
        badge: toEmp.BADGENUMBER,
        department: toEmp.DEPTNAME,
      },
      reason,
      transferredAt: new Date().toISOString(),
    };
  } catch (err) {
    await transaction.rollback();
    if (err instanceof AppError) throw err;
    throw new DatabaseError(`فشل في نقل عهدة الصنف: ${err.message}`);
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
  getInLaundryInventory,
  getAllCustodyItems,
  getCustodyItemByCode,
  createCustodyItem,
  unassignCustodyItem,
  assignCustodyItem,
  deleteCustodyItem,
  transferCustodyItem,
  getCustodyStats,
  getItemDefinitions,
  getDepartmentsList,
  ensureZkIndexes,
};
