'use strict';

const asyncHandler  = require('../../../utils/asyncHandler');
const R             = require('../../../utils/response.helper');
const {
  listComsysTables,
  describeComsysTable,
  pingComsysDB,
  getComsysDB,
} = require('../../../config/comsys.database');
const { DISCOVERY_QUERIES } = require('../../../repositories/comsys/comsysWarehouses.repo');

/**
 * Sync Controller
 * Base: /api/v1/sync
 */

// GET /api/v1/sync/health — check Comsys connection
const healthCheck = asyncHandler(async (req, res) => {
  const status = await pingComsysDB();
  if (!status.connected) {
    return R.error(res, `كوم سيس غير متاح: ${status.error}`, 503, null, 'COMSYS_UNAVAILABLE');
  }
  return R.success(res, status, 'كوم سيس متصل');
});

// GET /api/v1/sync/explore/tables — list ALL Comsys tables (admin only)
const exploreTables = asyncHandler(async (req, res) => {
  const tables = await listComsysTables();
  return R.success(res, tables, `تم جلب ${tables.length} جدول من كوم سيس`);
});

// GET /api/v1/sync/explore/table/:tableName — describe a specific table
const exploreTable = asyncHandler(async (req, res) => {
  const { tableName } = req.params;
  const columns = await describeComsysTable(tableName);
  return R.success(res, { tableName, columns }, `وصف جدول "${tableName}"`);
});

// GET /api/v1/sync/explore/preview/:tableName — preview first 20 rows
const previewTable = asyncHandler(async (req, res) => {
  const { tableName } = req.params;
  const { getComsysDB, sql } = require('../../../config/comsys.database');
  const pool = getComsysDB();

  if (!pool) {
    return R.error(res, 'كوم سيس غير متاح', 503, null, 'COMSYS_UNAVAILABLE');
  }

  // Sanitize table name to prevent SQL injection (only allow word chars and dots)
  if (!/^[\w.]+$/.test(tableName)) {
    return R.badRequest(res, 'اسم الجدول غير صالح');
  }

  const result = await pool.request().query(
    `SELECT TOP 20 * FROM [${tableName.replace(/'/g, '')}]`
  );

  return R.success(res, {
    tableName,
    rowCount: result.recordset.length,
    rows:     result.recordset,
  }, `معاينة أول 20 سجل من "${tableName}"`);
});

// GET /api/v1/sync/explore/discover — run targeted discovery queries to find key tables
const discoverTables = asyncHandler(async (req, res) => {
  const pool = getComsysDB();
  if (!pool) return R.error(res, 'كوم سيس غير متاح', 503, null, 'COMSYS_UNAVAILABLE');

  const { sql } = require('mssql');
  const results = {};

  for (const [queryName, queryText] of Object.entries(DISCOVERY_QUERIES)) {
    try {
      const r = await pool.request().query(queryText);
      results[queryName] = r.recordset;
    } catch (err) {
      results[queryName] = { error: err.message };
    }
  }

  return R.success(res, results,
    'نتائج البحث عن جداول الأصناف والتحريكات والأرصدة — ابعت النتيجة لتحديث الكود'
  );
});

// GET /api/v1/sync/warehouses — get all Comsys warehouses (confirmed ✅)
const getWarehouses = asyncHandler(async (req, res) => {
  const { getAllWarehouses } = require('../../../repositories/comsys/comsysWarehouses.repo');
  const warehouses = await getAllWarehouses();
  return R.success(res, warehouses, `تم جلب ${warehouses.length} مخزن من كوم سيس`);
});

// POST /api/v1/sync/run — manual trigger for full sync (warehouses & items)
const runSync = asyncHandler(async (req, res) => {
  const division = req.body.division || 'fb';
  if (!['fb', 'gs'].includes(division)) {
    return R.badRequest(res, 'القسم غير صالح. يجب أن يكون fb أو gs');
  }

  const syncService = require('./sync.service');
  const result = await syncService.syncAll(division, req.user?.username || 'admin');
  return R.success(res, result, `تمت المزامنة بنجاح لقسم ${division === 'fb' ? 'الأغذية والمشروبات' : 'المستلزمات العامة'}`);
});

// GET /api/v1/sync/comsys-inbound — get inbound receipts from Comsys Main Warehouse
const getComsysInbound = asyncHandler(async (req, res) => {
  const { getSystemDB, sql } = require('../../../config/database');
  const comsysWarehouseRepo = require('../../../repositories/comsys/comsysWarehouses.repo');
  const logger = require('../../../utils/logger');

  const filterDate = req.query.filterDate || 'today';
  let sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0); // today midnight

  if (filterDate === 'yesterday') {
    sinceDate.setDate(sinceDate.getDate() - 1);
  } else if (filterDate === 'week') {
    sinceDate.setDate(sinceDate.getDate() - 7);
  } else if (filterDate === 'month') {
    sinceDate.setDate(sinceDate.getDate() - 30);
  } else if (filterDate === 'all') {
    sinceDate.setDate(sinceDate.getDate() - 180); // last 6 months
  }

  const systemPool = getSystemDB();
  
  // Mapped Child Nodes
  const nodesResult = await systemPool.request().query(`
    SELECT node_id AS nodeId, comsys_store_code AS storeCode, node_name_ar AS nodeNameAr, division 
    FROM ops.inventory_nodes 
    WHERE node_type = 'child' AND is_active = 1
  `);
  const localNodes = nodesResult.recordset;
  const localNodeMap = {}; // key: storeCode_division -> node
  localNodes.forEach(n => {
    if (n.storeCode) {
      localNodeMap[`${n.storeCode.trim()}_${n.division.trim()}`] = n;
    }
  });

  // Cached Items
  const itemsResult = await systemPool.request().query(`
    SELECT item_code AS itemCode, item_name_ar AS itemNameAr, item_type AS itemType, unit_name_ar AS unitNameAr
    FROM ops.comsys_items
  `);
  const localItemMap = {}; // key: itemCode -> item
  itemsResult.recordset.forEach(i => {
    localItemMap[i.itemCode.trim()] = i;
  });

  // Cached Warehouses
  const warehousesResult = await systemPool.request().query(`
    SELECT store_code AS storeCode, store_name_ar AS storeNameAr
    FROM ops.comsys_warehouses
  `);
  const localWarehouseMap = {}; // key: storeCode -> storeName
  warehousesResult.recordset.forEach(w => {
    localWarehouseMap[w.storeCode.trim()] = w.storeNameAr;
  });

  let movements_fb = [];
  let movements_gs = [];
  let intakes_fb = [];
  let intakes_gs = [];

  try {
    movements_fb = await comsysWarehouseRepo.getMovementsSince('fb', sinceDate);
    movements_gs = await comsysWarehouseRepo.getMovementsSince('gs', sinceDate);
    intakes_fb = await comsysWarehouseRepo.getIntakeSince('fb', sinceDate);
    intakes_gs = await comsysWarehouseRepo.getIntakeSince('gs', sinceDate);
  } catch (comsysErr) {
    logger.error(`[InboundController] Failed to query Comsys DB: ${comsysErr.message}`);
  }

  const inboundItems = [];

  const isLocalChildNode = (storeCode, division) => {
    if (!storeCode) return false;
    return !!localNodeMap[`${storeCode.trim()}_${division.trim()}`];
  };

  const processMovements = (movements, division) => {
    for (const m of movements) {
      const fromCode = m.from_warehouse_code?.trim();
      const toCode = m.to_warehouse_code?.trim();

      if (isLocalChildNode(toCode, division) && !isLocalChildNode(fromCode, division)) {
        const destNode = localNodeMap[`${toCode}_${division}`];
        const item = localItemMap[m.item_code?.trim()] || { itemNameAr: 'صنف غير معروف', itemType: 'consumable', unitNameAr: 'حبة' };
        
        const mDate = new Date(m.move_date);
        if (filterDate === 'yesterday') {
          const yesterdayMidnight = new Date();
          yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
          yesterdayMidnight.setHours(0, 0, 0, 0);
          const todayMidnight = new Date();
          todayMidnight.setHours(0, 0, 0, 0);
          if (mDate < yesterdayMidnight || mDate >= todayMidnight) continue;
        }

        inboundItems.push({
          txnId: `TR-${m.move_year}-${String(m.serial_no).padStart(4, '0')}`,
          itemCode: m.item_code?.trim(),
          itemNameAr: item.itemNameAr,
          itemType: item.itemType,
          unitNameAr: item.unitNameAr,
          quantity: m.quantity,
          fromWarehouseCode: fromCode,
          fromWarehouseNameAr: localWarehouseMap[fromCode] || 'مستودع كومسيس الرئيسي',
          toNodeId: destNode.nodeId,
          toNodeNameAr: destNode.nodeNameAr,
          moveDate: m.move_date,
          docType: 'تحويل كومسيس',
        });
      }
    }
  };

  const processIntakes = (intakes, division) => {
    for (const t of intakes) {
      const storeCode = t.warehouse_code?.trim();

      if (isLocalChildNode(storeCode, division)) {
        const destNode = localNodeMap[`${storeCode}_${division}`];
        const item = localItemMap[t.item_code?.trim()] || { itemNameAr: 'صنف غير معروف', itemType: 'consumable', unitNameAr: 'حبة' };

        const iDate = new Date(t.intake_date);
        if (filterDate === 'yesterday') {
          const yesterdayMidnight = new Date();
          yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
          yesterdayMidnight.setHours(0, 0, 0, 0);
          const todayMidnight = new Date();
          todayMidnight.setHours(0, 0, 0, 0);
          if (iDate < yesterdayMidnight || iDate >= todayMidnight) continue;
        }

        inboundItems.push({
          txnId: `IN-${String(t.intake_serial).padStart(5, '0')}`,
          itemCode: t.item_code?.trim(),
          itemNameAr: item.itemNameAr,
          itemType: item.itemType,
          unitNameAr: item.unitNameAr,
          quantity: t.actual_quantity || t.quantity,
          fromWarehouseCode: 'SUPPLIER',
          fromWarehouseNameAr: 'مورد خارجي',
          toNodeId: destNode.nodeId,
          toNodeNameAr: destNode.nodeNameAr,
          moveDate: t.intake_date,
          docType: 'استلام شراء',
        });
      }
    }
  };

  processMovements(movements_fb, 'fb');
  processMovements(movements_gs, 'gs');
  processIntakes(intakes_fb, 'fb');
  processIntakes(intakes_gs, 'gs');

  inboundItems.sort((a, b) => new Date(b.moveDate) - new Date(a.moveDate));

  return R.success(res, inboundItems, 'تم جلب الوارد من المخزن الرئيسي بنجاح');
});

module.exports = {
  healthCheck,
  exploreTables,
  exploreTable,
  previewTable,
  discoverTables,
  getWarehouses,
  runSync,
  getComsysInbound,
};
