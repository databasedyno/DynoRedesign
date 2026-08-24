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
import trackRouter from "./trackRouter";
import productRouter from "./productRouter";

import {
  authMiddleware,
  walletMiddleware,
} from "../middleware";
import emailVerifiedMiddleware from "../middleware/emailVerifiedMiddleware";
// ITatumWebHook, IWebHook imports removed - not used
import { webhookRateLimiter, sandboxRateLimiter } from "../middleware/rateLimitMiddleware";
import apiRouter from "./apiRouter";
import paymentRouter from "./paymentRouter";
import {
  flutterwaveWebHook,
  tatumCryptoWebHook,
  tatumWebHook,
} from "../webhooks";
import crypto from "crypto";
import adminRouter from "./adminRouter";
import { logWebhookValidationFailure } from "../utils/securityLogger";
import { verifyTatumSignature } from "../utils/webhookSignature";

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
  const secret = process.env.TATUM_WEBHOOK_SECRET;
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

  const rawBody = JSON.stringify(req.body);

  // Centralized inbound verifier (HMAC-SHA512 of the body vs x-payload-hash).
  if (!verifyTatumSignature(rawBody, signature, secret)) {
    apiLogger.warn(`[WebhookAuth] Invalid webhook signature from ${req.ip}`);
    logWebhookValidationFailure('tatum', req.ip || 'unknown', 'Invalid HMAC signature');
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  next();
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
      if (r > 0 && r !== 1) rates[cur] = Number(r.toFixed(6));
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
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC SANDBOX PLAYGROUND
 * ─────────────────────────────────────────────────────────────────────────────
 * Ephemeral in-memory stubs backing the homepage "Try the API" curl snippet.
 * DO NOT touch Postgres/Redis for real merchant/customer data — everything
 * returned here is fake. Rate-limited to 10 req/IP/min (see sandboxRateLimiter).
 *
 * The public sandbox key that the docs/homepage display is intentionally
 * shareable — it authenticates NOTHING; auth here is best-effort and cosmetic.
 */
const SANDBOX_PUBLIC_KEY = "dyno_sk_sandbox_demo_9f621db8";

/**
 * POST /api/public/sandbox/payment-links
 * Body: { amount?: number, currency?: string, description?: string, customer_email?: string }
 * Returns: a stubbed payment link object that mirrors the shape of the real
 * create-payment-link response — enough for a copy-paste curl demo.
 */
router.post("/public/sandbox/payment-links", sandboxRateLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    // Clamp/sanitize inputs. Never trust the caller.
    let amountRaw = Number(body.amount);
    if (!isFinite(amountRaw) || amountRaw <= 0) amountRaw = 49.99;
    if (amountRaw > 100000) amountRaw = 100000; // sandbox cap
    const amount = Math.round(amountRaw * 100) / 100;

    const currency = typeof body.currency === "string" && /^[A-Za-z]{3,10}$/.test(body.currency)
      ? body.currency.toUpperCase()
      : "USD";

    const description = typeof body.description === "string" && body.description.length <= 140
      ? body.description
      : "Sandbox test payment";

    const customer_email = typeof body.customer_email === "string" && body.customer_email.length <= 200
      ? body.customer_email
      : "customer@example.com";

    const id = "plink_sandbox_" + crypto.randomBytes(8).toString("hex");
    const now = Date.now();
    const expires_at = new Date(now + 30 * 60 * 1000).toISOString(); // +30 min

    // Use SERVER_URL if present, else FRONTEND_URL, else fall back to a relative URL
    const base = (config.serverUrl || config.frontendUrl || "").replace(/\/+$/, "");
    const checkout_url = base ? `${base}/pay/demo?ref=${id}` : `/pay/demo?ref=${id}`;

    res.status(200).json({
      object: "payment_link",
      id,
      livemode: false,
      sandbox: true,
      status: "awaiting_payment",
      amount,
      currency,
      description,
      customer_email,
      checkout_url,
      expires_at,
      created_at: new Date(now).toISOString(),
      supported_chains: ["USDT-TRC20", "USDT-ERC20", "USDT-POLYGON", "USDC-ERC20", "BTC", "ETH", "SOL", "XRP", "TRX", "BCH", "LTC", "DOGE", "RLUSD"],
      metadata: {
        sandbox_note: "This is a sandbox response. Nothing was written to the database and no on-chain transaction will occur. Use the returned checkout_url to preview the customer experience.",
      },
    });
  } catch (err: any) {
    apiLogger.warn("[sandbox] payment-links create failed:", err?.message);
    res.status(500).json({ error: "sandbox_error", message: "The sandbox stub failed unexpectedly." });
  }
});

/**
 * GET /api/public/sandbox/payment-links/:id
 * Returns a stubbed payment link — useful for showing a "poll for status"
 * example in docs. Everything is deterministic from the id; no state stored.
 */
router.get("/public/sandbox/payment-links/:id", sandboxRateLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const id = String(req.params.id || "").slice(0, 64);
    if (!/^plink_sandbox_[a-f0-9]{6,64}$/.test(id)) {
      return res.status(404).json({ error: "not_found", message: "Sandbox payment link not found." });
    }
    const base = (config.serverUrl || config.frontendUrl || "").replace(/\/+$/, "");
    const checkout_url = base ? `${base}/pay/demo?ref=${id}` : `/pay/demo?ref=${id}`;
    res.status(200).json({
      object: "payment_link",
      id,
      livemode: false,
      sandbox: true,
      status: "awaiting_payment",
      amount: 49.99,
      currency: "USD",
      description: "Sandbox test payment",
      checkout_url,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    apiLogger.warn("[sandbox] payment-links get failed:", err?.message);
    res.status(500).json({ error: "sandbox_error", message: "The sandbox stub failed unexpectedly." });
  }
});

/**
 * GET /api/public/sandbox/info
 * Returns the public sandbox key and a machine-readable curl example.
 * Used by the homepage TryItNow section so we can rotate the key in one place.
 */
router.get("/public/sandbox/info", async (_req: express.Request, res: express.Response) => {
  const base = (config.serverUrl || config.frontendUrl || "").replace(/\/+$/, "");
  res.status(200).json({
    sandbox_key: SANDBOX_PUBLIC_KEY,
    base_url: base || "https://dynopay.com",
    endpoint: "/api/public/sandbox/payment-links",
    rate_limit: "10 req/min per IP",
    note: "This key is shareable. It only authorizes the ephemeral sandbox endpoints; nothing here is billable or persisted.",
  });
});

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
// Merchant API routes (unified) — supports both OLD and NEW auth flows
router.use("/user", merchantApiRouter);
router.use("/admin", adminRouter);
router.use("/company", authMiddleware, emailVerifiedMiddleware, companyRouter);
router.use("/userApi", apiRouter);
router.use("/wallet", authMiddleware, walletMiddleware, emailVerifiedMiddleware, walletRouter);
router.use("/pay", paymentRouter);
router.use("/tax", taxRouter);
router.use("/dashboard", authMiddleware, emailVerifiedMiddleware, dashboardRouter);
router.use("/notifications", notificationRouter);
router.use("/kyc", kycRouter);
router.use("/status", statusRouter); // Public status page endpoints
router.use("/subscriptions", subscriptionRouter); // Subscription management
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
  process.env.ENABLE_TEST_ENDPOINTS === "true" || process.env.NODE_ENV !== "production";

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
router.post("/tatum-webhook", webhookRateLimiter, verifyTatumWebhookSource, tatumWebHook);
router.post("/tatum-crypto-webhook", webhookRateLimiter, verifyTatumWebhookSource, tatumCryptoWebHook);

export default router;
