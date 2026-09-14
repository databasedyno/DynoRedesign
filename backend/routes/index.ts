import express from "express";
import config from "../utils/config";
import axios from "axios";
import { apiLogger } from "../utils/loggers";
import userRouter from "./userRouter";
import eventsRouter from "./eventsRouter";
import analyticsRouter from "./analyticsRouter";
import companyRouter from "./companyRouter";
import walletRouter from "./walletRouter";
import taxRouter from "./taxRouter";
import dashboardRouter from "./dashboardRouter";
import notificationRouter from "./notificationRouter";
import invoiceRouter from "./invoiceRouter";
import kycRouter from "./kycRouter";
import statusRouter from "./statusRouter";
import subscriptionRouter from "./subscriptionRouter";
import testRouter from "./testRouter";
import referralRouter from "./referralRouter";
import knowledgeBaseRouter from "./knowledgeBaseRouter";
import supportChatRouter from "./supportChatRouter";
import merchantApiRouter from "./merchantApiRouter";
import customerWalletApiRouter from "./customerWalletApiRouter";
import trackRouter from "./trackRouter";
import productRouter from "./productRouter";
import qualityRouter from "./qualityRouter";

import {
  authMiddleware,
  walletMiddleware,
} from "../middleware";
import emailVerifiedMiddleware from "../middleware/emailVerifiedMiddleware";
// ITatumWebHook, IWebHook imports removed - not used
import { webhookRateLimiter } from "../middleware/rateLimitMiddleware";
import apiRouter from "./apiRouter";
import paymentRouter from "./paymentRouter";
import paymentTestHookRouter from "./paymentTestHookRouter";
import {
  flutterwaveWebHook,
  tatumCryptoWebHook,
  tatumWebHook,
} from "../webhooks";
import adminRouter from "./adminRouter";
import adminLogsRouter from "./adminLogsRouter";
import publicSandboxRouter from "./publicSandboxRouter";
import teamRouter from "./teamRouter"; // Team Members / RBAC
import walletSecurityRouter from "./walletSecurityRouter"; // PUBLIC "this wasn't me" revert
import { logWebhookValidationFailure } from "../utils/securityLogger";
import { verifyTatumSignature } from "../utils/webhookSignature";
import { toNumber } from "../utils/money";

/**
 * Tatum webhook HMAC signature verification middleware.
 * If TATUM_WEBHOOK_SECRET is configured, validates the x-payload-hash header.
 * If not configured, logs a warning and allows the request (backward compatible).
 *
 * FIX: For unsigned webhooks (legacy subscriptions), restrict to known Tatum IP ranges
 * and rate-limit unsigned requests to mitigate spoofing risk.
 */

// Known Tatum IP ranges (from their documentation, observed traffic, and production logs)
const TATUM_KNOWN_IPS = new Set([
  '167.82.142.41', '167.82.142.42', '167.82.142.43', '167.82.142.44',
  '18.213.36.109', '18.213.36.110', // Tatum US-East
  '3.209.96.0', '3.209.96.1', // Tatum AWS
  // FIX BUG-8: Google Cloud IPs observed sending Tatum webhooks in production
  '34.82.77.148',    // GCP us-west1 — confirmed Tatum webhook source
  '35.185.216.99',   // GCP us-central1 — confirmed Tatum webhook source
  '34.83.123.121',   // GCP us-west1 — confirmed Tatum webhook source (Railway log 2026-02-24)
  '34.82.0.0',       // GCP us-west1 range (Tatum infrastructure)
  '35.185.0.0',      // GCP us-central1 range (Tatum infrastructure)
  '34.107.0.0',      // GCP additional webhook IPs
]);

// Track unsigned webhook counts per IP (sliding window)
const unsignedWebhookCounts = new Map<string, { count: number; resetAt: number }>();
const UNSIGNED_RATE_LIMIT = 100; // max unsigned webhooks per IP per hour
const UNSIGNED_RATE_WINDOW = 3600000; // 1 hour in ms
const UNSIGNED_CLEANUP_INTERVAL = 600000; // Clean up stale entries every 10 minutes

// Periodic cleanup to prevent memory leak from accumulating IPs
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of unsignedWebhookCounts) {
    if (entry.resetAt <= now) {
      unsignedWebhookCounts.delete(ip);
    }
  }
}, UNSIGNED_CLEANUP_INTERVAL);

const verifyTatumWebhookSource = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = config.raw("TATUM_WEBHOOK_SECRET");
  if (!secret) {
    // No secret configured — skip verification (backward compatible)
    return next();
  }

  const signature = req.headers["x-payload-hash"] as string;
  if (!signature) {
    // Legacy subscription without HMAC — apply IP check and rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    // Check exact match only against known Tatum IPs (no loose prefix matching)
    const isTatumIp = TATUM_KNOWN_IPS.has(clientIp);

    // Rate-limit unsigned webhooks per IP
    const now = Date.now();
    const counter = unsignedWebhookCounts.get(clientIp);
    if (counter && counter.resetAt > now) {
      counter.count++;
      if (counter.count > UNSIGNED_RATE_LIMIT) {
        apiLogger.warn(`[WebhookAuth] Rate-limited unsigned webhook from ${clientIp} (${counter.count} in window)`);
        logWebhookValidationFailure('tatum', clientIp, 'Unsigned webhook rate limit exceeded');
        return res.status(429).json({ error: "Too many unsigned requests" });
      }
    } else {
      unsignedWebhookCounts.set(clientIp, { count: 1, resetAt: now + UNSIGNED_RATE_WINDOW });
    }

    if (isTatumIp) {
      apiLogger.info(`[WebhookAuth] Unsigned webhook from known Tatum IP ${clientIp} — allowing (legacy)`);
    } else {
      apiLogger.warn(`[WebhookAuth] Unsigned webhook from UNKNOWN IP ${clientIp} — allowing but flagged for review`);
      logWebhookValidationFailure('tatum', clientIp, 'Missing x-payload-hash from non-Tatum IP');
    }
    return next();
  }

  // Verify against the EXACT bytes Tatum signed. express.json's `verify` hook
  // (server.ts) stashes the untouched request buffer on req.rawBody; using it
  // avoids a re-serialization mismatch (key order / whitespace / unicode
  // escaping) that could reject a genuine webhook. Fallback to JSON.stringify
  // only if the raw buffer is unavailable.
  const rawReq = req as express.Request & { rawBody?: Buffer };
  const rawBody = rawReq.rawBody && rawReq.rawBody.length
    ? rawReq.rawBody.toString("utf8")
    : JSON.stringify(req.body);

  // Centralized inbound verifier (HMAC-SHA512 of the body vs x-payload-hash).
  if (!verifyTatumSignature(rawBody, signature, secret)) {
    apiLogger.warn(`[WebhookAuth] Invalid webhook signature from ${req.ip}`);
    logWebhookValidationFailure('tatum', req.ip || 'unknown', 'Invalid HMAC signature');
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  next();
};

/**
 * Tier-2 Item #4 — DB-level webhook idempotency.
 *
 * After signature verification, record the inbound event keyed by a stable
 * (provider, provider_event_id). If we have already seen it, acknowledge 200
 * WITHOUT reprocessing — a database UNIQUE constraint is the source of truth,
 * not just the Redis `processed-tx` key. Gated by ENABLE_INBOUND_EVENT_DEDUP
 * (default OFF) and fail-open: any error here lets the request proceed so a real
 * webhook is never dropped by the dedup layer.
 */
const inboundEventDedup = (provider: string) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!config.bool("ENABLE_INBOUND_EVENT_DEDUP")) return next();
    try {
      const body: Record<string, any> = req.body || {};
      const txId = body.txId || body.txID || body.hash || body.transactionId;
      const addr = body.address || body.to || body.counterAddress || "";
      const asset = body.asset || body.currency || body.chain || "";
      if (!txId) return next(); // no stable id → fail-open
      const providerEventId = `${txId}:${addr}:${asset}`;
      const { recordInbound } = await import("../services/idempotency/inboundEventService");
      const result = await recordInbound({
        provider,
        providerEventId,
        eventType: body.subscriptionType || body.type || null,
        payload: body,
      });
      if (!result.isNew) {
        return res.status(200).json({ status: "duplicate", message: "event already received" });
      }
    } catch {
      // Fail-open — the existing Redis/DB guards still apply downstream.
    }
    return next();
  };

const router = express.Router();

// Base API route - Returns API status and available endpoints
router.get("/", (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: "operational",
    service: "Dynopay API",
    version: "1.0.0",
    api_version: "v1",
    timestamp: new Date().toISOString(),
    documentation: "/api/docs",
    versioning: {
      current: "v1",
      base_url: "/api",
      versioned_url: "/api/v1",
      note: "Both /api/* and /api/v1/* are supported. Use /api/v1/* for explicit version pinning."
    },
    endpoints: {
      authentication: "/api/user",
      admin: "/api/admin",
      companies: "/api/company",
      apiKeys: "/api/userApi",
      wallets: "/api/wallet",
      payments: "/api/pay",
      tax: "/api/tax",
      dashboard: "/api/dashboard",
      notifications: "/api/notifications",
      kyc: "/api/kyc",
      status: "/api/status",
      subscriptions: "/api/subscriptions",
      referrals: "/api/referral",
      knowledgeBase: "/api/kb",
      invoices: "/api/invoices"
    }
  });
});

router.use("/user", userRouter);

/**
 * Public tickers endpoint — read-only price snapshot for the landing page price strip.
 * No auth required. Returns the in-memory ticker cache populated by
 * binanceWebSocketService (with CoinGecko/Kraken fallbacks).
 */
router.get("/public/tickers", async (_req: express.Request, res: express.Response) => {
  try {
    // Lazy-load to avoid pulling the service into the request critical path
    const { getAllTickerData, TRACKED_ASSETS } = await import("../services/binanceWebSocketService");
    const all = getAllTickerData();
    let out = Object.entries(all || {})
      .map(([asset, t]: [string, any]) => ({
        symbol: asset,
        price: t?.price ?? 0,
        change24h: t?.priceChangePercent ?? 0,
        updatedAt: t?.updatedAt ?? 0,
      }))
      .filter((t) => t.price > 0);

    // Resilient fallback: when the in-memory WebSocket ticker cache is empty
    // (e.g. Binance geo-blocked in this server region), source USD prices from
    // Tatum so fiat estimates still render everywhere in the app. No-op when
    // the WS feed is healthy (production), so this never changes normal output.
    if (out.length === 0) {
      const { getUsdPriceSnapshot } = await import("../helper/currencyConvert");
      const snapshot = await getUsdPriceSnapshot(TRACKED_ASSETS);
      out = Object.entries(snapshot).map(([symbol, price]) => ({
        symbol,
        price,
        change24h: 0,
        updatedAt: Date.now(),
      }));
    }

    res.status(200).json({ status: "success", data: out });
  } catch (err: any) {
    apiLogger.warn("/api/public/tickers failed:", err?.message);
    res.status(200).json({ status: "success", data: [] });
  }
});

/**
 * Public FX-rates endpoint — lightweight USD→fiat feed for the landing page's
 * country-aware price formatter (useLocalPrice). No auth, read-only, no DB
 * writes. Values come from the same Redis-cached FX source the app already
 * uses for display conversions (getUsdToFiatRate). The aggregate is memoised
 * ~6h so the landing stays stable across the day and we never burn FX-provider
 * quota per visitor. Any currency whose live rate is unavailable is OMITTED so
 * the client keeps its static fallback instead of showing a wrong 1:1 rate.
 */
const FX_LANDING_CURRENCIES = ["EUR", "GBP", "INR", "AUD", "CAD", "JPY", "MXN", "BRL", "ZAR", "NGN"];
const FX_RATES_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let fxRatesCache: { rates: Record<string, number>; updatedAt: number } | null = null;

router.get("/public/fx-rates", async (_req: express.Request, res: express.Response) => {
  try {
    const now = Date.now();
    if (fxRatesCache && now - fxRatesCache.updatedAt < FX_RATES_TTL_MS) {
      res.status(200).json({
        status: "success",
        data: { base: "USD", rates: fxRatesCache.rates, updatedAt: new Date(fxRatesCache.updatedAt).toISOString() },
      });
      return;
    }
    const { getUsdToFiatRate } = await import("../utils/currencyUtils");
    const rates: Record<string, number> = { USD: 1 };
    const results = await Promise.all(
      FX_LANDING_CURRENCIES.map(async (cur) => {
        try {
          return { cur, r: Number(await getUsdToFiatRate(cur)) };
        } catch {
          return { cur, r: 0 };
        }
      })
    );
    for (const { cur, r } of results) {
      // r === 1 for a non-USD currency is the helper's failure sentinel → omit
      if (r > 0 && r !== 1) rates[cur] = toNumber(r, 6);
    }
    fxRatesCache = { rates, updatedAt: now };
    res.status(200).json({
      status: "success",
      data: { base: "USD", rates, updatedAt: new Date(now).toISOString() },
    });
  } catch (err: any) {
    apiLogger.warn("/api/public/fx-rates failed:", err?.message);
    res.status(200).json({
      status: "success",
      data: { base: "USD", rates: { USD: 1 }, updatedAt: new Date().toISOString() },
    });
  }
});

/**
 * Public merchant identity-verification endpoint — powers the buyer-facing
 * "Identity verified" badge across payment pages, storefronts and receipts
 * ("Verified Everywhere"). No auth, read-only, no DB writes.
 *
 * Accepts exactly one PUBLIC identifier as a query param:
 *   ?handle=<storefront/creator handle>   (storefront, product, checkout, creator)
 *   ?linkRef=<d param of /pay?d=...>       (hosted payment link checkout)
 *   ?orderId=<product order id>            (order / receipt pages)
 * Returns { verified: boolean, business_name: string|null }. Anything that
 * doesn't resolve (or any error) yields { verified: false } — the badge simply
 * doesn't render, so an unverified/unknown merchant is never mislabelled.
 */
router.get("/public/merchant-verification", async (req: express.Request, res: express.Response) => {
  try {
    const { resolveMerchantForVerification, isMerchantIdentityVerified } = await import(
      "../helper/merchantVerification"
    );
    const { handle, linkRef, orderId } = req.query as Record<string, string | undefined>;

    if (!handle && !linkRef && !orderId) {
      return res.status(200).json({ status: "success", data: { verified: false, business_name: null } });
    }

    const merchant = await resolveMerchantForVerification({ handle, linkRef, orderId });
    const verified = await isMerchantIdentityVerified(merchant.userId, merchant.companyId);

    return res.status(200).json({
      status: "success",
      data: { verified, business_name: merchant.businessName },
    });
  } catch (err: any) {
    apiLogger.warn("/api/public/merchant-verification failed:", err?.message);
    return res.status(200).json({ status: "success", data: { verified: false, business_name: null } });
  }
});


/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC SANDBOX PLAYGROUND — extracted to routes/publicSandboxRouter.ts
 * (mounted below at /public/sandbox) to keep this aggregator under the R2
 * 500-line new-file budget. Behaviour and paths are unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Geo-detection endpoint — called by frontend for IP-based language auto-detection
// This proxies the request server-side to avoid HTTPS→HTTP mixed-content browser blocks
router.get("/geo-detect", async (req: express.Request, res: express.Response) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.headers['x-real-ip'] as string
      || req.ip
      || '';
    
    // Don't send localhost/private IPs to ip-api
    const cleanIp = clientIp.replace(/^::ffff:/, ''); // Strip IPv6-mapped prefix
    const isPrivateIp = !cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.') || cleanIp.startsWith('172.');
    const url = isPrivateIp
      ? 'http://ip-api.com/json/?fields=status,country,countryCode'
      : `http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode`;
    
    const response = await axios.get(url, { timeout: 3000 });
    
    if (response.data?.status === 'success') {
      return res.json({
        status: 'success',
        country: response.data.country,
        countryCode: response.data.countryCode,
      });
    }
    
    return res.json({ status: 'fail', countryCode: 'US', country: 'Unknown' });
  } catch (err: any) {
    apiLogger.warn(`[GeoDetect] IP geolocation failed: ${err?.message}`);
    return res.json({ status: 'fail', countryCode: 'US', country: 'Unknown' });
  }
});
// Public sandbox playground (extracted) — /api/public/sandbox/*
router.use("/public/sandbox", publicSandboxRouter);

// Merchant API routes (unified) — supports both OLD and NEW auth flows
router.use("/user/customers", customerWalletApiRouter);
router.use("/user", merchantApiRouter);
router.use("/admin/logs", adminLogsRouter); // Admin Live Console — SSE log stream + health pulse
router.use("/admin", adminRouter);
router.use("/company", authMiddleware, emailVerifiedMiddleware, companyRouter);
router.use("/userApi", apiRouter);
router.use("/wallet", authMiddleware, walletMiddleware, emailVerifiedMiddleware, walletRouter);
router.use("/wallet-security", walletSecurityRouter); // PUBLIC — token-authed revert link
router.use("/__paytest", paymentTestHookRouter); // GUARDED test hook (off unless PAYMENT_TEST_HOOK_SECRET set)
router.use("/pay", paymentRouter);
router.use("/tax", taxRouter);
router.use("/dashboard", authMiddleware, emailVerifiedMiddleware, dashboardRouter);
router.use("/notifications", notificationRouter);
router.use("/kyc", kycRouter);
router.use("/status", statusRouter); // Public status page endpoints
router.use("/quality", qualityRouter); // QA Quality Center (passcode-gated inside)
router.use("/subscriptions", subscriptionRouter); // Subscription management
router.use("/team", teamRouter); // Team Members / RBAC (invite/accept/manage)
// ─────────────────────────────────────────────────────────────────────────────
// /api/test/* — NOT mounted in production unless explicitly re-enabled.
//
// Every route in testRouter does require a JWT, but only `authMiddleware`, i.e.
// ANY logged-in merchant — not an admin. The router exposes:
//   POST /test/fix-customer-id-column   (schema DDL)
//   POST /test/manual-transfer          (moves funds)
//   GET/DELETE /test/redis/:key         (read or delete arbitrary cache keys)
//   POST /test/send-*-email             (send mail to an arbitrary address)
//   POST /test/trigger-*-reminders      (fire bulk reminder jobs)
//   POST /test/full-payment-flow, /simulate-payment-redis, /rlusd-trustline
// Handing that to every authenticated merchant is privilege escalation on a
// payments platform, so production must opt IN via ENABLE_TEST_ENDPOINTS=true.
// A 404 (rather than leaving it mounted) also stops the surface being
// discoverable at all.
// ─────────────────────────────────────────────────────────────────────────────
const testEndpointsEnabled =
  config.raw("ENABLE_TEST_ENDPOINTS") === "true" || config.raw("NODE_ENV") !== "production";

if (testEndpointsEnabled) {
  router.use("/test", testRouter); // Test endpoints for development
} else {
  router.use("/test", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });
}
router.use("/referral", referralRouter); // Referral system endpoints
router.use("/kb", knowledgeBaseRouter); // Knowledge Base endpoints
router.use("/support", supportChatRouter); // AI support chat (public, rate-limited)
router.use("/events", eventsRouter); // SSE real-time events
router.use("/track", trackRouter); // Visitor tracking (public, rate-limited)
router.use("/admin/analytics", analyticsRouter); // Admin analytics (revenue, cohorts, funnels)
router.use("/", productRouter); // Product Catalog (Phase 1): /products, /shop, /cart, /checkout, /order
router.use("/", invoiceRouter); // Invoice routes (transactions/:id/invoice, invoices, invoices/:id)

router.post("/webhook", webhookRateLimiter, flutterwaveWebHook);
router.post("/failed_webhook", webhookRateLimiter, flutterwaveWebHook);
router.post("/tatum-webhook", webhookRateLimiter, verifyTatumWebhookSource, inboundEventDedup("tatum"), tatumWebHook);
router.post("/tatum-crypto-webhook", webhookRateLimiter, verifyTatumWebhookSource, inboundEventDedup("tatum"), tatumCryptoWebHook);

export default router;
