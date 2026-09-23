'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const fs     = require('fs');
const path   = require('path');
const config = require('../config/index');

const logDir = path.resolve(process.cwd(), config.logging.dir);
try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {
  // Directory already exists or permissions handled
}

// ── Custom log format ─────────────────────────────────────────────────────────
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
      : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  }),
);

// ── Transports ────────────────────────────────────────────────────────────────
const transports = [
  // Console (dev only)
  new winston.transports.Console({
    format: config.isDev ? consoleFormat : logFormat,
    silent: config.isTest,
  }),

  // Combined rotating file
  new DailyRotateFile({
    filename:    path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize:     '20m',
    maxFiles:    '14d',
    format:      logFormat,
  }),

  // Error-only file
  new DailyRotateFile({
    filename:    path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize:     '20m',
    maxFiles:    '30d',
    level:       'error',
    format:      logFormat,
  }),
];

// ── Logger instance ───────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level:       config.logging.level,
  defaultMeta: { service: config.app.name },
  transports,
  exitOnError: false,
});

// ── HTTP request logger (Morgan-compatible stream) ────────────────────────────
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
