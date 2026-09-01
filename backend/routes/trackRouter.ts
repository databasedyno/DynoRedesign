/**
 * Visitor Tracking Router
 *
 * Lightweight endpoint for tracking new website visitors.
 * Uses IP-based deduplication (24h Redis TTL) to avoid spam.
 * Rate-limited to prevent abuse.
 */

import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { apiLogger } from "../utils/loggers";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { sendNewVisitorAdminEmail } from "../services/emailService";
import { authMiddleware } from "../middleware";
import { classifySource, verifyUnsubToken } from "../utils/attributionSource";

const trackRouter = express.Router();

/**
 * POST /api/track/attribution
 * Auth required. Body: { referrer?, landing_page?, utm?: {source,medium,campaign,term,content} }
 *
 * Records ONE first-touch signup-attribution row per user (first write wins —
 * never overwrites an existing row). Derives the channel from referrer/UTM,
 * best-effort IP→country, and captures landing page + user-agent. Tracking must
 * never surface an error to the client.
 */
trackRouter.post("/attribution", authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const decoded = jwt.decode(res.locals.token) as { user_id?: number } | null;
    const user_id = decoded?.user_id;
    if (!user_id) return res.status(200).json({ ok: false });

    const { signupAttributionModel } = await import("../models");

    // First-touch wins — never overwrite an existing row.
    const existing = await signupAttributionModel.findOne({ where: { user_id } });
    if (existing) return res.status(200).json({ ok: true, existed: true });

    const body = req.body || {};
    const utm = (body.utm && typeof body.utm === "object" ? body.utm : {}) as Record<string, unknown>;
    const asStr = (v: unknown, max = 240): string | null => {
      if (v == null) return null;
      const s = String(v).trim();
      return s ? s.slice(0, max) : null;
    };

    const referrer = asStr(body.referrer, 500);
    const utm_source = asStr(utm.source, 120);
    const source = classifySource({ referrer, utmSource: utm_source });

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || null;
    const user_agent = asStr(req.headers["user-agent"], 1000);

    // Best-effort geo — never blocks the row on failure.
    let country: string | null = null;
    let city: string | null = null;
    try {
      const cleanIp = !ip || ip === "::1" || ip === "127.0.0.1" ? "" : ip;
      const geoUrl = !cleanIp
        ? "http://ip-api.com/json/?fields=status,country,city"
        : `http://ip-api.com/json/${cleanIp}?fields=status,country,city`;
      const geoRes = await axios.get(geoUrl, { timeout: 2500 });
      if (geoRes.data?.status === "success") {
        country = geoRes.data.country || null;
        city = geoRes.data.city || null;
      }
    } catch { /* non-critical */ }

    await signupAttributionModel.findOrCreate({
      where: { user_id },
      defaults: {
        user_id,
        referrer,
        source,
        utm_source,
        utm_medium: asStr(utm.medium, 120),
        utm_campaign: asStr(utm.campaign, 160),
        utm_term: asStr(utm.term, 160),
        utm_content: asStr(utm.content, 160),
        landing_page: asStr(body.landing_page, 255),
        ip: ip ? String(ip).slice(0, 45) : null,
        country,
        city,
        user_agent,
      },
    });

    return res.status(200).json({ ok: true, source });
  } catch (err) {
    apiLogger.error("[Track] Attribution error:", err);
    return res.status(200).json({ ok: false });
  }
});

/**
 * GET /api/track/activation-unsubscribe?u=<userId>&t=<hmac>
 * Public. Verifies the stateless HMAC token and sets marketing_opt_out=true so
 * the activation drip skips this user. Renders a small confirmation page.
 */
trackRouter.get("/activation-unsubscribe", async (req: express.Request, res: express.Response) => {
  const page = (title: string, msg: string): string =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${title} · Dynopay</title>` +
    `<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;` +
    `background:#0B0B0F;color:#F5F5F5;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}` +
    `.card{max-width:460px;text-align:center}.card h1{font-size:22px;margin:0 0 12px;font-weight:700}` +
    `.card p{color:#C9C9D1;font-size:15px;line-height:1.6;margin:0}</style></head>` +
    `<body><div class="card"><h1>${title}</h1><p>${msg}</p></div></body></html>`;
  try {
    const user_id = Number(req.query.u);
    const token = String(req.query.t || "");
    if (!user_id || !verifyUnsubToken(user_id, token)) {
      res.status(200).type("html").send(page(
        "Link expired",
        "This unsubscribe link is invalid or has expired. If you keep receiving setup emails, just reply to any of them and we'll remove you."
      ));
      return;
    }
    const { signupAttributionModel } = await import("../models");
    const [row, created] = await signupAttributionModel.findOrCreate({
      where: { user_id },
      defaults: { user_id, marketing_opt_out: true },
    });
    if (!created) {
      (row as unknown as { marketing_opt_out: boolean }).marketing_opt_out = true;
      await (row as unknown as { save: () => Promise<unknown> }).save();
    }
    res.status(200).type("html").send(page(
      "You're unsubscribed",
      "You won't receive any more Dynopay setup tips. Your account and payments are unaffected — you can reach us anytime from your dashboard."
    ));
  } catch (err) {
    apiLogger.error("[Track] Unsubscribe error:", err);
    res.status(200).type("html").send(page(
      "Something went wrong",
      "We couldn't process that just now. Please try again in a minute."
    ));
  }
});

const ONBOARDING_EVENT_TYPES = [
  "checklist_shown",
  "step_clicked",
  "step_completed",
  "dismissed",
  "collapsed",
  "expanded",
];

/**
 * POST /api/track/onboarding
 * Auth required. Body: { event_type, step_key?, completed_count?, metadata? }
 *
 * Records onboarding-checklist engagement so admins can see where new
 * merchants drop off. High-frequency events (checklist_shown, step_completed)
 * are de-duplicated via Redis so a row is written at most once per window.
 */
trackRouter.post("/onboarding", authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const decoded = jwt.decode(res.locals.token) as { user_id?: number } | null;
    const user_id = decoded?.user_id;
    const { event_type, step_key, completed_count, metadata } = req.body || {};

    if (!user_id || !ONBOARDING_EVENT_TYPES.includes(event_type)) {
      return res.status(200).json({ ok: false });
    }

    // De-duplicate noisy events so the table stays meaningful
    if (event_type === "checklist_shown" || event_type === "step_completed") {
      const dedupKey = `onb:${event_type}:${user_id}:${step_key || "_"}`;
      const seen = await getRedisItem(dedupKey);
      if (seen && Object.keys(seen).length > 0) {
        return res.status(200).json({ ok: true, deduped: true });
      }
      // checklist_shown: 6h window; step_completed: 30d (effectively once)
      const ttl = event_type === "checklist_shown" ? 21600 : 2592000;
      await setRedisItemWithTTL(dedupKey, { t: Date.now() }, ttl);
    }

    const { onboardingEventModel } = await import("../models");
    await onboardingEventModel.create({
      user_id,
      event_type,
      step_key: typeof step_key === "string" ? step_key : null,
      completed_count: typeof completed_count === "number" ? completed_count : null,
      metadata: metadata && typeof metadata === "object" ? metadata : null,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    apiLogger.error("[Track] Onboarding event error:", err);
    // Tracking must never surface an error to the client
    return res.status(200).json({ ok: false });
  }
});

// In-memory rate limiter: max 30 unique visitor emails per hour
let emailsSentThisHour = 0;
let lastHourReset = Date.now();
const MAX_EMAILS_PER_HOUR = 30;

const checkHourlyLimit = (): boolean => {
  const now = Date.now();
  if (now - lastHourReset > 3600000) {
    emailsSentThisHour = 0;
    lastHourReset = now;
  }
  return emailsSentThisHour < MAX_EMAILS_PER_HOUR;
};

/**
 * POST /api/track/visitor
 * Body: { page, referrer }
 *
 * Tracks a new unique visitor (IP-deduplicated for 24h).
 * Sends admin email notification for genuinely new visitors.
 */
trackRouter.post("/visitor", async (req: express.Request, res: express.Response) => {
  try {
    // Always return 200 quickly — tracking should never block the user
    res.status(200).json({ ok: true });

    // Extract visitor info
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "";
    const page = req.body?.page || "/";
    const referrer = req.body?.referrer || null;

    // Skip bots/crawlers
    const botPatterns = /bot|crawl|spider|slurp|feed|fetch|monitor|check|ping|curl|wget|python|go-http|java|ruby|perl/i;
    if (botPatterns.test(userAgent)) {
      apiLogger.info(`[Track] Skipping bot/crawler: ${userAgent.substring(0, 60)}`);
      return;
    }

    // Redis dedup: 1 notification per IP per 24 hours
    const dedupKey = `visitor:seen:${ip}`;
    const alreadySeen = await getRedisItem(dedupKey);
    if (alreadySeen && Object.keys(alreadySeen).length > 0) {
      apiLogger.info(`[Track] Visitor ${ip} already seen in last 24h — skipping email`);
      return;
    }

    // Mark as seen for 24 hours
    await setRedisItemWithTTL(dedupKey, { first_seen: new Date().toISOString(), page }, 86400);

    // Check hourly email rate limit
    if (!checkHourlyLimit()) {
      apiLogger.warn(`[Track] Visitor email rate limit reached (${MAX_EMAILS_PER_HOUR}/hr) — skipping email for ${ip}`);
      return;
    }

    // Geo-locate the visitor (best-effort, non-blocking)
    let country: string | null = null;
    let city: string | null = null;
    try {
      const cleanIp = ip === "::1" || ip === "127.0.0.1" ? "" : ip;
      const geoUrl = !cleanIp
        ? "http://ip-api.com/json/?fields=status,country,countryCode,city"
        : `http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,city`;
      const geoRes = await axios.get(geoUrl, { timeout: 3000 });
      if (geoRes.data?.status === "success") {
        country = geoRes.data.country;
        city = geoRes.data.city;
      }
    } catch (_geoErr) {
      // Non-critical — continue without geo data
    }

    // Send admin notification
    emailsSentThisHour++;
    await sendNewVisitorAdminEmail({
      ip,
      country,
      city,
      referrer,
      page,
      user_agent: userAgent,
      timestamp: new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }) + " UTC",
    });

  } catch (err) {
    apiLogger.error("[Track] Visitor tracking error:", err);
    // Don't return error — endpoint already responded 200
  }
});

export default trackRouter;
