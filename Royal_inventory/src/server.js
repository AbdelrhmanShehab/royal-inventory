'use strict';

const app = require('./app');
const config = require('./config/index');
const logger = require('./utils/logger');
const { connectSystemDB, closeSystemDB } = require('./config/database');
const { connectComsysDB, closeComsysDB } = require('./config/comsys.database');
const { connectZkDB, closeZkDB } = require('./config/zk.database');

let server;

// ── Background DB Reconnect ───────────────────────────────────────────────────
/**
 * Schedule a background retry to connect SystemDB every 5 seconds.
 * Stops automatically once connected.
 */
const scheduleSystemDBReconnect = () => {
    setTimeout(async () => {
        logger.info('[SystemDB] Attempting reconnect...');
        try {
            await connectSystemDB();
            logger.info('[SystemDB] Reconnected successfully ✅');
        } catch (err) {
            logger.warn('[SystemDB] Reconnect failed — will retry in 5s', { error: err.message });
            scheduleSystemDBReconnect(); // Keep retrying
        }
    }, 5000);
};

// ── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
    try {
        logger.info(`🚀 Starting ${config.app.name} [${config.env}]`);

        // 1. Connect System DB (Optional for exploration - allows app to start even if System DB is not configured)
        try {
            await connectSystemDB();
        } catch (dbErr) {
            logger.warn('[SystemDB] Connection failed - operational database is unavailable', {
                error: dbErr.message,
            });
        }

        // 2. Connect Comsys DB (optional — app starts even if Comsys is down)
        await connectComsysDB();

        // 3. Connect ZK DB (optional — app starts even if ZK is down)
        await connectZkDB();

        // 3. Start HTTP server
        server = app.listen(config.app.port, '0.0.0.0', () => {
            logger.info(`✅ Server listening on port ${config.app.port}`, {
                port: config.app.port,
                apiPrefix: config.app.apiPrefix,
                env: config.env,
            });
            logger.info(`   Health: http://localhost:${config.app.port}/health`);
            logger.info(`   API:    http://localhost:${config.app.port}${config.app.apiPrefix}`);

            // Initialize background cron jobs
            const { initCronJobs } = require('./services/cron.service');
            initCronJobs();
        });

    } catch (err) {
        logger.error('❌ Failed to start server', { error: err.message, stack: err.stack });
        process.exit(1);
    }
};

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
const shutdown = async (signal) => {
    logger.info(`\n[Shutdown] Received ${signal} — shutting down gracefully...`);

    if (server) {
        server.close(async () => {
            logger.info('[Shutdown] HTTP server closed');

            // Stop background cron jobs
            const { stopCronJobs } = require('./services/cron.service');
            stopCronJobs();

            await closeSystemDB();
            await closeComsysDB();
            await closeZkDB();
            logger.info('[Shutdown] Database connections closed. Bye! 👋');
            process.exit(0);
        });

        // Force exit after 10 seconds if graceful shutdown hangs
        setTimeout(() => {
            logger.error('[Shutdown] Forced exit after timeout');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
};

// ── Process Signals ───────────────────────────────────────────────────────────
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Unhandled Rejections ──────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Process] Unhandled Rejection', {
        reason: reason?.message ?? reason,
        stack: reason?.stack,
    });
    // Don't exit — let the error handler deal with it
});

process.on('uncaughtException', (err) => {
    logger.error('[Process] Uncaught Exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
});

// ── Start ─────────────────────────────────────────────────────────────────────
// Trigger restart after env config change
start();
