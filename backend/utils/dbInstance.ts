import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { log } from "./loggers";
import config from "./config";
import { isShuttingDown } from "./shutdownState";

dotenv.config();

// Connection pool configuration — sized for a payment platform
const poolConfig = {
  max: config.db.poolMax,   // Max connections in pool
  min: config.db.poolMin,     // Min connections in pool
  idle: config.db.poolIdle, // Max idle time (ms) before release
  acquire: 30000,  // Max time (ms) to acquire connection before error
  evict: 1000,     // Check for idle connections every 1s
};

// Retry configuration for TRANSIENT connection errors (Railway PG public-proxy
// drops). Previously this was `{ max: 3 }` with NO `match` list, so it retried
// on EVERY error 3× within the same millisecond (no backoff) — which never rode
// out a multi-second reset and still surfaced a 500 (see memory/REFACTOR_STATUS.md
// §B). We now (a) scope retries to a `match` list of connection-level errors ONLY
// (strictly safer than retrying all errors), and (b) add exponential backoff so an
// idempotent read can survive a brief (~1-3s) single-connection reset.
const retryConfig = {
  max: 4,
  match: [
    // node-postgres / socket-level messages
    /ECONNRESET/,
    /Connection terminated unexpectedly/,
    /Connection terminated due to connection timeout/,
    /server closed the connection unexpectedly/,
    /ETIMEDOUT/,
    /ESOCKETTIMEDOUT/,
    // Sequelize connection error class names
    "SequelizeConnectionError",
    "SequelizeConnectionRefusedError",
    "SequelizeHostNotReachableError",
    "SequelizeConnectionTimedOutError",
    "SequelizeConnectionAcquireTimeoutError",
  ],
  backoffBase: 200, // 1st retry ~200ms, then ~400ms, ~800ms (rides out a brief blip)
  backoffExponent: 2,
};

// SSL + keepAlive for remote PostgreSQL connections (Railway, Heroku, etc.)
const isRemoteDB = !!(config.db.url && config.db.url.includes('railway'));
const isProduction = config.isProduction;
const useSSL = isProduction || isRemoteDB;

const dialectOptions: Record<string, unknown> = {
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
  ...(useSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized: config.db.sslRejectUnauthorized,
    },
  } : {}),
};

const sequelize = config.db.url
  ? new Sequelize(config.db.url, {
      dialect: "postgres",
      dialectOptions,
      logging: isProduction ? false : (msg: string) => log(`[Sequelize] ${msg}`, 'debug'),
      pool: poolConfig,
      retry: retryConfig,
      // Hooks to suppress "connection manager was closed" during shutdown
      hooks: {
        beforeQuery: () => {
          // Reads a standalone flag module — NEVER require('../server') here.
          // server.ts boots at module scope, so requiring it from a per-query
          // hook made any script that touched a model start a SECOND server
          // (EADDRINUSE + alert emails, and duplicated cron/sweep workers when
          // background jobs are on). See utils/shutdownState.ts for the story.
          if (isShuttingDown()) {
            throw new Error('[Sequelize] Query blocked: server is shutting down');
          }
        },
      },
    })
  : new Sequelize(
      config.db.name,
      config.db.user,
      config.db.password,
      {
        host: config.db.host,
        port: config.db.port,
        dialect: "postgres",
        dialectOptions: {
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        },
        logging: false,
        pool: poolConfig,
        retry: retryConfig,
      }
    );

export default sequelize;
