'use strict';

/**
 * Comsys Database Pool (FHtlPTrain @ 192.168.50.1)
 * READ-ONLY connection — we never write to Comsys.
 * Separate pool to isolate Comsys from our system DB.
 */

const sql    = require('mssql');
const config = require('./index');
const logger = require('../utils/logger');

let comsysPool = null;
let laundryPool = null;

const buildMssqlConfig = (dbConfig) => ({
  server:   dbConfig.server,
  port:     dbConfig.port,
  database: dbConfig.database,
  user:     dbConfig.user,
  password: dbConfig.password,
  options: {
    encrypt:                dbConfig.encrypt,
    trustServerCertificate: dbConfig.trustServerCertificate,
    enableArithAbort:       true,
    connectTimeout:         30000,
    requestTimeout:         60000, // longer timeout for heavy Comsys queries
    readOnlyIntent:         true,  // hint to SQL Server: read-only
  },
  pool: {
    min:               dbConfig.pool.min,
    max:               dbConfig.pool.max,
    idleTimeoutMillis: dbConfig.pool.idleTimeoutMillis,
    acquireTimeoutMillis: 30000,
  },
});

/**
 * Connect to Comsys Database.
 * Call once at app startup.
 */
const connectComsysDB = async () => {
  if (comsysPool) return comsysPool;

  try {
    comsysPool = new sql.ConnectionPool(buildMssqlConfig(config.comsysDb));
    await comsysPool.connect();

    comsysPool.on('error', (err) => {
      logger.error('[ComsysDB] Pool error', { error: err.message });
    });

    logger.info('[ComsysDB] Connected (READ-ONLY)', {
      server:   config.comsysDb.server,   // 192.168.50.1
      database: config.comsysDb.database, // FHtlPTrain
    });

    // Also automatically connect to Laundry DB pool
    await connectLaundryDB();

    return comsysPool;
  } catch (err) {
    // Comsys connection failure is non-fatal at startup — app still runs
    // but Sync jobs will be disabled until connection is restored.
    logger.warn('[ComsysDB] Connection failed — Sync will be unavailable', {
      error:  err.message,
      server: config.comsysDb.server,
    });
    comsysPool = null;
    return null;
  }
};

/**
 * Get the active Comsys pool.
 * Returns null if Comsys is unreachable (graceful degradation).
 */
const getComsysDB = () => {
  if (!comsysPool) {
    logger.warn('[ComsysDB] Pool not available — Comsys unreachable');
    return null;
  }
  return comsysPool;
};

/**
 * Health check — test if Comsys connection is live
 */
const pingComsysDB = async () => {
  const pool = getComsysDB();
  if (!pool) return { connected: false, error: 'Pool not initialized' };

  try {
    await pool.request().query('SELECT 1 AS ping');
    return { connected: true, server: config.comsysDb.server, db: config.comsysDb.database };
  } catch (err) {
    return { connected: false, error: err.message };
  }
};

/**
 * List all tables in Comsys DB (useful for exploring the schema)
 */
const listComsysTables = async () => {
  const pool = getComsysDB();
  if (!pool) throw new Error('Comsys DB not available');

  const result = await pool.request().query(`
    SELECT
      t.TABLE_SCHEMA  AS [schema],
      t.TABLE_NAME    AS [table],
      (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_NAME = t.TABLE_NAME
          AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
      ) AS column_count
    FROM INFORMATION_SCHEMA.TABLES t
    WHERE t.TABLE_TYPE = 'BASE TABLE'
    ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
  `);

  return result.recordset;
};

/**
 * Get columns of a specific Comsys table (useful for mapping)
 */
const describeComsysTable = async (tableName) => {
  const pool = getComsysDB();
  if (!pool) throw new Error('Comsys DB not available');

  const result = await pool.request()
    .input('tableName', sql.NVarChar, tableName)
    .query(`
      SELECT
        c.COLUMN_NAME       AS [column],
        c.DATA_TYPE         AS [type],
        c.CHARACTER_MAXIMUM_LENGTH AS [max_length],
        c.IS_NULLABLE       AS [nullable],
        c.COLUMN_DEFAULT    AS [default]
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = @tableName
      ORDER BY c.ORDINAL_POSITION
    `);

  return result.recordset;
};

const connectLaundryDB = async () => {
  if (laundryPool) return laundryPool;
  try {
    laundryPool = new sql.ConnectionPool(buildMssqlConfig(config.laundryDb));
    await laundryPool.connect();
    logger.info('[LaundryDB] Connected (READ-ONLY)', {
      server:   config.laundryDb.server,
      database: config.laundryDb.database,
    });
    return laundryPool;
  } catch (err) {
    logger.warn('[LaundryDB] Connection failed — using ComsysDB fallback', { error: err.message });
    laundryPool = null;
    return null;
  }
};

const getLaundryDB = () => {
  return laundryPool || getComsysDB();
};

const closeLaundryDB = async () => {
  if (laundryPool) {
    await laundryPool.close();
    laundryPool = null;
    logger.info('[LaundryDB] Pool closed');
  }
};

/**
 * Close Comsys pool (graceful shutdown)
 */
const closeComsysDB = async () => {
  if (comsysPool) {
    await comsysPool.close();
    comsysPool = null;
    logger.info('[ComsysDB] Pool closed');
  }
  await closeLaundryDB();
};

module.exports = {
  connectComsysDB,
  getComsysDB,
  connectLaundryDB,
  getLaundryDB,
  closeLaundryDB,
  pingComsysDB,
  listComsysTables,
  describeComsysTable,
  closeComsysDB,
  sql,
};
