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

const connectZkDB = async () => {
  if (zkPool) return zkPool;

  try {
    zkPool = new sql.ConnectionPool(buildMssqlConfig(config.zkDb));
    await zkPool.connect();

    zkPool.on('error', (err) => {
      logger.error('[ZkDB] Pool error', { error: err.message });
    });

    logger.info('[ZkDB] Connected', {
      server: config.zkDb.server,
      database: config.zkDb.database,
    });

    return zkPool;
  } catch (err) {
    logger.warn('[ZkDB] Connection failed — ZK operations will be unavailable', {
      error: err.message,
      server: config.zkDb.server,
    });
    zkPool = null;
    return null;
  }
};

const getZkDB = () => {
  if (!zkPool) {
    logger.warn('[ZkDB] Pool not available — ZK DB unreachable');
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
