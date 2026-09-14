import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { redis } from "../../utils/redisInstance";
import { resolveStorefrontByHandle } from "../storefrontScope";

/**
 * Creator / storefront visit analytics.
 *
 * Counted from a BROWSER beacon (POST /api/pay/creator/:handle/visit) — not from
 * the SSR profile fetch, which reached the API as the Next.js server (one IP,
 * one UA) and therefore collapsed every visitor into a single daily hit.
 *
 * Redis keys (read by controller/user/creatorAnalytics.ts):
 *   creator-visits:<handle>            lifetime counter
 *   creator-visits:<handle>:day:<ymd>  daily bucket (32d TTL)
 *   creator-referrers:<handle>         hash domain -> hits (90d TTL)
 *   creator-visit-seen:<handle>:<hash> 24h de-dupe marker per visitor
 */

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|discord|slack|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptimerobot|axios|go-http|node-fetch|semrush|ahrefs|screaming|feedfetcher|scrape/i;

const SELF_HOSTS = new Set(["dynopay.com", "checkout.dynopay.com", "www.dynopay.com"]);

const DAY = 60 * 60 * 24;

export interface CreatorVisitInput {
  handle: string;
  ownerUserId: number;
  ip: string;
  ua: string;
  referrer: string;
  viewerUserId: number | null;
}

/** Records one visit (deduped per visitor/24h). Returns true when counted. */
export const recordCreatorVisit = async (input: CreatorVisitInput): Promise<boolean> => {
  const handle = String(input.handle || "").trim().toLowerCase();
  const ua = String(input.ua || "").trim();
  if (!handle || !ua || BOT_RE.test(ua)) return false;
  if (input.viewerUserId !== null && input.viewerUserId === Number(input.ownerUserId)) return false;

  const visitorHash = crypto
    .createHash("sha256")
    .update(`${input.ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);
  const firstVisit = await redis
    .set(`creator-visit-seen:${handle}:${visitorHash}`, "1", { NX: true, EX: DAY })
    .catch(() => null);
  if (!firstVisit) return false;

  const ymd = new Date().toISOString().slice(0, 10);
  const dayKey = `creator-visits:${handle}:day:${ymd}`;
  await Promise.all([
    redis.incr(`creator-visits:${handle}`).catch(() => null),
    redis
      .incr(dayKey)
      .then(() => redis.expire(dayKey, DAY * 32))
      .catch(() => null),
    bumpReferrer(handle, input.referrer),
  ]);
  return true;
};

const bumpReferrer = async (handle: string, rawReferrer: string): Promise<void> => {
  let bucket = "(direct)";
  const ref = String(rawReferrer || "").trim();
  if (ref) {
    try {
      const host = new URL(ref).hostname.toLowerCase();
      if (!host || SELF_HOSTS.has(host)) return;
      bucket = host.replace(/^www\./, "").slice(0, 80);
    } catch {
      return;
    }
  }
  const key = `creator-referrers:${handle}`;
  await redis
    .hIncrBy(key, bucket, 1)
    .then(() => redis.expire(key, DAY * 90))
    .catch(() => null);
};

const clientIp = (req: express.Request): string => {
  const raw = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  return (typeof raw === "string" ? raw : String(raw)).split(",")[0].trim();
};

const viewerFromAuth = (req: express.Request): number | null => {
  try {
    const header = String(req.headers["authorization"] || "");
    const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!bearer) return null;
    const decoded = jwt.decode(bearer) as { user_id?: number } | null;
    return decoded?.user_id ? Number(decoded.user_id) : null;
  } catch {
    return null;
  }
};

/**
 * POST /api/pay/creator/:handle/visit — public browser beacon.
 * Body: { referrer?: string (document.referrer), surface?: 'page' | 'shop' }
 * Always 200; never blocks or errors the page.
 */
export const trackCreatorVisit = async (req: express.Request, res: express.Response) => {
  try {
    const handle = String(req.params.handle || "").trim().toLowerCase();
    if (!handle) return res.status(200).json({ ok: false });
    const owner = await resolveStorefrontByHandle(handle, false);
    if (!owner) return res.status(200).json({ ok: false });

    const counted = await recordCreatorVisit({
      handle,
      ownerUserId: Number(owner.user_id),
      ip: clientIp(req),
      ua: String(req.headers["user-agent"] || ""),
      referrer: typeof req.body?.referrer === "string" ? req.body.referrer.slice(0, 500) : "",
      viewerUserId: viewerFromAuth(req),
    });
    return res.status(200).json({ ok: true, counted });
  } catch {
    return res.status(200).json({ ok: false });
  }
};
