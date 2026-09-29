'use strict';

/**
 * ZK Database Connection Pool Manager
 * Connects to the ZK fingerprint database (Zktime on 192.168.50.6)
 */

const sql = require('mssql');
const config = require('./index');
const logger = require('../utils/logger');

let zkPool = null;

const buildMssqlConfig = (dbConfig) => ({
  server: dbConfig.server,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  options: {
    encrypt: dbConfig.encrypt,
    trustServerCertificate: dbConfig.trustServerCertificate,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    min: dbConfig.pool.min,
    max: dbConfig.pool.max,
    idleTimeoutMillis: dbConfig.pool.idleTimeoutMillis,
    acquireTimeoutMillis: 30000,
  },
});

let isConnecting = false;

const connectZkDB = async () => {
  if (zkPool && zkPool.connected) return zkPool;
  if (isConnecting) return null;

  isConnecting = true;
  try {
    if (zkPool) {
      try { await zkPool.close(); } catch (_) {}
      zkPool = null;
    }

    const pool = new sql.ConnectionPool(buildMssqlConfig(config.zkDb));
    await pool.connect();

    pool.on('error', (err) => {
      logger.error('[ZkDB] Pool error', { error: err.message });
      zkPool = null;
    });

    logger.info('[ZkDB] Connected successfully ✅', {
      server: config.zkDb.server,
      database: config.zkDb.database,
    });

    zkPool = pool;
    return zkPool;
  } catch (err) {
    logger.warn('[ZkDB] Connection failed — ZK operations will be unavailable', {
      error: err.message,
      server: config.zkDb.server,
    });
    zkPool = null;
    return null;
  } finally {
    isConnecting = false;
  }
};

const getZkDB = () => {
  if (!zkPool || !zkPool.connected) {
    // Proactively trigger reconnect in background
    connectZkDB().catch(() => {});
    return null;
  }
  return zkPool;
};

const closeZkDB = async () => {
  if (zkPool) {
    await zkPool.close();
    zkPool = null;
    logger.info('[ZkDB] Pool closed');
  }
};

module.exports = {
  connectZkDB,
  getZkDB,
  closeZkDB,
  sql,
};
