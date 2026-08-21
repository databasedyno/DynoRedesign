import express from "express";
import { apiLogger } from "./utils/loggers";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import router from "./routes";
import { setupSwagger } from "./swagger";
import sanitizeInputMiddleware from "./middleware/sanitizeInput";
import requestLoggerMiddleware from "./middleware/requestLogger";
import botProtectionMiddleware from "./middleware/botProtection";
import adminAuthMiddleware from "./middleware/adminAuthMiddleware";

// Load environment variables FIRST
dotenv.config();

// Validate environment variables on startup (SECURITY FIX)
import { validateEnvironment } from "./utils/envValidator";
validateEnvironment();

// Redis imports
import { connectRedis, acquireLock, releaseLock, cleanupStaleLocks } from "./utils/redisInstance";
import {
  companyModel,
} from "./models";
// Unused imports removed: currencyConvert, encrypt, sendEmail
import { getErrorMessage } from "./helper";
import { refreshBackgroundRateCache } from "./helper/currencyConvert";
import cron from "node-cron";
import { getTransactionFee, getBlockchainFee } from "./services/feeService";
import { paymentController } from "./controller";
import sequelize from "./utils/dbInstance";
import { setupWeeklySummaryCron, setupWalletReminderCron, setupHealthCheckCron, setupRefereeCodeReminderCron, setupPaymentLinkReminderCron, setupOnboardingMonitorCron, setupFirstPaymentMonitorCron } from "./utils/cronJobs";
import { getOptimizationDiagnostics } from "./services/tronEnergyService";
import { migrateWebhookUrls } from "./services/migrateWebhookUrls";
import { registerAccountProvisioningHooks } from "./services/accountProvisioning";
import { markShuttingDown } from "./utils/shutdownState";
import { processStablecoinConversions, getConversionStats, sendWeeklyConversionSummaries } from "./services/conversionService";
import stablecoinConversionModel from "./models/stablecoinConversionModel";
import { processWebhookRetryQueue } from "./utils/webhookRetry";
import { startWebhookWorker, getQueueHealth, getDLQItems, retryDLQItem, shutdownWebhookQueue, enqueueWebhook } from "./services/webhookQueue";
import { processWebhookJob } from "./services/webhookProcessor";
import { runStartupReconciliation, reconcileFailedStatePayments, clearStaleTatumWebhooks } from "./services/reconciliation";
import { startVolatilityMonitor, getAllMarketStates, runMonitorCycle } from "./services/volatilityMonitorService";
import { startBinanceWebSocket, getStatus as getWsStatus } from "./services/binanceWebSocketService";
import { detectBinanceAccess, forceProxyState, getProxyState } from "./services/binanceService";
import { startTunnelManager } from "./services/sshTunnelManager";
import { getAllFeeRates, getFeeRates } from "./services/feeRateService";
import { captureError, startErrorMonitoring, stopErrorMonitoring, getMonitoringStats, flushErrorDigest, sendErrorDigest } from "./services/errorMonitoringService";
import { startLeaderElection, stopLeaderElection, isLeader, getInstanceId } from "./utils/leaderElection";
import { checkRpcHealth } from "./services/rpcHealthMonitor";
import * as merchantPoolService from "./services/merchantPoolService";
import { sweepExpiredCartOrders } from "./services/orderExpiryService";
import { logStorageStrategyOnStartup } from "./services/gcsAssetService";
import { UPLOAD_ROOT as PRODUCT_UPLOAD_ROOT } from "./middleware/uploadProductAsset";

// ============================================
// RAILWAY LOGGING FIX: Disable output buffering
// This ensures logs appear immediately in Railway's deploy logs
// ============================================
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
// SAFETY: Only run background jobs (cron, sweeps, webhook migration, reconciliation) on production.
// Non-production instances (Emergent preview, local dev) sharing the same DB/Redis can cause:
//   1. Cron jobs competing for locks and executing real financial transactions (sweeps)
//   2. Webhook URL migration overwriting production URLs with dev URLs
//   3. Duplicate email notifications via sweep recovery
// Set ENABLE_BACKGROUND_JOBS=true explicitly to override (e.g., for staging).
const enableBackgroundJobs = process.env.ENABLE_BACKGROUND_JOBS === 'true' || 
  (process.env.ENABLE_BACKGROUND_JOBS !== 'false' && isProduction);

// WORKER_ROLE: Multi-environment isolation for shared DB/Redis setups.
//   'primary'   — Runs all cron jobs, sweeps, and webhook processing (designate ONE environment)
//   'secondary' — API-only, zero cron jobs (safe to run alongside primary)
//   unset       — Legacy behavior, same as 'primary' (backward compatible)
const workerRole = (process.env.WORKER_ROLE || 'primary').toLowerCase();
const isCronEnabled = enableBackgroundJobs && workerRole !== 'secondary';

if (!enableBackgroundJobs) {
  console.warn('⚠️  BACKGROUND JOBS DISABLED — cron jobs, webhook migration, and reconciliation will NOT run on this instance');
  console.warn(`   Reason: ENABLE_BACKGROUND_JOBS=${process.env.ENABLE_BACKGROUND_JOBS || 'not set'}, isProduction=${isProduction}`);
  console.warn('   Set ENABLE_BACKGROUND_JOBS=true in .env to enable on non-production instances');
} else if (workerRole === 'secondary') {
  console.warn('⚠️  WORKER_ROLE=secondary — This instance serves API requests only. Cron jobs, sweeps, and webhook migration are DISABLED.');
  console.warn('   Set WORKER_ROLE=primary on your designated cron runner (e.g., DigitalOcean).');
}
if (isProduction) {
  // Force unbuffered output for Railway
  if (process.stdout.isTTY === false) {
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array, encoding?: BufferEncoding | ((err?: Error) => void), callback?: (err?: Error) => void) => {
      const result = originalWrite(chunk, encoding, callback);
      // Force flush after each write
      if (process.stdout.writable) {
        try {
          (process.stdout as unknown as { _handle?: { flush?: () => void } })._handle?.flush?.();
        } catch (e) {
          // Ignore flush errors
        }
      }
      return result;
    };
  }
}

// Custom logger that ensures Railway visibility
const log = (message: string, level: 'info' | 'error' | 'warn' = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  const output = `[${timestamp}] ${prefix} ${message}`;
  
  if (level === 'error') {
    apiLogger.error(output);
  } else {
    apiLogger.info(output);
  }
};

log('Dynopay Backend Starting...', 'info');
log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'info');
log(`Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'not detected'}`, 'info');
const app = express();
const port = process.env.PORT || 3300;

// Trust proxy — required behind K8s/Nginx so req.ip returns real client IP (critical for rate limiters)
app.set('trust proxy', 1);

// ─── CORS Configuration (Domain Guardrail) ───────────────────────────────────
// A fixed allow-list silently breaks payments the moment a new alias domain is
// added (e.g. dynopay.me). So we ALWAYS validate via a callback that allows:
//   1. Any origin explicitly listed in CORS_ALLOWED_ORIGINS
//   2. The apex OR any subdomain of a "trusted base domain". Trusted base
//      domains are auto-derived from the app's own configured URLs (SERVER_URL /
//      FRONTEND_URL / CHECKOUT_URL / NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL) + the
//      apexes of the explicit list + optional CORS_TRUSTED_DOMAINS. So adding a
//      new DigitalOcean alias domain never breaks CORS again.
//   3. Standard safe infra patterns: localhost, *.preview.emergentagent.com,
//      *.up.railway.app, *.ondigitalocean.app
const explicitOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);
const explicitOriginSet = new Set(explicitOrigins);

// Extract the registrable apex (last two labels, e.g. "dynopay.me") from a URL/host.
const apexOf = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const raw = value.includes('://') ? new URL(value).hostname : value.trim().replace(/^\*?\.?/, '').split('/')[0];
    const cleaned = raw.replace(/^www\./, '').toLowerCase();
    const parts = cleaned.split('.').filter(Boolean);
    if (parts.length < 2) return null;
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
};

// Infra apexes that must NOT be turned into wildcard rules (handled by safePatterns).
const INFRA_APEXES = ['emergentagent.com', 'railway.app', 'ondigitalocean.app', 'localhost'];
const trustedBaseDomains = new Set<string>();
[
  process.env.SERVER_URL,
  process.env.FRONTEND_URL,
  process.env.CHECKOUT_URL,
  process.env.NEXTAUTH_URL,
  process.env.NEXT_PUBLIC_BASE_URL,
  process.env.NEXT_PUBLIC_SERVER_URL,
  ...explicitOrigins,
  ...((process.env.CORS_TRUSTED_DOMAINS || '').split(',')),
].forEach((v) => {
  const apex = apexOf(v);
  if (apex && !INFRA_APEXES.includes(apex)) trustedBaseDomains.add(apex);
});
log(`CORS trusted base domains: ${[...trustedBaseDomains].join(', ') || '(none)'}`, 'info');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const safePatterns: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https:\/\/.*\.preview\.emergentagent\.com$/,
  /^https:\/\/.*\.preview\.emergentcf\.cloud$/,
  /^https:\/\/.*\.emergentcf\.cloud$/,
  /^https:\/\/.*\.up\.railway\.app$/,
  /^https:\/\/.*\.ondigitalocean\.app$/,
  ...[...trustedBaseDomains].map((d) => new RegExp(`^https?:\\/\\/(.*\\.)?${escapeRe(d)}$`)),
];

const corsOriginHandler = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow non-browser / same-origin requests (no Origin header)
  if (!origin) return callback(null, true);
  if (explicitOriginSet.has(origin)) return callback(null, true);
  if (safePatterns.some((p) => p.test(origin))) return callback(null, true);
  // Unknown origin — block. Log at warn (not captureError) to avoid digest spam
  // from bots probing with random origins.
  log(`CORS blocked origin: ${origin}`, 'warn');
  callback(new Error(`CORS: Origin ${origin} not allowed`));
};

app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-ID', 'x-csrf-token']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Body Parser Error Handler ──────────────────────────────────────────────
// Catches malformed JSON (SyntaxError from body-parser) and returns 400 instead of 500
// Still captures the error for monitoring so digest emails include it
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err && (err as any).type === 'entity.parse.failed') {
    // Track in error monitoring (low severity — these are bot/scanner noise)
    captureError(err, 'api', {
      severity: 'low',
      requestContext: `${req.method} ${req.originalUrl}`,
      extraContext: `IP: ${req.ip} | Malformed JSON body`,
    });
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
      statusCode: 400,
    });
  }
  next(err);
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://swagger-ui.netlify.app", "https://files.catbox.moe", "https://cdn-icons-png.flaticon.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Swagger UI assets
}));
// Preflight handler — reuse the same CORS config so OPTIONS responses
// respect the same origin whitelist as actual requests.
//
// EXCEPTION: /api/embed/public/* is called cross-origin from arbitrary merchant
// pages (Buy Button on shop.com etc.). The per-key CORS handler inside that
// router handles OPTIONS itself, reflecting the Origin so the browser preflight
// succeeds. Mount BEFORE the wildcard OPTIONS handler so it wins for its path.
import { publishableKeyRouter, embedPublicRouter } from "./routes/publishableKeyRouter";
app.use("/api/embed/public", embedPublicRouter);

app.options("*", cors({
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-ID', 'x-csrf-token']
}));

// Bot & scanner protection — blocks WordPress/CMS vulnerability scanners early
// Reduces log noise and saves middleware pipeline cycles
app.use(botProtectionMiddleware);

// Request-level logging middleware (response time, correlation ID, method/url/status)
app.use(requestLoggerMiddleware);

// XSS sanitization middleware — strips malicious HTML/JS from all inputs
app.use(sanitizeInputMiddleware);

// CSRF Protection — lightweight double-submit cookie pattern
import cookieParser from "cookie-parser";
import { csrfProtection, generateCsrfToken } from "./middleware/csrfMiddleware";
app.use(cookieParser());
app.use(csrfProtection);

// Static files — served via /api/static prefix so K8s ingress routes to backend (port 8001)
const uploadsPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
app.use("/api/static", express.static("public"));
app.use(express.static("public")); // Keep backward compat for internal access
app.use("/api/static/images", express.static(path.join(uploadsPath, "images")));
app.use("/images", express.static(path.join(uploadsPath, "images")));

// FIX: Fallback for missing images — serve a 1x1 transparent PNG instead of 404
// This prevents noisy 404 logs for deleted/missing user avatars and company logos
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const imageFallbackHandler = (_req: express.Request, res: express.Response) => {
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400"); // Cache 24h to reduce repeat requests
  res.status(200).send(TRANSPARENT_PNG);
};
app.get("/api/static/images/*", imageFallbackHandler);
app.get("/images/*", imageFallbackHandler);
app.use("/api/static/videos", express.static(path.join(uploadsPath, "videos")));
app.use("/videos", express.static(path.join(uploadsPath, "videos")));
// Support-chat attachments (session 14) — uploaded via POST /api/support/chat/upload
app.use(
  "/api/static/support-chat",
  express.static(path.join(uploadsPath, "support-chat"), { dotfiles: "deny", maxAge: "1d" })
);

// Setup Swagger API documentation
setupSwagger(app);

// API Versioning: Mount routes at both /api (backward compat) and /api/v1 (versioned)
// Existing merchants keep using /api/... — no code changes needed
// New integrations can use /api/v1/... for explicit versioning
app.get("/api/csrf-token", generateCsrfToken); // CSRF token endpoint
app.use("/api", router);
app.use("/api/v1", router);

// Diagnostics routes (admin-only — mounted at /api/diagnostics via K8s ingress)
import diagnosticsRouter from "./routes/diagnosticsRouter";
app.use("/api/diagnostics", diagnosticsRouter);

// Ledger admin routes (Tier-1 Item #3 — double-entry ledger)
import ledgerRouter from "./routes/ledgerRouter";
app.use("/api/ledger", ledgerRouter);

// Publishable Keys — dashboard CRUD (JWT). The public /api/embed/public route
// is mounted earlier (before the wildcard OPTIONS handler) so cross-origin
// merchant preflights don't get intercepted by the global CORS handler.
app.use("/api/publishable-keys", publishableKeyRouter);

// Buy Buttons (Phase 2D) — dashboard CRUD (JWT). Buttons are referenced by the
// public /api/embed/public/session flow via `button_id` so amounts can't be
// tampered with client-side.
import { buyButtonRouter } from "./routes/buyButtonRouter";
app.use("/api/buy-buttons", buyButtonRouter);

// Health check endpoint for Railway
app.get("/health", async (_req: express.Request, res: express.Response) => {
  const health: Record<string, unknown> = {
    status: "healthy",
    service: "Dynopay Backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    background_jobs: {
      eligible: isCronEnabled,
      is_leader: isLeader(),
      instance_id: getInstanceId(),
    }
  };
  
  let statusCode = 200;
  
  // Check PostgreSQL
  try {
    await sequelize.authenticate();
    health.database = "connected";
  } catch (error) {
    health.database = "disconnected";
    health.database_error = error.message;
    statusCode = 503;
  }
  
  // Check Redis
  try {
    const { getRedisItem } = require('./utils/redisInstance');
    await getRedisItem('health-check-test');
    health.redis = "connected";
  } catch (error) {
    health.redis = "disconnected";
    health.redis_error = error.message;
    statusCode = 503;
  }
  
  // Check Tatum API (non-blocking)
  try {
    const { TatumCircuitBreaker } = require('./utils/circuitBreaker');
    const breakerStats = TatumCircuitBreaker.getStats();
    health.tatum_api = {
      operational: TatumCircuitBreaker.isOperational(),
      circuit_state: breakerStats.state,
      failures: breakerStats.failures
    };
    if (!TatumCircuitBreaker.isOperational()) {
      health.status = "degraded";
    }
  } catch (error) {
    health.tatum_api = "unknown";
  }
  
  // Check Binance WebSocket
  try {
    const wsStatus = getWsStatus();
    const wsInfo: Record<string, unknown> = {
      connected: wsStatus.connected,
      geo_blocked: wsStatus.geoBlocked,
      cached_prices: wsStatus.cachedPrices,
      cached_klines: wsStatus.cachedKlines,
      last_message_age_ms: wsStatus.lastMessageAge,
      rest_fallback_failures: wsStatus.restFallbackFailures,
    };
    if (wsStatus.geoBlocked) {
      wsInfo.note = "Binance API geo-blocked from this server region. Deploy to a non-US server for full functionality.";
    }
    health.binance_websocket = wsInfo;
    if (!wsStatus.connected && wsStatus.lastMessageAge > 5 * 60 * 1000) {
      health.status = "degraded";
    }
  } catch {
    health.binance_websocket = "unknown";
  }

  // Overall status
  if (statusCode !== 200) {
    health.status = "unhealthy";
  }
  
  res.status(statusCode).json(health);
});

app.get("/", async (_req: express.Request, res: express.Response) => {
  const transaction_fee = await getTransactionFee();
  const blockchain_fee = await getBlockchainFee();

  res.json({
    message: "Dynopay Backend API",
    version: "1.0.0",
    status: "running",
    transaction_fee,
    blockchain_fee,
  });
});

// ─── Fee Optimization Diagnostics (Admin-protected) ──────────────────────────
app.get("/diagnostics/fee-optimization", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const testAddress = req.query.address as string | undefined;
    const diagnostics = await getOptimizationDiagnostics(testAddress);
    res.status(200).json({
      success: true,
      ...diagnostics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

// ─── Webhook URL Migration (Admin-protected) ─────────────────────────────────
app.post("/diagnostics/migrate-webhook-urls", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    log("Admin triggered webhook URL migration", "info");
    const stats = await migrateWebhookUrls();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Stablecoin conversion stats and manual trigger
app.get("/diagnostics/conversion-stats", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const stats = await getConversionStats();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/trigger-conversion", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    log("Admin triggered manual stablecoin conversion cycle", "info");
    const result = await processStablecoinConversions();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Trigger manual sweep for a specific temp address (admin-only)
app.post("/diagnostics/trigger-sweep", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { temp_address_id } = req.body;
    if (!temp_address_id) {
      return res.status(400).json({ success: false, error: "temp_address_id is required" });
    }
    log(`Admin triggered manual sweep for temp_address_id=${temp_address_id}`, "info");
    const { sweepPoolAddress } = await import("./services/merchantPool/merchantPoolSweep");
    const result = await sweepPoolAddress(temp_address_id);
    res.status(200).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ── Manual Payment Recovery ─────────────────────────────────────────────────
// Recovers stuck payments where webhook was received but never processed.
// Sets up the crypto-{address} Redis key and re-enqueues the webhook job.
app.post("/diagnostics/recover-payment", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { temp_address_id, link_id, txId, amount, asset } = req.body;
    if (!temp_address_id || !link_id) {
      return res.status(400).json({ success: false, error: "temp_address_id and link_id are required" });
    }

    const { QueryTypes } = require("sequelize");
    const sequelize = require("./utils/dbInstance").default;
    const { getRedisItem, setRedisItem } = require("./utils/redisInstance");
    const { getCryptoRedisKey } = require("./services/merchantPool/merchantPoolConfig");

    // 1. Fetch temp address from DB
    const [tempAddr] = await sequelize.query(
      `SELECT * FROM tbl_merchant_temp_address WHERE temp_address_id = :tempId`,
      { replacements: { tempId: temp_address_id }, type: QueryTypes.SELECT }
    );
    if (!tempAddr) {
      return res.status(404).json({ success: false, error: "Temp address not found" });
    }

    // 2. Fetch payment link from DB
    const [paymentLink] = await sequelize.query(
      `SELECT * FROM tbl_payment_link WHERE link_id = :linkId`,
      { replacements: { linkId: link_id }, type: QueryTypes.SELECT }
    );
    if (!paymentLink) {
      return res.status(404).json({ success: false, error: "Payment link not found" });
    }

    // 3. Fetch customer Redis data
    const uniqueRef = paymentLink.unique_ref;
    let customerData = await getRedisItem("customer-" + uniqueRef);

    // 4. Build and set crypto-{address} Redis key
    const walletAddress = tempAddr.wallet_address;
    const destTag = tempAddr.destination_tag;
    const cryptoRedisKey = getCryptoRedisKey(walletAddress, destTag);

    const existingCryptoData = await getRedisItem(cryptoRedisKey);
    if (existingCryptoData && Object.keys(existingCryptoData).length > 0 && existingCryptoData.status === "successful") {
      return res.status(409).json({ success: false, error: "Payment already processed", existingData: existingCryptoData });
    }

    const cryptoData = {
      mode: "crypto",
      base_amount_usd: paymentLink.base_amount,
      total_amount_usd: paymentLink.base_amount,
      status: "pending",
      ref: uniqueRef,
      currency: asset || tempAddr.wallet_type,
      payment_id: paymentLink.transaction_id,
      unique_tx_id: paymentLink.transaction_id,
      walletType: "customer",
      temp_id: temp_address_id,
      is_merchant_pool: "true",
      fee_payer: paymentLink.fee_payer || "company",
      company_id: paymentLink.company_id || tempAddr.current_company_id,
      link_id: link_id,
      webhook_url: paymentLink.webhook_url || customerData?.webhook_url || null,
      callback_url: paymentLink.callback_url || customerData?.callback_url || null,
      ...(destTag && { destination_tag: destTag }),
      recovery_origin: "manual_admin_recovery",
      recovered_at: new Date().toISOString(),
    };

    await setRedisItem(cryptoRedisKey, cryptoData);
    log(`[RecoverPayment] Set ${cryptoRedisKey} with payment data for link ${link_id}`, "info");

    // 5. Re-enqueue the webhook if txId is provided
    let jobId = null;
    if (txId) {
      // Clear any "already processed" marker so the webhook can be re-processed
      const processedTxKey = `processed-tx-${txId}`;
      const alreadyProcessed = await getRedisItem(processedTxKey);
      if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
        log(`[RecoverPayment] Clearing processed-tx marker for ${txId}`, "info");
        await setRedisItem(processedTxKey, {});
      }

      const webhookData = {
        payload: {
          address: walletAddress,
          amount: amount || "0",
          txId: txId,
          asset: asset || tempAddr.wallet_type,
        },
        queryParams: {
          company_id: paymentLink.company_id || tempAddr.current_company_id,
          user_id: tempAddr.owner_user_id,
          address_id: temp_address_id,
        },
        receivedAt: new Date().toISOString(),
        source: "reconciliation" as const,
      };

      jobId = await enqueueWebhook(webhookData, { priority: 1, jobId: `recovery-${txId}-${Date.now()}` });
      log(`[RecoverPayment] Re-enqueued webhook job ${jobId} for tx ${txId}`, "info");
    }

    res.status(200).json({
      success: true,
      message: "Recovery initiated",
      details: {
        cryptoRedisKey,
        cryptoDataSet: true,
        webhookJobId: jobId,
        tempAddress: walletAddress,
        linkId: link_id,
        transactionId: paymentLink.transaction_id,
      },
    });
  } catch (error) {
    log(`[RecoverPayment] Error: ${getErrorMessage(error)}`, "error");
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});



// Diagnostics: Binance proxy state
app.get("/diagnostics/binance-proxy", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const proxyState = getProxyState();
    const wsStatus = getWsStatus();
    res.status(200).json({ success: true, proxy: proxyState, websocket: wsStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Force Binance proxy on/off
app.post("/diagnostics/binance-proxy", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ success: false, error: "enabled (boolean) is required" });
    }
    const result = forceProxyState(enabled);
    res.status(200).json({ success: true, message: `Proxy ${enabled ? "ENABLED" : "DISABLED"}`, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});


// Diagnostics: Volatility monitor states
app.get("/api/diagnostics/volatility", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const states = getAllMarketStates();
    const assets = Object.values(states);
    const declining = assets.filter((a) => a.roc30m < -1.5);
    res.status(200).json({
      success: true,
      monitoredAssets: assets.length,
      decliningAssets: declining.length,
      states,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Force volatility monitor cycle
app.post("/api/diagnostics/volatility-refresh", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const results = await runMonitorCycle();
    res.status(200).json({ success: true, refreshed: results.length, states: results });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Live blockchain fee rates
app.get("/api/diagnostics/fee-rates", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const chain = req.query.chain as string;
    if (chain) {
      const rates = await getFeeRates(chain);
      res.status(200).json({ success: true, rates });
    } else {
      const allRates = getAllFeeRates();
      res.status(200).json({ success: true, rates: allRates });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ─── Error Monitoring Diagnostics ────────────────────────────────────────────
app.get("/diagnostics/error-monitor", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const stats = getMonitoringStats();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/error-monitor/flush", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const result = await flushErrorDigest();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/error-monitor/test", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    captureError(new Error("Test error from diagnostics endpoint"), "system", {
      severity: "low",
      requestContext: "POST /diagnostics/error-monitor/test",
      extraContext: "This is a test error to verify the error monitoring pipeline",
    });
    res.status(200).json({ success: true, message: "Test error captured. It will appear in the next digest (or flush now via POST /diagnostics/error-monitor/flush)." });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ── Queue Health Monitoring Endpoints ─────────────────────────────────────────
app.get("/diagnostics/webhook-queue", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const health = await getQueueHealth();
    res.status(200).json({ success: true, queue: health });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.get("/diagnostics/webhook-queue/dlq", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const start = parseInt(req.query.start as string) || 0;
    const end = parseInt(req.query.end as string) || 20;
    const jobs = await getDLQItems(start, end);
    res.status(200).json({
      success: true,
      count: jobs.length,
      items: jobs.map((j) => ({
        id: j.id,
        data: j.data,
        timestamp: j.timestamp,
        failedReason: j.failedReason,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/webhook-queue/dlq/:jobId/retry", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { jobId } = req.params;
    const retried = await retryDLQItem(jobId);
    if (retried) {
      res.status(200).json({ success: true, message: `Job ${jobId} re-queued from DLQ` });
    } else {
      res.status(404).json({ success: false, error: `Job ${jobId} not found in DLQ` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/webhook-queue/reconcile", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const stats = await runStartupReconciliation();
    res.status(200).json({ success: true, reconciliation: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/clear-stale-reconciliation", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const stats = await clearStaleTatumWebhooks();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CRON JOBS — Only run on the elected LEADER instance (see utils/leaderElection.ts)
//
// MULTI-INSTANCE SAFETY: DigitalOcean runs 2 identical instances, both with
// WORKER_ROLE=primary + ENABLE_BACKGROUND_JOBS=true (env vars are app-level).
// Eligible instances compete for a Redis lease; exactly ONE registers/runs these
// cron tasks. On leader death/redeploy a standby is promoted within ~15-60s.
// Per-job locks below remain as a second line of defense during transitions.
// ═══════════════════════════════════════════════════════════════════════════
const leaderCronTasks: ReturnType<typeof cron.schedule>[] = [];
const leaderCron = {
  schedule: (expr: string, fn: Parameters<typeof cron.schedule>[1]) => {
    const task = cron.schedule(expr, fn);
    leaderCronTasks.push(task);
    return task;
  },
};
let cronJobsRegistered = false;

function registerLeaderCronJobs() {
  if (cronJobsRegistered) {
    // Re-promotion after a temporary demotion — restart the previously stopped tasks
    leaderCronTasks.forEach((t) => t.start());
    log(`✅ CRON JOBS RESUMED (re-promoted to leader) — ${leaderCronTasks.length} tasks restarted`, "info");
    return;
  }
  cronJobsRegistered = true;
  log(`✅ CRON JOBS ENABLED — WORKER_ROLE=${workerRole}, leader=${getInstanceId()}, environment=${isProduction ? 'production' : 'dev'}`, "info");

  // RPC Failover Alert — ping every EVM sweep RPC endpoint and alert the moment
  // one goes dead (deduped 1h/endpoint via error-monitor cooldown). Run once now
  // for an immediate baseline, then every 10 minutes.
  checkRpcHealth().catch(() => { /* never throws, but guard anyway */ });
  leaderCron.schedule("*/10 * * * *", async function () {
    await checkRpcHealth();
  });

// OPTIMIZED: Reduced from */30 to every 2h — legacy system, rarely has pending addresses
leaderCron.schedule("0 */2 * * *", async function () {
  const lockAcquired = await acquireLock("cron:checkingUSDT", 300, 1, 100, true);
  if (!lockAcquired) return;
  try {
    log("Cron: USDT check running", "info");
    await paymentController.checkingUSDT();
  } catch (err) {
    log(`Cron: checkingUSDT failed: ${(err as Error).message}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'checkingUSDT' });
  } finally {
    await releaseLock("cron:checkingUSDT");
  }
});

// TATUM CREDIT OPTIMIZATION: Reduced from */15 to */30 — sweeps are rare, 30-min check is safe
leaderCron.schedule("*/30 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:sweepNativeAdminFees", 300, 1, 100, true);
  if (!lockAcquired) return;
  try {
    await paymentController.sweepNativeAdminFees();
  } catch (err) {
    log(`Cron: sweepNativeAdminFees failed: ${(err as Error).message}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'sweepNativeAdminFees' });
  } finally {
    await releaseLock("cron:sweepNativeAdminFees");
  }
});

leaderCron.schedule("*/30 * * * *", async () => {
  const lockAcquired = await acquireLock("cron:processIncompletePayments", 540, 1, 100, true);
  if (!lockAcquired) return; // silent skip
  try {
    await paymentController.processIncompletePayments();
  } finally {
    await releaseLock("cron:processIncompletePayments");
  }
});

// Product Catalog (Phase 1) — Cart-order expiry sweep.
// Every 5 minutes: mark abandoned pending carts as expired + restore stock +
// send buyer-side reminder emails for digital orders whose download links
// are about to expire. See services/orderExpiryService.ts for details.
// SPEC: /app/memory/PRODUCT_CATALOG_SPEC.md §7.5
leaderCron.schedule("*/5 * * * *", async () => {
  const lockAcquired = await acquireLock("cron:expireCartOrders", 240, 1, 100, true);
  if (!lockAcquired) return;
  try {
    const stats = await sweepExpiredCartOrders();
    if (stats.expired > 0 || stats.reminders > 0 || stats.errors > 0) {
      log(
        `Cron: expireCartOrders — expired=${stats.expired}, reminders=${stats.reminders}, errors=${stats.errors}`,
        "info"
      );
    }
  } catch (err) {
    log(`Cron: expireCartOrders failed: ${(err as Error).message}`, "error");
    captureError(err as Error, "cron", { extraContext: "expireCartOrders" });
  } finally {
    await releaseLock("cron:expireCartOrders");
  }
});

// TATUM CREDIT OPTIMIZATION: Reduced from */15 to hourly — fee balance doesn't change rapidly
leaderCron.schedule("0 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:checkFeeBalance", 300, 1, 100, true);
  if (!lockAcquired) return;
  try {
    await paymentController.checkFeeBalance();
  } catch (err) {
    log(`Cron: checkFeeBalance failed: ${(err as Error).message}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'checkFeeBalance' });
  } finally {
    await releaseLock("cron:checkFeeBalance");
  }
});

leaderCron.schedule("0 0 * * *", async function () {
  const lockAcquired = await acquireLock("cron:removeUnwantedSubscriptions", 300, 1, 100, true);
  if (!lockAcquired) return;
  try {
    log("Cron: removeUnwantedSubscriptions running", "info");
    await paymentController.removeUnwantedSubscriptions();
  } catch (err) {
    log(`Cron: removeUnwantedSubscriptions failed: ${(err as Error).message}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'removeUnwantedSubscriptions' });
  } finally {
    await releaseLock("cron:removeUnwantedSubscriptions");
  }
});

// ===========================================
// MERCHANT POOL: Per-merchant pool cron jobs
// ===========================================

// Merchant Pool: Sweep accumulated admin fees every 30 minutes
// Handles both threshold-based ($30 USD) and time-based (3 min for ETH/TRX) sweeps
// TATUM CREDIT OPTIMIZATION: Reduced from 15min to 30min — idle system rarely accumulates fees
leaderCron.schedule("*/30 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:performScheduledSweeps", 180, 1, 100, true);
  if (!lockAcquired) return; // silent skip — lock contention is normal
  try {
    await merchantPoolService.performScheduledSweeps();
  } catch (err) {
    log(`Cron: Sweep failed, will retry next cycle: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'performScheduledSweeps' });
  } finally {
    await releaseLock("cron:performScheduledSweeps");
  }
});

// Merchant Pool: Release expired reservations every 15 minutes
// PERF: Increased from 5min to 15min — reservations have 30min TTL, 15min check is safe
leaderCron.schedule("*/15 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:releaseExpiredReservations", 120, 1, 100, true);
  if (!lockAcquired) return;
  try {
    await merchantPoolService.releaseExpiredReservations();
  } catch (err) {
    const errMsg = (err as Error).message || '';
    // Retry once for transient connection errors
    if (errMsg.includes('Connection terminated') || errMsg.includes('ECONNRESET') || errMsg.includes('ETIMEDOUT')) {
      log(`Cron: Release expired hit transient DB error (${errMsg}), retrying in 5s...`, "error");
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        await merchantPoolService.releaseExpiredReservations();
        log("Cron: Release expired retry succeeded", "info");
      } catch (retryErr) {
        log(`Cron: Release expired retry also failed: ${(retryErr as Error).message}`, "error");
        captureError(retryErr as Error, 'cron', { extraContext: 'releaseExpiredReservations_retry' });
      }
    } else {
      log(`Cron: Release expired failed, will retry next cycle: ${errMsg}`, "error");
      captureError(err as Error, 'cron', { extraContext: 'releaseExpiredReservations' });
    }
  } finally {
    await releaseLock("cron:releaseExpiredReservations");
  }
});

// Merchant Pool: Cleanup stuck addresses every 15 minutes (safety net)
leaderCron.schedule("*/15 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:cleanupStaleAddresses", 120, 1, 100, true);
  if (!lockAcquired) return;
  try {
    await merchantPoolService.cleanupStaleAddresses();
  } catch (err) {
    log(`Cron: cleanupStaleAddresses failed: ${(err as Error).message}`, "error");
  } finally {
    await releaseLock("cron:cleanupStaleAddresses");
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PERF FIX 3: Pre-warm address pool every 2 minutes
// Ensures each active merchant has PRE_RESERVED addresses ready for instant reservation
// This moves ~400-600ms of lock+transaction+findOne off the payment creation critical path
// ═══════════════════════════════════════════════════════════════════════
leaderCron.schedule("*/2 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:preWarmAddressPool", 120, 1, 100, true);
  if (!lockAcquired) return;
  try {
    await merchantPoolService.preWarmAddressPool();
  } catch (err) {
    const errMsg = getErrorMessage(err);
    log(`Cron: preWarmAddressPool failed: ${errMsg}`, "error");
  } finally {
    await releaseLock("cron:preWarmAddressPool");
  }
});

// Merchant Pool: Subscription health monitor every 6 hours
// Ensures all pool addresses have valid Tatum webhook subscriptions
// TATUM CREDIT OPTIMIZATION: Reduced from 2h to 6h — subscriptions rarely break on their own
leaderCron.schedule("0 */6 * * *", async function () {
  const lockAcquired = await acquireLock("cron:ensurePoolSubscriptions", 600, 1, 100, true);
  if (!lockAcquired) return;
  try {
    log("Cron: ensurePoolSubscriptions running", "info");
    await merchantPoolService.ensurePoolSubscriptions();
  } catch (err) {
    log(`Cron: Subscription health check failed: ${(err as Error).message}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'ensurePoolSubscriptions' });
  } finally {
    await releaseLock("cron:ensurePoolSubscriptions");
  }
});

// Merchant Pool: Check for missed webhooks every hour
// This is a fallback mechanism when Tatum webhooks fail to deliver
// TATUM CREDIT OPTIMIZATION: Reduced from 20min to hourly — saves ~3x API calls
leaderCron.schedule("0 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:checkMissedPayments", 600, 1, 100, true);
  if (!lockAcquired) return; // silent skip
  try {
    await merchantPoolService.checkMissedPayments();
  } catch (err) {
    log(`Cron: Missed payments check failed: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'checkMissedPayments' });
  } finally {
    await releaseLock("cron:checkMissedPayments");
  }
});

// Detect orphan payments on AVAILABLE addresses (every 6 hours)
// Safety net: catches payments sent AFTER reservation expired and address was released
// Uses saved last_payment_context for proper merchant/admin fee split
// TATUM CREDIT OPTIMIZATION: Reduced from hourly to every 6h — was the #1 Tatum credit consumer
leaderCron.schedule("0 */6 * * *", async function () {
  // FIX: Increased lock TTL from 900s to 1800s (30 min) — scanning 158+ addresses can take 10+ min with API latency
  const lockAcquired = await acquireLock("cron:detectOrphanPayments", 1800, 1, 100, true);
  if (!lockAcquired) { log("Cron: detectOrphanPayments skipped (already running)", "info"); return; }
  try {
    log("Cron: detectOrphanPayments running", "info");
    await merchantPoolService.detectOrphanPayments();
  } catch (err) {
    log(`Cron: Orphan payment detection failed: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'detectOrphanPayments' });
  } finally {
    await releaseLock("cron:detectOrphanPayments");
  }
});

// Merchant Pool: Pre-warm pool addresses every 30 minutes
// Ensures each active merchant has AVAILABLE addresses ready for instant reservation
// Eliminates ~3-4s Tatum API call bottleneck during payment creation
// TATUM CREDIT OPTIMIZATION: Reduced from 15min to 30min — pool rarely needs new addresses
leaderCron.schedule("*/30 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:prewarmPoolAddresses", 300, 1, 100, true);
  if (!lockAcquired) return;
  try {
    await merchantPoolService.prewarmPoolAddresses();
    // Also retry any RLUSD addresses with pending trust lines
    await merchantPoolService.retryPendingTrustLines();
  } catch (err) {
    log(`Cron: Pool pre-warming failed: ${(err as Error).message}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'prewarmPoolAddresses' });
  } finally {
    await releaseLock("cron:prewarmPoolAddresses");
  }
});

// Setup weekly summary cron job (every Monday at 9:00 AM UTC)
setupWeeklySummaryCron();

// Volume-based fee tier reconciliation (daily at 3:00 AM UTC).
// Auto-upgrades/downgrades merchants based on their all-time confirmed USD volume.
// Sends "your fees just dropped" email on upgrade; downgrades are silent (updated
// silently in DB — the dashboard widget will reflect the new tier on next load).
leaderCron.schedule("0 3 * * *", async function () {
  const lockAcquired = await acquireLock("cron:volumeTierReconciliation", 900, 1, 100, true);
  if (!lockAcquired) { log("Cron: volumeTierReconciliation skipped (already running)", "info"); return; }
  try {
    log("Cron: volumeTierReconciliation running", "info");
    const { reconcileVolumeTiers } = await import("./services/volumeTierReconciliation");
    const stats = await reconcileVolumeTiers();
    log(`Cron: Volume-tier reconciliation complete — upgraded=${stats.upgraded}, downgraded=${stats.downgraded}, unchanged=${stats.unchanged}, skipped=${stats.skipped}`, "info");
  } catch (err) {
    log(`Cron: Volume-tier reconciliation failed: ${(err as Error).message}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'volumeTierReconciliation' });
  } finally {
    await releaseLock("cron:volumeTierReconciliation");
  }
});
log("Volume-tier reconciliation cron scheduled (daily at 3:00 AM UTC)", "info");

// Weekly conversion summary email (every Monday at 9:30 AM UTC)
leaderCron.schedule("30 9 * * 1", async function () {
  const lockAcquired = await acquireLock("cron:weeklyConversionSummary", 600, 1, 100, true);
  if (!lockAcquired) { log("Cron: weeklyConversionSummary skipped (already running)", "info"); return; }
  try {
    log("Cron: sendWeeklyConversionSummaries running", "info");
    const sent = await sendWeeklyConversionSummaries();
    log(`Cron: Weekly conversion summaries sent: ${sent}`, "info");
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Weekly conversion summary failed: ${errMsg}`, "error");
  } finally {
    await releaseLock("cron:weeklyConversionSummary");
  }
});
log("Weekly Conversion Summary Cron Job scheduled for every Monday at 9:30 AM UTC", "info");

// Weekly payout digest email (every Sunday at 8:00 AM UTC).
// Coinbase-style richer summary — settled volume, fees paid, top coins, delta.
// Guarded by leaderCron so preview / secondary workers never fire it.
leaderCron.schedule("0 8 * * 0", async function () {
  const lockAcquired = await acquireLock("cron:payoutDigest", 900, 1, 100, true);
  if (!lockAcquired) { log("Cron: payoutDigest skipped (already running)", "info"); return; }
  try {
    log("Cron: sendPayoutDigestsToAll running", "info");
    const { sendPayoutDigestsToAll } = await import("./services/payoutDigestService");
    const stats = await sendPayoutDigestsToAll();
    log(`Cron: Payout digests — attempted=${stats.attempted}, sent=${stats.sent}, skipped=${stats.skipped}`, "info");
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Payout digest failed: ${errMsg}`, "error");
    captureError(err as Error, 'cron', { extraContext: 'payoutDigest' });
  } finally {
    await releaseLock("cron:payoutDigest");
  }
});
log("Payout Digest Cron Job scheduled for every Sunday at 8:00 AM UTC", "info");

// Setup wallet reminder cron job (every hour for users without wallets after 24h)
setupWalletReminderCron();

// Setup infrastructure health check cron job (every 5 minutes)
setupHealthCheckCron();

// Setup referee code reminder cron job (daily at 10 AM UTC)
setupRefereeCodeReminderCron();

// Setup payment link reminder cron job (every hour)
setupPaymentLinkReminderCron();

// Onboarding monitor — detects stuck/completed users, emails admin (A + B)
setupOnboardingMonitorCron();

// First payment monitor — detects merchants' first successful payment, emails admin (C)
setupFirstPaymentMonitorCron();

// ═══════════════════════════════════════════════════════════════════════
// RELIABILITY: Payment Watchdog — detect stuck payments every 2 minutes
// ═══════════════════════════════════════════════════════════════════════
leaderCron.schedule("*/2 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:paymentWatchdog", 90, 1, 100, true);
  if (!lockAcquired) return;
  try {
    const { watchdogCheck } = await import("./services/paymentReliability");
    await watchdogCheck();
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Payment watchdog failed: ${errMsg}`, "error");
  } finally {
    await releaseLock("cron:paymentWatchdog");
  }
});

// Stablecoin Conversion: Process pending conversions via Binance
// Runs every N minutes (configurable via BINANCE_CONVERT_INTERVAL_MINUTES)
const convertIntervalMinutes = Math.max(parseInt(process.env.BINANCE_CONVERT_INTERVAL_MINUTES || "10") || 10, 1);
leaderCron.schedule(`*/${convertIntervalMinutes} * * * *`, async function () {
  const lockAcquired = await acquireLock("cron:stablecoinConversion", 240, 1, 100, true);
  if (!lockAcquired) { log("Cron: stablecoinConversion skipped (already running)", "info"); return; }
  try {
    // Quiet mode: only log start when there's potential work (logged inside service)
    // Add timeout to prevent hanging indefinitely
    const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Stablecoin conversion timed out after 210s')), 210000));
    await Promise.race([processStablecoinConversions(), timeout]);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Stablecoin conversion failed: ${errMsg}`, "error");
  } finally {
    await releaseLock("cron:stablecoinConversion");
  }
});

// Webhook Retry Queue: Process failed webhooks with exponential backoff
// PERF: Increased from 2min to 10min — queue is almost always empty
leaderCron.schedule("*/10 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:webhookRetryQueue", 120, 1, 100, true);
  if (!lockAcquired) return;
  try {
    const stats = await processWebhookRetryQueue();
    if (stats.processed > 0) {
      log(`Cron: Webhook retries - ${stats.succeeded} succeeded, ${stats.failed} failed`, "info");
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Webhook retry queue failed: ${errMsg}`, "error");
  } finally {
    await releaseLock("cron:webhookRetryQueue");
  }
});

// ═══════════════════════════════════════════════════════════════════════
// RELIABILITY: Periodic deferred-settlement recovery — every 10 minutes.
//
// Re-settles payments that were received on-chain but whose settlement was
// DEFERRED (status "failed" / "gas_pending"), e.g. after the TRX fee wallet
// ran dry ("Fee wallet critically low"). Reuses the exact same idempotent
// Strategy-4 scan that runStartupReconciliation() runs on boot — so a deferred
// payment now auto-heals within ~10 min of the fee wallet being topped up,
// WITHOUT requiring an app redeploy. Re-queues carry source:"reconciliation",
// which clears the stale processed-tx dedup key and resets failed→pending.
//
// Cheap: Redis scan only (no Tatum API), on-chain verify only when retryCount>=2,
// respects the 7-day age window + 5-retry cap + 5-min MIN_AGE guard. Per-job
// lock + settlement idempotency guards prevent any double-settlement.
// ═══════════════════════════════════════════════════════════════════════
leaderCron.schedule("*/10 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:reconcileDeferredPayments", 300, 1, 100, true);
  if (!lockAcquired) return; // silent skip — lock contention is normal
  try {
    const requeued = await reconcileFailedStatePayments();
    if (requeued > 0) {
      log(`Cron: reconcileDeferredPayments re-queued ${requeued} deferred/failed settlement(s) for retry`, "info");
    }
  } catch (err) {
    log(`Cron: reconcileDeferredPayments failed: ${(err as Error).message}`, "error");
    captureError(err as Error, "cron", { extraContext: "reconcileDeferredPayments" });
  } finally {
    await releaseLock("cron:reconcileDeferredPayments");
  }
});

} // end registerLeaderCronJobs()

// Called when this instance loses the leader lease (rare — Redis flap or lease steal).
// Stops all leader cron tasks; they restart if/when we are re-promoted.
function pauseLeaderCronJobs() {
  leaderCronTasks.forEach((t) => t.stop());
  log(`⚠️  CRON JOBS PAUSED (leadership lost) — ${leaderCronTasks.length} tasks stopped on ${getInstanceId()}`, "warn");
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADER-ONLY SERVICES — started once when this instance is first promoted.
// NOT stopped on demotion (rare Redis-flap scenario): the BullMQ worker is a
// proper queue consumer (safe with overlapping consumers) and error/fee-wallet
// monitoring are read-mostly; one-shot migrations/reconciliations have already
// completed by then. Cron tasks (the destructive part) DO pause on demotion.
// ═══════════════════════════════════════════════════════════════════════════
let leaderServicesStarted = false;

function startLeaderOnlyServices() {
  if (leaderServicesStarted) return;
  leaderServicesStarted = true;

  // Error monitoring (sends admin digest every 15 min when errors exist)
  startErrorMonitoring();

  // Fee wallet monitoring (checks TRX balance every 30min)
  import("./services/feeWalletMonitor")
    .then(({ startFeeWalletMonitoring }) => {
      startFeeWalletMonitoring(30);
      log("✅ Fee wallet monitoring started", "info");
    })
    .catch((err) => log(`⚠️ Fee wallet monitoring failed: ${err}`, 'warn'));

  // Migrate stale webhook URLs from previous deployments (one-shot)
  migrateWebhookUrls()
    .then(stats => {
      log(`Webhook URL migration complete: ${stats.updated} updated, ${stats.alreadyCorrect} already correct, ${stats.errors} errors (of ${stats.total} total)`, "info");
    })
    .catch(err => {
      log(`Webhook URL migration failed: ${err.message}`, "error");
    });

  // BullMQ webhook worker — consumes the shared "tatum-webhooks" queue
  try {
    startWebhookWorker(processWebhookJob);
    log('BullMQ webhook worker started (concurrency: 5)', 'info');
  } catch (workerErr) {
    log(`BullMQ webhook worker failed to start: ${(workerErr as Error).message}`, 'error');
  }

  // Fee-free balance reconciliation (corrects users with $500+ volume)
  import("./services/feeFreeReconciliation")
    .then(({ reconcileFeeFreeBalances }) => reconcileFeeFreeBalances())
    .catch(err => log(`⚠️ Fee-free reconciliation failed: ${(err as Error).message}`, 'warn'));

  // Startup reconciliation (catch missed webhooks during downtime)
  runStartupReconciliation()
    .then(stats => {
      const total = stats.stuckPayments + stats.failedPayments + stats.failedStatePayments + stats.bullmqFailedJobs + stats.tatumMissed;
      log(`Reconciliation complete: ${total} items re-queued (stuck=${stats.stuckPayments}, failed=${stats.failedPayments}, failedState=${stats.failedStatePayments}, bullmq=${stats.bullmqFailedJobs}, tatum=${stats.tatumMissed})`, 'info');
      if (stats.errors.length > 0) {
        log(`Reconciliation warnings: ${stats.errors.join('; ')}`, 'warn');
      }
    })
    .catch(err => {
      log(`Reconciliation failed: ${(err as Error).message}`, 'error');
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// ALWAYS-ON: Background rate cache refresh (not destructive, needed for conversions)
// Runs regardless of ENABLE_BACKGROUND_JOBS to prevent currency conversion failures
// ═══════════════════════════════════════════════════════════════════════════
cron.schedule("*/10 * * * *", function () {
  refreshBackgroundRateCache().catch(err => {
    log(`Cron: Background rate cache refresh failed: ${err.message}`, "error");
  });
});

// HTTP server instance — captured so graceful shutdown can stop accepting new
// requests (and fail the health check) BEFORE tearing down the worker/DB. This
// prevents a deploy/restart from accepting a webhook and then dropping it mid-shutdown.
let httpServer: import("http").Server | null = null;

const startServer = async () => {
  log('Connecting to Redis...', 'info');
  await connectRedis();
  log('Redis connected successfully', 'info');
  
  // Clean up stale locks from dead processes (prevents "stuck cron" after unclean restart)
  await cleanupStaleLocks();
  
  try {
    log('Connecting to PostgreSQL...', 'info');
    await sequelize.authenticate();
    log('PostgreSQL Connection has been established successfully.', 'info');

    // Product Catalog storage strategy sanity log (spec §9)
    try {
      logStorageStrategyOnStartup(PRODUCT_UPLOAD_ROOT);
    } catch (e: any) {
      // Non-fatal: never let a diagnostic log block startup.
      log(`[storage] strategy log failed: ${e?.message || e}`, "warn");
    }
    
    // Sync Merchant Pool models (per-merchant system for ALL chains including USDT)
    // OPTIMIZED: Use alter:true only in development — production should use migrations
    const syncOptions = isProduction ? {} : { alter: true };
    
    // OPTIMIZED: Single consolidated import instead of 3 separate await import("./models") calls
    const {
      merchantWalletModel,
      merchantTempAddressModel,
      merchantPoolTransactionModel,
      merchantPoolSweepModel,
      referralModel,
      referralRewardModel,
      kbCategoryModel,
      kbArticleModel,
      supportChatMessageModel,
      refereeCodeModel,
      userModel,
    } = await import("./models");
    
    await merchantWalletModel.sync(syncOptions);
    await merchantTempAddressModel.sync(syncOptions);
    await merchantPoolTransactionModel.sync(syncOptions);
    await merchantPoolSweepModel.sync(syncOptions);
    log(`Merchant Pool tables synced successfully${isProduction ? ' (no-alter)' : ' (alter)' }.`, 'info');
    
    // Sync Referral models
    await referralModel.sync(syncOptions);
    await referralRewardModel.sync(syncOptions);
    log('Referral tables synced successfully.', 'info');
    
    // Sync Referee Code model
    await refereeCodeModel.sync(syncOptions);
    log('Referee Code table synced successfully.', 'info');
    
    // Sync Knowledge Base models
    await kbCategoryModel.sync(syncOptions);
    await kbArticleModel.sync(syncOptions);
    log('Knowledge Base tables synced successfully.', 'info');

    // Sync AI Support Chat model
    await supportChatMessageModel.sync(syncOptions);
    log('Support Chat table synced successfully.', 'info');
    
    // Sync user model to add referral columns
    await userModel.sync(syncOptions);
    log('User model synced with referral columns.', 'info');

    // Sync onboarding analytics table
    const { onboardingEventModel } = await import("./models");
    await onboardingEventModel.sync(syncOptions);
    log('Onboarding analytics table synced successfully.', 'info');

    // Sync self-transaction table (dashboard / analytics endpoints query it)
    const { selfTransactionModel } = await import("./models/userModels");
    await selfTransactionModel.sync(syncOptions);
    log('Self-transaction table synced successfully.', 'info');

    // Sync login activity table
    const { loginActivityModel } = await import("./models");
    await loginActivityModel.sync(syncOptions);
    log('Login activity table synced successfully.', 'info');
    
    // One-time migration: shorten old long referral codes (DYNO2026XXXYYY → DYNO-XXXXXX)
    try {
      const crypto = await import('crypto');
      const usersWithLongCodes = await userModel.findAll({
        where: sequelize.literal("LENGTH(referral_code) > 12"),
      });
      if (usersWithLongCodes.length > 0) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (const user of usersWithLongCodes) {
          let newCode: string;
          let isUnique = false;
          while (!isUnique) {
            let code = '';
            const bytes = crypto.randomBytes(6);
            for (let i = 0; i < 6; i++) {
              code += chars[bytes[i] % chars.length];
            }
            newCode = `DYNO-${code}`;
            const existing = await userModel.findOne({ where: { referral_code: newCode } });
            if (!existing) isUnique = true;
          }
          await userModel.update(
            { referral_code: newCode! },
            { where: { user_id: (user as any).dataValues.user_id } }
          );
        }
        log(`Migrated ${usersWithLongCodes.length} referral codes to short format.`, 'info');
      }
    } catch (migErr: any) {
      log(`Referral code migration skipped: ${migErr.message}`, 'info');
    }
    
    // Sync stablecoin conversion model
    await stablecoinConversionModel.sync(syncOptions);
    log('Stablecoin conversion table synced.', 'info');
    
    // Sync push subscription model (Web Push)
    const { default: pushSubscriptionModel } = await import("./models/pushSubscriptionModel");
    await pushSubscriptionModel.sync(syncOptions);
    log('Push subscription table synced.', 'info');
    
    // Sync Payment Journal model (reliability layer)
    try {
      const { initPaymentJournal } = await import("./services/paymentReliability");
      await initPaymentJournal();
      log('Payment Journal table synced.', 'info');
    } catch (journalErr: any) {
      log(`Payment Journal sync failed (non-critical): ${journalErr.message}`, 'warn');
    }

    // Ledger bootstrap (Tier-1 Item #3 — double-entry ledger).
    // Gated by ENABLE_LEDGER — safe defaults (off) preserve current behavior.
    try {
      const { initLedger } = await import("./services/ledger/ledgerBootstrap");
      const ledgerState = await initLedger();
      log(`Ledger bootstrap: enabled=${ledgerState.enabled} dualWrite=${ledgerState.dualWrite} invariantCron=${ledgerState.invariantCron}`, 'info');
    } catch (ledgerErr: any) {
      log(`Ledger bootstrap failed (non-critical): ${ledgerErr.message}`, 'warn');
    }
    
    // Sync company model (for auto-convert fields)
    await companyModel.sync(syncOptions);
    log('Company model synced with auto-convert fields.', 'info');
    
    // Validate Merchant Pool Configuration (CRITICAL STARTUP CHECK)
    // Can be disabled with SKIP_MERCHANT_POOL_VALIDATION=true for testing/development
    const skipValidation = process.env.SKIP_MERCHANT_POOL_VALIDATION === 'true';
    
    try {
      log('Validating Merchant Pool configuration...', 'info');
      const validateMerchantPoolConfiguration = (await import("./services/merchantPoolValidator")).default;
      await validateMerchantPoolConfiguration();
      log('Merchant Pool configuration validated successfully', 'info');
    } catch (validationError: unknown) {
      log('MERCHANT POOL CONFIGURATION VALIDATION FAILED', 'error');
      const errMsg = validationError instanceof Error ? validationError.message : String(validationError);
      
      if (skipValidation) {
        log(`⚠️  WARNING: Validation failed but SKIP_MERCHANT_POOL_VALIDATION=true`, 'warn');
        log(`⚠️  Configuration error: ${errMsg}`, 'warn');
        log('⚠️  Server starting anyway - Merchant Pool features may not work correctly', 'warn');
      } else {
        log(`Server cannot start with invalid configuration: ${errMsg}`, 'error');
        log('💡 Tip: Set SKIP_MERCHANT_POOL_VALIDATION=true to bypass this check for testing', 'info');
        process.exit(1); // Exit server - don't start with bad config
      }
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log(`PostgreSQL Unable to connect to the database: ${errMsg}`, 'error');
  }
  httpServer = app.listen(port, () => {
    log(`🚀 Server is listening on port ${port}!`, 'info');
    log(`📚 Swagger docs available at /api/docs`, 'info');
    log(`❤️ Health check available at /health`, 'info');

    // Every new user gets a personal Account (tbl_company, account_type
    // 'individual') so company-scoped features — invoices, customers, webhooks,
    // API usage — work for individual creators too. Installed as a single
    // userModel.afterCreate hook because FIVE different controller paths create
    // users. Runs on transaction.afterCommit, so it can never fail a signup.
    // Disable with AUTO_PROVISION_PERSONAL_ACCOUNT=false.
    // See docs/IA_AUDIT_2026-08.md §1.
    registerAccountProvisioningHooks();

    // Pre-populate background rate cache on startup (so first payment has fallback rates)
    refreshBackgroundRateCache().catch(err => {
      log(`Initial rate cache population failed: ${err.message}`, "error");
    });

    // Start SSH tunnel manager (auto-reconnect for Binance SOCKS5 proxy)
    // Must start BEFORE detectBinanceAccess so the tunnel is available for probe
    startTunnelManager();

    // Wait for SSH tunnel to come up (takes ~3-5s) before probing Binance access.
    // This prevents the race condition where proxy detection fails because the
    // tunnel isn't ready yet, causing the WebSocket to start without proxy.
    const tunnelWaitMs = process.env.SSH_TUNNEL_HOST ? 6000 : 0;
    setTimeout(() => {
      detectBinanceAccess().then(() => {
        startBinanceWebSocket();
      }).catch(err => {
        log(`Binance access detection failed: ${err.message}, starting WebSocket anyway`, "error");
        startBinanceWebSocket();
      });
    }, tunnelWaitMs);

    // Start volatility monitor (now reads from WebSocket cache — zero REST calls)
    startVolatilityMonitor();

    // ── Leader-only services + cron jobs (multi-instance safe) ───────────────
    // SAFETY: With 2 DO instances both running WORKER_ROLE=primary, these must
    // only run on ONE instance. Leader election (Redis lease) picks exactly one;
    // standby takes over automatically on leader death/redeploy.
    //   - error digest monitoring (would double-spam admin emails)
    //   - fee wallet monitoring (duplicate low-balance alerts)
    //   - webhook URL migration (one-shot, racing writes)
    //   - BullMQ webhook worker (both consumed the shared queue)
    //   - startup + fee-free reconciliation (duplicate re-queues)
    if (isCronEnabled) {
      startLeaderElection({
        onPromoted: () => {
          registerLeaderCronJobs();
          startLeaderOnlyServices();
        },
        onDemoted: () => {
          // Cron tasks stop; BullMQ worker + error monitoring keep running
          // (queue-based / low-risk — see notes in startLeaderOnlyServices).
          pauseLeaderCronJobs();
        },
      });
    } else {
      log('⚠️  Skipping error digest monitoring (background jobs disabled)', 'warn');
      log('⚠️  Skipping webhook URL migration (background jobs disabled)', 'warn');
      log('⚠️  Skipping BullMQ webhook worker (background jobs disabled — secondary instance)', 'warn');
      log('⚠️  Skipping startup reconciliation (background jobs disabled)', 'warn');
    }

    // ── Fix legacy wallet currency_type (one-time data correction) ────────────
    // Some wallets were created with currency_type='FIAT' despite being crypto wallets.
    // This corrects them by checking wallet_type against known crypto types.
    const CRYPTO_WALLET_TYPES = [
      'BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'SOL', 'XRP', 'TRX',
      'USDT-ERC20', 'USDT-TRC20', 'USDC-ERC20', 'USDT-POLYGON',
      'POLYGON', 'RLUSD', 'RLUSD-ERC20',
    ];
    sequelize.query(
      `UPDATE tbl_user_wallet SET currency_type = 'CRYPTO' WHERE wallet_type IN (:cryptoTypes) AND currency_type = 'FIAT'`,
      { replacements: { cryptoTypes: CRYPTO_WALLET_TYPES } }
    ).then((result: any) => {
      const count = Array.isArray(result) ? result[1] : result;
      if (count > 0) log(`Fixed ${count} wallet(s) with incorrect currency_type (FIAT→CRYPTO)`, 'info');
    }).catch((err: Error) => {
      log(`Wallet currency_type fix failed: ${err.message}`, 'warn');
    });

  });

  // ─── Global Error Handler (must be AFTER all routes) ─────────────────────────
  // Catches unhandled errors in route handlers and prevents stack trace leakage
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    log(`[GlobalErrorHandler] Unhandled error: ${err.message}${!isProduction ? `\n${err.stack}` : ''}`, 'error');
    captureError(err, 'api', {
      severity: 'high',
      requestContext: `${_req.method} ${_req.originalUrl}`,
      extraContext: `IP: ${_req.ip} | Body keys: ${Object.keys(_req.body || {}).join(', ') || 'none'}`,
    });
    res.status(500).json({
      success: false,
      message: isProduction ? 'Internal server error' : err.message,
      statusCode: 500,
    });
  });
};

startServer();

// ─── Shutdown State ──────────────────────────────────────────────────────────
// Exported flag so cron jobs and services can check before starting new work
export let isShuttingDown = false;

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
// ORDER: 1) Stop accepting work → 2) Wait for in-flight ops → 3) Close connections
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return; // Prevent double shutdown
  isShuttingDown = true;
  // Also publish the flag on the standalone module that utils/dbInstance reads,
  // so Sequelize can stop issuing queries WITHOUT dbInstance having to
  // require('../server') on every query (that cycle used to boot a second
  // server from any script that touched a model — see utils/shutdownState.ts).
  markShuttingDown();
  log(`Received ${signal}. Starting graceful shutdown...`, 'warn');

  // 0a. Release the background-jobs leadership lease FIRST so the surviving
  //     instance can promote within ~15s (instead of waiting the full 60s TTL).
  try {
    await stopLeaderElection();
  } catch (err) {
    log(`Error releasing leadership lease: ${err}`, 'error');
  }

  // 0. Stop accepting NEW HTTP requests first (fails health check → platform stops routing;
  //    lets in-flight requests finish). Bounded so lingering keep-alive conns can't hang the
  //    shutdown past the platform's SIGTERM→SIGKILL grace window.
  if (httpServer) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5000);
      httpServer!.close(() => { clearTimeout(timer); resolve(); });
    });
    log('HTTP server closed (no longer accepting new requests).', 'info');
  }

  // 1. Destroy all cron jobs so no new DB/Redis work is scheduled
  const cronTasks = cron.getTasks();
  cronTasks.forEach((task) => task.stop());
  log(`Stopped ${cronTasks.size} cron tasks.`, 'info');

  // 2. Flush error monitoring (uses Redis, not Sequelize)
  try {
    stopErrorMonitoring();
    await sendErrorDigest();
  } catch (err) {
    log(`Error flushing error digest: ${err}`, 'error');
  }

  // 3. Shutdown BullMQ webhook queue and worker
  try {
    await shutdownWebhookQueue();
    log('Webhook queue shut down.', 'info');
  } catch (err) {
    log(`Error shutting down webhook queue: ${err}`, 'error');
  }

  // 4. Wait briefly for in-flight DB operations to finish
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Close database connection pool LAST
  try {
    await sequelize.close();
    log('Database connection closed.', 'info');
  } catch (err) {
    log(`Error closing database: ${err}`, 'error');
  }

  log('Graceful shutdown complete. Exiting.', 'info');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  // Suppress Sequelize "connection manager was closed" errors during shutdown
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (isShuttingDown && msg.includes('connection manager was closed')) {
    log(`[Shutdown] Suppressed post-shutdown DB error: ${msg}`, 'warn');
    return;
  }
  log(`Unhandled Promise Rejection at: ${promise}, reason: ${reason}`, 'error');
  captureError(reason, 'unhandled-rejection', {
    severity: 'critical',
    extraContext: `Promise: ${String(promise)}`,
  });
  // Don't exit — log and continue
});

process.on('uncaughtException', (error: Error) => {
  // Suppress Sequelize "connection manager was closed" errors during shutdown
  if (isShuttingDown && error.message.includes('connection manager was closed')) {
    log(`[Shutdown] Suppressed post-shutdown DB error: ${error.message}`, 'warn');
    return;
  }
  log(`Uncaught Exception: ${error.message}\n${error.stack}`, 'error');
  captureError(error, 'uncaught', {
    severity: 'critical',
    extraContext: 'Process will exit after this error',
  });
  // Send digest immediately before exit (best-effort)
  sendErrorDigest().finally(() => {
    process.exit(1);
  });
});
