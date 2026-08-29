import express from "express";
import crypto from "crypto";
import config from "../utils/config";
import { apiLogger } from "../utils/loggers";
import { sandboxRateLimiter } from "../middleware/rateLimitMiddleware";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC SANDBOX PLAYGROUND  (mounted at /api/public/sandbox)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ephemeral in-memory stubs backing the homepage "Try the API" curl snippet.
 * DO NOT touch Postgres/Redis for real merchant/customer data — everything
 * returned here is fake. Rate-limited to 10 req/IP/min (see sandboxRateLimiter).
 *
 * The public sandbox key that the docs/homepage display is intentionally
 * shareable — it authenticates NOTHING; auth here is best-effort and cosmetic.
 *
 * Extracted verbatim from routes/index.ts (2026-06) to keep that router
 * aggregator under the R2 500-line new-file budget. Behaviour and the full
 * `/api/public/sandbox/*` paths are unchanged.
 */
const SANDBOX_PUBLIC_KEY = "dyno_sk_sandbox_demo_9f621db8";

const publicSandboxRouter = express.Router();

/**
 * POST /api/public/sandbox/payment-links
 * Body: { amount?: number, currency?: string, description?: string, customer_email?: string }
 * Returns: a stubbed payment link object that mirrors the shape of the real
 * create-payment-link response — enough for a copy-paste curl demo.
 */
publicSandboxRouter.post("/payment-links", sandboxRateLimiter, async (req: express.Request, res: express.Response) => {
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
publicSandboxRouter.get("/payment-links/:id", sandboxRateLimiter, async (req: express.Request, res: express.Response) => {
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
publicSandboxRouter.get("/info", async (_req: express.Request, res: express.Response) => {
  const base = (config.serverUrl || config.frontendUrl || "").replace(/\/+$/, "");
  res.status(200).json({
    sandbox_key: SANDBOX_PUBLIC_KEY,
    base_url: base || "https://dynopay.com",
    endpoint: "/api/public/sandbox/payment-links",
    rate_limit: "10 req/min per IP",
    note: "This key is shareable. It only authorizes the ephemeral sandbox endpoints; nothing here is billable or persisted.",
  });
});

export default publicSandboxRouter;
