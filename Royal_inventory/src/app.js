'use strict';

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const cookieParser = require('cookie-parser');
const path        = require('path');
const fs          = require('fs');

const config      = require('./config/index');
const logger      = require('./utils/logger');
const { generalLimiter } = require('./middleware/rateLimiter.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.middleware');
const apiV1Routes = require('./api/v1/index');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const app = express();

// ── Trust proxy (if behind nginx/load balancer) ───────────────────────────────
if (config.isProd) app.set('trust proxy', 1);

// ── Security Headers (Helmet) ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: config.isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "http:", "ws:"],
      upgradeInsecureRequests: null,
    },
  } : false,
  strictTransportSecurity: {
    maxAge: 0, // Immediately clears any previously cached HSTS policy in browsers
  },
  crossOriginEmbedderPolicy: false, // allow embedding for the frontend
  crossOriginResourcePolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin or any origin in local network / dev mode
    callback(null, true);
  },
  credentials: true,             // allow cookies
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
}));

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Static Files (React production build & assets) ───────────────────────────
const clientPath = config.clientBuildPath || path.resolve(__dirname, '../public');
app.use('/', express.static(clientPath, {
  etag: config.isProd,
  maxAge: config.isProd ? '1d' : 0,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── HTTP Request Logging ──────────────────────────────────────────────────────
app.use(morgan(config.isDev ? 'dev' : 'combined', { stream: logger.stream }));

// ── Global Rate Limiter ───────────────────────────────────────────────────────
app.use(config.app.apiPrefix, generalLimiter);

// ── Health Check (no auth, no rate limit) ─────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:  'ok',
    service: config.app.name,
    env:     config.env,
    uptime:  Math.floor(process.uptime()),
    time:    new Date().toISOString(),
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use(config.app.apiPrefix, apiV1Routes);

// ── Swagger Documentation ─────────────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// ── SPA Fallback (Client-side routing for React) ───────────────────────────────
// Any GET request that does not match API, Swagger, or static assets serves index.html
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  if (
    req.path.startsWith(config.app.apiPrefix) ||
    req.path.startsWith('/api-docs') ||
    req.path === '/health'
  ) {
    return next();
  }

  const indexPath = path.join(clientPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(indexPath);
  }
  next();
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global Error Handler (MUST be last) ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
