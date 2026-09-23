'use strict';

/**
 * Comsys Data Repository
 * READ-ONLY — queries FHtlPTrain @ 192.168.50.1
 *
 * ═══════════════════════════════════════════════════════════
 * COMSYS TABLE NAMING PATTERN:
 *   Prefix FSgs → General Stores      (المخازن العامة)
 *   Prefix FSfb → Food & Beverage     (مطابخ وبارات)
 *   Prefix FSes → Engineering Stores  (مخازن هندسية)
 *
 *   EACH department has its own set of tables!
 *   We sync from ALL prefixes that have active warehouses.
 * ═══════════════════════════════════════════════════════════
 *
 * STATUS:
 *   ✅ FSgsSTOR   — Warehouses/Stores       (confirmed)
 *   ✅ FSfbInTake — F&B Intake/Receipts     (confirmed)
 *   ✅ FSfbLevel  — Stock Level Settings    (confirmed — NOT balance, it's min/max/reorder)
 *   ✅ FSfbSM     — F&B Store Movements     (confirmed)
 *   ✅ FSgsSM     — General Store Movements (confirmed)
 *   ✅ FSfbAverage— Costs / Stock Balance   (confirmed)
 *   ✅ FGgsItem / FGfbItem — Item Master    (confirmed)
 */

const { getComsysDB, sql } = require('../../config/comsys.database');
const { ComsysUnavailableError } = require('../../utils/errors');

const requireComsys = () => {
  const pool = getComsysDB();
  if (!pool) throw new ComsysUnavailableError();
  return pool;
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CONFIRMED: WAREHOUSES — dbo.FSfbSTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all warehouses from Comsys.
 * Table  : dbo.FS{prefix}STOR
 * Columns: Code, Name1 (AR), Name0 (EN), NotActive (0=active INVERTED)
 *
 * @param {'fb'|'gs'} prefix - division prefix (fb = F&B, gs = General)
 */
const getAllWarehouses = async (prefix = 'fb') => {
  const pool = requireComsys();
  const table = `dbo.FS${prefix}STOR`;
  const result = await pool.request().query(`
    SELECT
      s.Code   AS warehouse_code,
      s.Name1  AS warehouse_name_ar,
      s.Name0  AS warehouse_name_en,
      CASE WHEN s.NotActive = 0 THEN 1 ELSE 0 END AS is_active
    FROM ${table} s
    ORDER BY s.Code
  `);
  return result.recordset;
};

const getWarehouseByCode = async (code, prefix = 'fb') => {
  const pool = requireComsys();
  const table = `dbo.FS${prefix}STOR`;
  const result = await pool.request()
    .input('code', sql.NVarChar(50), code)
    .query(`
      SELECT
        s.Code   AS warehouse_code,
        s.Name1  AS warehouse_name_ar,
        s.Name0  AS warehouse_name_en,
        CASE WHEN s.NotActive = 0 THEN 1 ELSE 0 END AS is_active
      FROM ${table} s
      WHERE s.Code = @code
    `);
  return result.recordset[0] ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CONFIRMED: INTAKE (RECEIPTS FROM PURCHASING) — dbo.FSfbInTake / FSgsInTake
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get intake records (goods received from purchasing) since a given date.
 *
 * Tables : dbo.FSfbInTake (F&B)  |  dbo.FSgsInTake (General)
 * Columns: Item, Date, Stor, InTakeSerial, Qnty, ActualQnty,
 *          Serial, Line, Account, ExpireDate, Posted
 *
 * We only take Posted=1 records (officially posted by accounting)
 *
 * @param {'fb'|'gs'|'es'} prefix - department prefix
 * @param {Date} sinceDate
 */
const getIntakeSince = async (prefix = 'fb', sinceDate) => {
  const pool = requireComsys();
  const table = `dbo.FS${prefix}InTake`;

  const result = await pool.request()
    .input('sinceDate', sql.DateTime, sinceDate)
    .query(`
      SELECT
        t.Item           AS item_code,
        t.Date           AS intake_date,
        t.Stor           AS warehouse_code,
        t.InTakeSerial   AS intake_serial,
        t.Qnty           AS quantity,
        t.ActualQnty     AS actual_quantity,
        t.Account        AS account_code,
        t.ExpireDate     AS expire_date,
        t.Line           AS line_no,
        t.Posted         AS is_posted
      FROM ${table} t
      WHERE t.Date >= @sinceDate
        AND t.Posted = 1
      ORDER BY t.Date ASC, t.InTakeSerial ASC, t.Line ASC
    `);

  return result.recordset;
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CONFIRMED: STOCK LEVEL SETTINGS — dbo.FSfbLevel / FSgsLevel
// (This is MIN/MAX/REORDER settings — NOT live balance)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get stock level settings (min/max/reorder) for all items in a warehouse.
 * NOTE: This is NOT the live balance — it's configuration.
 *
 * Columns: Stor, Item, Roww (row), shlf (shelf), Minm, reord, maxm
 */
const getStockLevelSettings = async (prefix = 'fb') => {
  const pool = requireComsys();
  const table = `dbo.FS${prefix}Level`;

  const result = await pool.request().query(`
    SELECT
      l.Stor   AS warehouse_code,
      l.Item   AS item_code,
      l.Roww   AS row_location,
      l.shlf   AS shelf_location,
      l.Minm   AS min_quantity,
      l.reord  AS reorder_point,
      l.maxm   AS max_quantity
    FROM ${table} l
    ORDER BY l.Stor, l.Item
  `);

  return result.recordset;
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CONFIRMED: STORE MOVEMENTS — dbo.FSfbSM / FSgsSM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get store movements (transfers between warehouses) since a given date.
 * Table: dbo.FSfbSM / FSgsSM joined with TransHeader for Date and Posted status.
 */
const getMovementsSince = async (prefix = 'fb', sinceDate) => {
  const pool = requireComsys();
  const smTable = `dbo.FS${prefix}SM`;
  const headerTable = `dbo.FS${prefix}TransHeader`;

  const result = await pool.request()
    .input('sinceDate', sql.DateTime, sinceDate)
    .query(`
      SELECT
        m.Item       AS item_code,
        h.Date       AS move_date,
        m.Stor       AS from_warehouse_code,
        m.ToStor     AS to_warehouse_code,
        m.Qnty       AS quantity,
        m.Serial     AS serial_no,
        m.Line       AS line_no,
        m.Docu       AS doc_type,
        m.Year       AS move_year,
        h.Posted     AS is_posted
      FROM ${smTable} m
      INNER JOIN ${headerTable} h 
        ON m.Docu = h.Docu 
       AND m.Year = h.Year 
       AND m.Serial = h.Serial
      WHERE h.Date >= @sinceDate
      ORDER BY h.Date ASC, m.Serial ASC, m.Line ASC
    `);

  return result.recordset;
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CONFIRMED: AVERAGE COST / STOCK BALANCE — dbo.FSfbAverage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current average cost and quantity on hand per item per warehouse.
 * Table: dbo.FSfbAverage / FSgsAverage
 */
const getAverageCost = async (prefix = 'fb') => {
  const pool = requireComsys();
  const table = `dbo.FS${prefix}Average`;

  const result = await pool.request().query(`
    SELECT
      a.Item     AS item_code,
      a.Stor     AS warehouse_code,
      a.Copr     AS average_cost,
      a.Hold     AS quantity_on_hand,
      a.MadeBy   AS made_by,
      a.DateMade AS date_made
    FROM ${table} a
    ORDER BY a.Item, a.Stor
  `);

  return result.recordset;
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CONFIRMED: ITEMS MASTER — dbo.FGgsItem / FGfbItem / FGesItem
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all items from the Comsys item master.
 * Table  : dbo.FGgsItem (General), FGfbItem (F&B), FGesItem (Engineering)
 * Columns: Item (code), Name0 (EN), Name1 (AR)
 *
 * @param {'gs'|'fb'|'es'} prefix - department prefix
 */
const getAllItems = async (prefix = 'gs') => {
  const pool = requireComsys();
  const table = `dbo.FG${prefix}Item`;

  const result = await pool.request().query(`
    SELECT
      i.Item   AS item_code,
      i.Name1  AS item_name_ar,
      i.Name0  AS item_name_en
    FROM ${table} i
    ORDER BY i.Item
  `);

  return result.recordset;
};

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY QUERIES — run these to find remaining column names
// GET /api/v1/sync/explore/discover
// ─────────────────────────────────────────────────────────────────────────────

const DISCOVERY_QUERIES = {

  // ⏳ Get FSfbSM columns
  describeMovementsTable_fb: `
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'FSfbSM'
    ORDER BY ORDINAL_POSITION
  `,
  describeMovementsTable_gs: `
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'FSgsSM'
    ORDER BY ORDINAL_POSITION
  `,

  // ⏳ Get FSfbAverage columns
  describeAverageTable: `
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'FSfbAverage'
    ORDER BY ORDINAL_POSITION
  `,

  // ⏳ Get item master (FI) columns
  describeItemMaster_FI: `
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'FSgsFI'
    ORDER BY ORDINAL_POSITION
  `,

  // 🔍 Find any table starting with 'FS' that has columns containing 'Name' or 'Desc'
  findTablesWithNames: `
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (COLUMN_NAME LIKE '%Name%' OR COLUMN_NAME LIKE '%Desc%')
      AND TABLE_NAME LIKE 'FS%'
    ORDER BY TABLE_NAME, COLUMN_NAME
  `,

  // Previews of potential master/helper tables
  previewNvTable: `SELECT TOP 5 * FROM dbo.FSgsNv`,
  previewUxTable: `SELECT TOP 5 * FROM dbo.FSgsUx`,
  previewHglTable: `SELECT TOP 5 * FROM dbo.FSgsHgl`,
  previewSXTable: `SELECT TOP 5 * FROM dbo.FSgsSX`,

  // Previews of confirmed tables
  previewMovements_fb: `SELECT TOP 3 * FROM dbo.FSfbSM`,
  previewMovements_gs: `SELECT TOP 3 * FROM dbo.FSgsSM`,
  previewAverage_fb:   `SELECT TOP 3 * FROM dbo.FSfbAverage`,
  previewItemMaster:   `SELECT TOP 3 * FROM dbo.FSgsFI`,

  // All FS prefixes & table counts
  allPrefixSummary: `
    SELECT
      LEFT(TABLE_NAME, 4)  AS prefix,
      RIGHT(TABLE_NAME, LEN(TABLE_NAME)-4) AS suffix,
      TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME LIKE 'FS%'
    ORDER BY prefix, suffix
  `,
};

module.exports = {
  getAllWarehouses,
  getWarehouseByCode,
  getIntakeSince,
  getStockLevelSettings,
  getMovementsSince,
  getAverageCost,
  getAllItems,
  DISCOVERY_QUERIES,
};
