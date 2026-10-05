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
import { authMiddleware } from "../middleware";
import { classifySource, verifyUnsubToken } from "../utils/attributionSource";
import { detectAiBot, AI_BOT_NAMES } from "../utils/aiBots";

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

const PAGE_TIP_EVENT = "page_tip_dismissed";
const PAGE_TIP_KEY = /^[a-zA-Z]{1,20}$/;
const userIdOf = (res: express.Response) => (jwt.decode(res.locals.token) as { user_id?: number } | null)?.user_id;

/** GET /api/track/page-tips — page-tip keys this ACCOUNT has dismissed (any device). */
trackRouter.get("/page-tips", authMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const user_id = userIdOf(res);
    if (!user_id) return res.status(200).json({ ok: false, dismissed: [] });
    const { onboardingEventModel } = await import("../models");
    const rows = (await onboardingEventModel.findAll({
      where: { user_id, event_type: PAGE_TIP_EVENT },
      attributes: ["step_key"],
      raw: true,
    })) as unknown as Array<{ step_key: string | null }>;
    return res.status(200).json({ ok: true, dismissed: [...new Set(rows.map((r) => r.step_key).filter(Boolean))] });
  } catch (err) {
    apiLogger.error("[Track] page-tips read error:", err);
    return res.status(200).json({ ok: false, dismissed: [] });
  }
});

/** POST /api/track/page-tips/dismiss { key } — remember a dismissed page tip for the account (idempotent). */
trackRouter.post("/page-tips/dismiss", authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const user_id = userIdOf(res);
    const key = req.body?.key;
    if (!user_id || typeof key !== "string" || !PAGE_TIP_KEY.test(key)) return res.status(400).json({ ok: false });
    const { onboardingEventModel } = await import("../models");
    await onboardingEventModel.findOrCreate({
      where: { user_id, event_type: PAGE_TIP_EVENT, step_key: key },
      defaults: { user_id, event_type: PAGE_TIP_EVENT, step_key: key },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    apiLogger.error("[Track] page-tips dismiss error:", err);
    return res.status(200).json({ ok: false });
  }
});

/**
 * POST /api/track/visitor — retired (Wave 4d). The per-visit admin e-mail was
 * inbox noise; the endpoint stays a fast 200 so old landing-page bundles keep
 * working. Visitor analytics live in the dashboard/analytics tooling instead.
 */
trackRouter.post("/visitor", (_req: express.Request, res: express.Response) => {
  res.status(200).json({ ok: true });
});

/**
 * POST /api/track/bot-hit — no auth. Beaconed fire-and-forget from the Next.js
 * Edge middleware whenever an AI crawler (GPTBot, PerplexityBot, ClaudeBot,
 * CCBot…) fetches a content page. Body: { bot, path, host, ip, ua }.
 *
 * Hardening (public endpoint): the bot is re-validated against the UA, a soft
 * global per-minute cap guards against floods, and identical (bot|ip|path)
 * bursts are de-duplicated for 30s so the table stays meaningful. Never errors
 * to the caller. Rows are pruned to 90 days opportunistically.
 */
trackRouter.post("/bot-hit", async (req: express.Request, res: express.Response) => {
  try {
    const b = (req.body || {}) as Record<string, unknown>;
    const ua = typeof b.ua === "string" ? b.ua : "";
    const claimed = typeof b.bot === "string" ? b.bot : "";
    // Trust but verify — accept the claimed bot only if it's known, else re-derive from the UA.
    const bot = AI_BOT_NAMES.has(claimed) ? claimed : detectAiBot(ua);
    if (!bot) return res.status(200).json({ ok: false });

    const path = typeof b.path === "string" ? b.path.slice(0, 500) : null;
    const host = typeof b.host === "string" ? b.host.slice(0, 120) : null;
    const ip = typeof b.ip === "string" ? b.ip.slice(0, 45) : null;

    // Soft global cap (~3k/min — far above real AI crawl rates) to bound abuse.
    const capKey = `bothit:cap:${Math.floor(Date.now() / 60000)}`;
    const cap = (await getRedisItem(capKey)) as { n?: number } | null;
    const n = (cap?.n || 0) + 1;
    if (n > 3000) return res.status(200).json({ ok: true, capped: true });
    await setRedisItemWithTTL(capKey, { n }, 90);

    // Collapse rapid re-crawls of the same page by the same bot/ip.
    const dedupKey = `bothit:seen:${bot}:${ip || "?"}:${path || "?"}`;
    const seen = await getRedisItem(dedupKey);
    if (seen && Object.keys(seen).length > 0) return res.status(200).json({ ok: true, deduped: true });
    await setRedisItemWithTTL(dedupKey, { t: Date.now() }, 30);

    const { botHitModel } = await import("../models");
    await botHitModel.create({ bot, host, path, ip, user_agent: ua ? ua.slice(0, 500) : null });

    // Opportunistic retention: ~1% of inserts trim anything older than 90 days.
    if (Math.random() < 0.01) {
      const { default: sequelize } = await import("../utils/dbInstance");
      await sequelize.query(`DELETE FROM "tbl_bot_hit" WHERE created_at < NOW() - INTERVAL '90 days'`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    apiLogger.error("[Track] bot-hit error:", err);
    return res.status(200).json({ ok: false });
  }
});

export default trackRouter;
