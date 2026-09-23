'use strict';

const fs = require('fs');
const path = require('path');

// Resolve .env file: check process.env.ENV_FILE, app root, current working directory, or parent directory
const envCandidates = [
  process.env.ENV_FILE,
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../.env'),
].filter(Boolean);

let envLoaded = false;
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    break;
  }
}
if (!envLoaded) {
  require('dotenv').config();
}

const Joi = require('joi');

// ─── Schema: validate all required env vars at startup ──────────────────────
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  APP_NAME: Joi.string().default('inventory_tracking_system'),
  API_PREFIX: Joi.string().default('/api/v1'),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY: Joi.string().length(64).required(),

  // System DB
  SYSTEM_DB_SERVER: Joi.string().required(),
  SYSTEM_DB_PORT: Joi.number().default(1433),
  SYSTEM_DB_NAME: Joi.string().required(),
  SYSTEM_DB_USER: Joi.string().required(),
  SYSTEM_DB_PASSWORD: Joi.string().required(),
  SYSTEM_DB_ENCRYPT: Joi.boolean().default(false),
  SYSTEM_DB_TRUST_CERT: Joi.boolean().default(true),
  OPS_SCHEMA: Joi.string().default('ops'),  // schema for our tables inside FHtlPTrain
  SYSTEM_DB_POOL_MIN: Joi.number().default(2),
  SYSTEM_DB_POOL_MAX: Joi.number().default(10),
  SYSTEM_DB_POOL_IDLE: Joi.number().default(30000),

  // Comsys DB
  COMSYS_DB_SERVER: Joi.string().required(),
  COMSYS_DB_PORT: Joi.number().default(1433),
  COMSYS_DB_NAME: Joi.string().required(),
  COMSYS_DB_USER: Joi.string().required(),
  COMSYS_DB_PASSWORD: Joi.string().required(),
  COMSYS_DB_ENCRYPT: Joi.boolean().default(false),
  COMSYS_DB_TRUST_CERT: Joi.boolean().default(true),
  COMSYS_DB_POOL_MIN: Joi.number().default(1),
  COMSYS_DB_POOL_MAX: Joi.number().default(5),
  COMSYS_DB_POOL_IDLE: Joi.number().default(30000),

  // ZK Fingerprint DB
  ZK_DB_SERVER: Joi.string().required(),
  ZK_DB_PORT: Joi.number().default(1433),
  ZK_DB_NAME: Joi.string().required(),
  ZK_DB_USER: Joi.string().required(),
  ZK_DB_PASSWORD: Joi.string().required(),
  ZK_DB_ENCRYPT: Joi.boolean().default(false),
  ZK_DB_TRUST_CERT: Joi.boolean().default(true),
  ZK_DB_POOL_MIN: Joi.number().default(1),
  ZK_DB_POOL_MAX: Joi.number().default(5),
  ZK_DB_POOL_IDLE: Joi.number().default(30000),
  ZK_DEVICE_IP: Joi.string().default('192.168.50.205'),
  ZK_LAUNDRY_SENSOR_ID: Joi.string().default('104'),
  ZK_LAUNDRY_SN: Joi.string().default('CQUL232462270'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  AUTH_RATE_LIMIT_MAX: Joi.number().default(10),

  // Cache
  CACHE_TTL_SECONDS: Joi.number().default(300),
  CACHE_MAX_KEYS: Joi.number().default(500),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  // Sync
  SYNC_CRON_SCHEDULE: Joi.string().default('0 */6 * * *'),
  SYNC_ENABLED: Joi.boolean().default(true),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
  LOG_DIR: Joi.string().default('./logs'),

  // Client Static Files (React production build)
  CLIENT_BUILD_PATH: Joi.string().optional(),

}).unknown(true); // allow extra vars

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  console.error(`\n❌ [Config] Environment validation failed:\n   ${error.message}\n`);
  process.exit(1);
}

// ─── Exported config object ───────────────────────────────────────────────────
const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  app: {
    name: env.APP_NAME,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpires: env.JWT_ACCESS_EXPIRES,
    refreshExpires: env.JWT_REFRESH_EXPIRES,
  },

  encryption: {
    key: env.ENCRYPTION_KEY, // 32-byte hex key for AES-256-GCM
  },

  systemDb: {
    server: env.SYSTEM_DB_SERVER,
    port: env.SYSTEM_DB_PORT,
    database: env.SYSTEM_DB_NAME,
    user: env.SYSTEM_DB_USER,
    password: env.SYSTEM_DB_PASSWORD,
    encrypt: env.SYSTEM_DB_ENCRYPT,
    trustServerCertificate: env.SYSTEM_DB_TRUST_CERT,
    schema: env.OPS_SCHEMA,   // 'ops' — our tables live here, Comsys stays in 'dbo'
    pool: {
      min: env.SYSTEM_DB_POOL_MIN,
      max: env.SYSTEM_DB_POOL_MAX,
      idleTimeoutMillis: env.SYSTEM_DB_POOL_IDLE,
    },
  },

  comsysDb: {
    server: env.COMSYS_DB_SERVER,   // 192.168.50.1
    port: env.COMSYS_DB_PORT,
    database: env.COMSYS_DB_NAME,     // FHtlPTrain
    user: env.COMSYS_DB_USER,
    password: env.COMSYS_DB_PASSWORD,
    encrypt: env.COMSYS_DB_ENCRYPT,
    trustServerCertificate: env.COMSYS_DB_TRUST_CERT,
    pool: {
      min: env.COMSYS_DB_POOL_MIN,
      max: env.COMSYS_DB_POOL_MAX,
      idleTimeoutMillis: env.COMSYS_DB_POOL_IDLE,
    },
  },

  laundryDb: {
    server: process.env.LAUNDRY_DB_SERVER || env.COMSYS_DB_SERVER,
    port: process.env.LAUNDRY_DB_PORT ? parseInt(process.env.LAUNDRY_DB_PORT) : env.COMSYS_DB_PORT,
    database: process.env.LAUNDRY_DB_NAME || 'FhtlPall',
    user: process.env.LAUNDRY_DB_USER || env.COMSYS_DB_USER,
    password: process.env.LAUNDRY_DB_PASSWORD || env.COMSYS_DB_PASSWORD,
    encrypt: process.env.LAUNDRY_DB_ENCRYPT === 'true' || env.COMSYS_DB_ENCRYPT,
    trustServerCertificate: process.env.LAUNDRY_DB_TRUST_CERT === 'true' || env.COMSYS_DB_TRUST_CERT,
    pool: {
      min: process.env.LAUNDRY_DB_POOL_MIN ? parseInt(process.env.LAUNDRY_DB_POOL_MIN) : env.COMSYS_DB_POOL_MIN,
      max: process.env.LAUNDRY_DB_POOL_MAX ? parseInt(process.env.LAUNDRY_DB_POOL_MAX) : env.COMSYS_DB_POOL_MAX,
      idleTimeoutMillis: process.env.LAUNDRY_DB_POOL_IDLE ? parseInt(process.env.LAUNDRY_DB_POOL_IDLE) : env.COMSYS_DB_POOL_IDLE,
    },
  },

  zkDb: {
    server: env.ZK_DB_SERVER,
    port: env.ZK_DB_PORT,
    database: env.ZK_DB_NAME,
    user: env.ZK_DB_USER,
    password: env.ZK_DB_PASSWORD,
    encrypt: env.ZK_DB_ENCRYPT,
    trustServerCertificate: env.ZK_DB_TRUST_CERT,
    deviceIp: env.ZK_DEVICE_IP,
    laundrySensorId: env.ZK_LAUNDRY_SENSOR_ID,
    laundrySn: env.ZK_LAUNDRY_SN,
    pool: {
      min: env.ZK_DB_POOL_MIN,
      max: env.ZK_DB_POOL_MAX,
      idleTimeoutMillis: env.ZK_DB_POOL_IDLE,
    },
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    authMax: env.AUTH_RATE_LIMIT_MAX,
  },

  cache: {
    ttlSeconds: env.CACHE_TTL_SECONDS,
    maxKeys: env.CACHE_MAX_KEYS,
  },

  cors: {
    origin: env.CORS_ORIGIN,
  },

  sync: {
    cronSchedule: env.SYNC_CRON_SCHEDULE,
    enabled: env.SYNC_ENABLED,
  },

  logging: {
    level: env.LOG_LEVEL,
    dir: env.LOG_DIR,
  },

  clientBuildPath: (() => {
    if (env.CLIENT_BUILD_PATH) {
      return path.resolve(process.cwd(), env.CLIENT_BUILD_PATH);
    }
    // Check deploy/app/public
    const deployPublic = path.resolve(__dirname, '../../public');
    if (fs.existsSync(path.join(deployPublic, 'index.html'))) {
      return deployPublic;
    }
    // Check dev dist
    const devDist = path.resolve(__dirname, '../../../dist');
    if (fs.existsSync(path.join(devDist, 'index.html'))) {
      return devDist;
    }
    // Fallback to Royal_inventory/public
    return path.resolve(__dirname, '../../public');
  })(),
};

module.exports = config;
