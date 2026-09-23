'use strict';

/**
 * System Database Pool (Our new system — SQL Server)
 * Uses connection pooling via mssql.
 */

const sql    = require('mssql');
const config = require('./index');
const logger = require('../utils/logger');

let pool = null;

/**
 * Build mssql config object from our app config
 */
const buildMssqlConfig = (dbConfig) => ({
  server:   dbConfig.server,
  port:     dbConfig.port,
  database: dbConfig.database,
  user:     dbConfig.user,
  password: dbConfig.password,
  options: {
    encrypt:                    dbConfig.encrypt,
    trustServerCertificate:     dbConfig.trustServerCertificate,
    enableArithAbort:           true,
    connectTimeout:             30000,
    requestTimeout:             30000,
  },
  pool: {
    min:               dbConfig.pool.min,
    max:               dbConfig.pool.max,
    idleTimeoutMillis: dbConfig.pool.idleTimeoutMillis,
    acquireTimeoutMillis: 30000,
  },
});

const connectSystemDB = async () => {
  if (pool) return pool;

  try {
    pool = new sql.ConnectionPool(buildMssqlConfig(config.systemDb));
    await pool.connect();

    pool.on('error', (err) => {
      logger.error('[SystemDB] Pool error', { error: err.message });
    });

    logger.info('[SystemDB] Connected', {
      server:   config.systemDb.server,
      database: config.systemDb.database,
    });

    return pool;
  } catch (err) {
    console.error('❌ [SystemDB Error]: Failed to connect to SQL Server:', err.message);
    logger.error('[SystemDB] Connection failed', { error: err.message });
    pool = null;
    throw err;
  }
};

/**
 * Get the active pool (throws if not connected)
 */
const getSystemDB = () => {
  if (!pool) {
    connectSystemDB().catch(err => console.error('❌ [SystemDB Auto-Reconnect Failed]:', err.message));
    throw new Error(`[SystemDB] Pool not initialized. Failed connecting to SQL Server (${config.systemDb.server}). Check Royal_inventory/.env credentials.`);
  }
  return pool;
};

/**
 * Close the pool (called on graceful shutdown)
 */
const closeSystemDB = async () => {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info('[SystemDB] Pool closed');
  }
};

module.exports = { connectSystemDB, getSystemDB, closeSystemDB, sql };
