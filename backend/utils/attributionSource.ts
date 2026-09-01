import crypto from "crypto";
import config from "./config";

/**
 * Signup-source attribution helpers.
 *
 * classifySource() turns a raw document.referrer (and/or utm_source) into a
 * stable channel category — crucially including AI assistants (ChatGPT,
 * Perplexity, Gemini, Copilot, Claude) so we can finally answer "is ChatGPT
 * driving signups?". Note: LLMs frequently strip the referrer, so real
 * assistant traffic is under-counted and often lands in "direct".
 */
export type AttributionSource =
  | "chatgpt" | "perplexity" | "gemini" | "copilot" | "claude" | "ai_other"
  | "google" | "bing" | "duckduckgo" | "yandex" | "search_other"
  | "twitter" | "telegram" | "facebook" | "instagram" | "youtube"
  | "reddit" | "linkedin" | "tiktok" | "whatsapp" | "discord"
  | "direct" | "other";

const HOST_RULES: Array<{ re: RegExp; source: AttributionSource }> = [
  // AI assistants
  { re: /(chatgpt\.com|chat\.openai\.com|openai\.com)/i, source: "chatgpt" },
  { re: /(perplexity\.ai)/i, source: "perplexity" },
  { re: /(gemini\.google\.com|bard\.google\.com)/i, source: "gemini" },
  { re: /(copilot\.microsoft\.com|bing\.com\/chat)/i, source: "copilot" },
  { re: /(claude\.ai|anthropic\.com)/i, source: "claude" },
  // Search
  { re: /(^|\.)google\./i, source: "google" },
  { re: /(^|\.)bing\.com/i, source: "bing" },
  { re: /(duckduckgo\.com)/i, source: "duckduckgo" },
  { re: /(yandex\.)/i, source: "yandex" },
  // Social / messaging
  { re: /(t\.co|twitter\.com|x\.com)/i, source: "twitter" },
  { re: /(t\.me|telegram\.org|telegram\.me)/i, source: "telegram" },
  { re: /(facebook\.com|fb\.com|fb\.me|lm\.facebook\.com)/i, source: "facebook" },
  { re: /(instagram\.com|l\.instagram\.com)/i, source: "instagram" },
  { re: /(youtube\.com|youtu\.be)/i, source: "youtube" },
  { re: /(reddit\.com|redd\.it)/i, source: "reddit" },
  { re: /(linkedin\.com|lnkd\.in)/i, source: "linkedin" },
  { re: /(tiktok\.com)/i, source: "tiktok" },
  { re: /(whatsapp\.com|wa\.me)/i, source: "whatsapp" },
  { re: /(discord\.com|discord\.gg)/i, source: "discord" },
];

const UTM_RULES: Array<{ re: RegExp; source: AttributionSource }> = [
  { re: /(chatgpt|openai)/i, source: "chatgpt" },
  { re: /(perplexity)/i, source: "perplexity" },
  { re: /(gemini|bard)/i, source: "gemini" },
  { re: /(copilot)/i, source: "copilot" },
  { re: /(claude|anthropic)/i, source: "claude" },
  { re: /(google|adwords|gads)/i, source: "google" },
  { re: /(bing)/i, source: "bing" },
  { re: /(twitter|^x$)/i, source: "twitter" },
  { re: /(telegram|^tg$)/i, source: "telegram" },
  { re: /(facebook|^fb$|meta)/i, source: "facebook" },
  { re: /(instagram|^ig$)/i, source: "instagram" },
  { re: /(youtube|^yt$)/i, source: "youtube" },
  { re: /(reddit)/i, source: "reddit" },
  { re: /(linkedin)/i, source: "linkedin" },
  { re: /(tiktok)/i, source: "tiktok" },
];

export function classifySource(opts: { referrer?: string | null; utmSource?: string | null }): AttributionSource {
  const utm = (opts.utmSource || "").toLowerCase().trim();
  if (utm) {
    for (const r of UTM_RULES) if (r.re.test(utm)) return r.source;
    return "other";
  }
  const ref = (opts.referrer || "").trim();
  if (!ref) return "direct";
  let host = ref;
  try { host = new URL(ref.includes("://") ? ref : `https://${ref}`).hostname; } catch { /* keep raw */ }
  for (const r of HOST_RULES) if (r.re.test(host)) return r.source;
  return "other";
}

// ── Unsubscribe token (stateless HMAC — no extra column needed) ──────────────
const unsubSecret = (): string => config.str("ACCESS_TOKEN_SECRET") || "dynopay-unsub";

export function makeUnsubToken(userId: number): string {
  return crypto.createHmac("sha256", unsubSecret()).update(`unsub:${userId}`).digest("hex").slice(0, 32);
}

export function verifyUnsubToken(userId: number, token: string): boolean {
  if (!token) return false;
  const expected = makeUnsubToken(userId);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(token).slice(0, 32)));
  } catch {
    return false;
  }
}
