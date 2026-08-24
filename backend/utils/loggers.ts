import { raw as envRaw } from "./config";
import winston from "winston";

const { combine, timestamp, json, prettyPrint, errors, printf } = winston.format;
// colorize import removed - not used

// ============================================
// RAILWAY-COMPATIBLE CONSOLE LOGGER
// Use this for ALL console output to ensure
// consistent formatting across the application
// ============================================

/**
 * Centralized logger for consistent Railway-compatible output
 * All modules should use this instead of console.log
 */
export const log = (message: string, level: 'info' | 'error' | 'warn' | 'debug' = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'debug' ? '🔍' : '✅';
  const output = `[${timestamp}] ${prefix} ${message}`;
  
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
};


// Check if running on Railway or in production
const isRailway = !!envRaw("RAILWAY_ENVIRONMENT");
const isProduction = envRaw("NODE_ENV") === 'production';

// Custom format for Railway - simple, no colors, immediate output
// Uses a circular-safe stringifier: passing objects with circular references
// (e.g. Axios errors that hold a TLSSocket -> HTTPParser -> socket cycle) as log
// meta previously made raw JSON.stringify THROW "Converting circular structure to
// JSON". That throw escaped the calling catch block and crashed request handlers
// (e.g. GET /api/pay/network-fees returned 500). safeStringify never throws.
const safeStringify = (obj: unknown): string => {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
      }
      if (typeof value === "object" && value !== null) {
        if (seen.has(value as object)) return "[Circular]";
        seen.add(value as object);
      }
      return value;
    });
  } catch {
    return "[Unserializable meta]";
  }
};

const railwayFormat = printf(({ level, message, timestamp, service, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${safeStringify(meta)}` : '';
  return `[${timestamp}] [${service}] ${level}: ${message}${metaStr}`;
});

// Create transports based on environment
const createTransports = (logFileName: string) => {
  const transports: winston.transport[] = [
    // Always log to console - this is what Railway captures
    new winston.transports.Console({
      // Use simple format for Railway, pretty for local development
      format: isRailway || isProduction 
        ? combine(timestamp(), railwayFormat)
        : combine(timestamp(), json(), prettyPrint()),
      // Ensure immediate output
      stderrLevels: ['error'],
    }),
  ];

  // Only add file transport in non-Railway environments
  // Railway has ephemeral filesystem, file logs would be lost
  if (!isRailway) {
    transports.push(
      new winston.transports.File({ 
        filename: `logs/${logFileName}`,
        format: combine(timestamp(), json()),
        maxsize: 10 * 1024 * 1024, // 10MB per file — prevents unbounded disk growth
        maxFiles: 5,               // Keep max 5 rotated files (50MB total per logger)
      })
    );
  }

  return transports;
};

// Create logger with consistent configuration
const createLogger = (serviceName: string, logFileName: string) => {
  winston.loggers.add(serviceName, {
    level: isProduction ? 'info' : 'debug',
    format: combine(
      errors({ stack: true }), 
      timestamp(), 
      json()
    ),
    transports: createTransports(logFileName),
    defaultMeta: { service: serviceName },
    // Ensure logs are written immediately
    exitOnError: false,
  });

  return winston.loggers.get(serviceName);
};

// Initialize all loggers
const userLogger = createLogger("userLogger", "userLogs.log");
const walletLogger = createLogger("walletLogger", "walletLogs.log");
const companyLogger = createLogger("companyLogger", "companyLogs.log");
const apiLogger = createLogger("apiLogger", "apiLogs.log");
const adminLogger = createLogger("adminLogger", "adminLogger.log");
const webhookLogs = createLogger("webhookLogs", "webhookLogs.log");
const cronLogger = createLogger("cronLogger", "cronLogger.log");
const taxLogger = createLogger("taxLogger", "taxLogs.log");

// Log startup info
if (isRailway) {
  console.log(`[${new Date().toISOString()}] ✅ Winston loggers initialized for Railway environment`);
} else {
  console.log(`[${new Date().toISOString()}] ✅ Winston loggers initialized (file logging enabled)`);
}

export {
  userLogger,
  walletLogger,
  companyLogger,
  apiLogger,
  adminLogger,
  webhookLogs,
  cronLogger,
  taxLogger,
};
