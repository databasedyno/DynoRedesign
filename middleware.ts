import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Production guard for development-only pages.
 *
 * WHY THIS EXISTS
 * ---------------
 * A real `next build` of this repo confirmed that the internal QA/fake-state
 * pages ship to the production domain and are publicly routable:
 *
 *   /QA                        /pay/state-demo
 *   /pay/success-demo          /pay/payment-states-demo
 *   /pay/tip-card-demo
 *
 * They render *fake payment states* ("payment received", "pending", success
 * screens). For a payments company, a customer or a search engine finding a
 * convincing fake "payment successful" page on dynopay.com is a trust problem,
 * not a cosmetic one.
 *
 * NOT blocked: /pay/demo and /pay/donation-demo. Those are the public product
 * demos every landing CTA (hero, products bento, footer, SEO pages, docs) links
 * to — blocking them 404'd ~12 CTAs on production (2026-09). They carry their
 * own noindex meta + a visible "Sandbox demo" label instead.
 *
 * Middleware is used instead of per-page `getServerSideProps` because none of
 * these six pages export any data-fetching function — they are pure client
 * components, so Next serves them as static HTML and a page-level guard would
 * never run. Middleware executes before the static asset is served, so it is
 * the only reliable gate. The `matcher` below is an exact allow-list, so this
 * file cannot affect any other route in the app.
 *
 * BEHAVIOUR
 *   production                        -> blocked (real 404)
 *   local dev / preview               -> reachable, so QA keeps its tools
 *   BLOCK_DEV_PAGES=true              -> force blocking anywhere (used to test this guard)
 *   BLOCK_DEV_PAGES=false             -> escape hatch to re-open them in production
 */

const DEV_ONLY_PATHS = new Set([
  "/QA",
  "/pay/payment-states-demo",
  "/pay/state-demo",
  "/pay/success-demo",
  "/pay/tip-card-demo",
]);

function shouldBlock(): boolean {
  if (process.env.BLOCK_DEV_PAGES === "true") return true;
  if (process.env.BLOCK_DEV_PAGES === "false") return false;
  return process.env.NODE_ENV === "production";
}

const SAFEDEAL_HOSTS = new Set(["safedeal.sh", "www.safedeal.sh"]);

/**
 * AI search / answer-engine crawlers we log for the admin analytics panel.
 * Keep in sync with backend/utils/aiBots.ts (Edge middleware can't import it).
 * General search bots (Googlebot/Bingbot) are intentionally excluded — Search
 * Console already covers them and they'd dwarf the AI signal.
 */
const AI_BOTS: Array<[string, RegExp]> = [
  ["GPTBot", /GPTBot/i],
  ["OAI-SearchBot", /OAI-SearchBot/i],
  ["ChatGPT-User", /ChatGPT-User/i],
  ["PerplexityBot", /PerplexityBot/i],
  ["Perplexity-User", /Perplexity-User/i],
  ["ClaudeBot", /ClaudeBot/i],
  ["Claude-Web", /Claude-Web/i],
  ["anthropic-ai", /anthropic-ai/i],
  ["CCBot", /CCBot/i],
  ["Bytespider", /Bytespider/i],
  ["Applebot", /Applebot/i],
  ["Amazonbot", /Amazonbot/i],
  ["Meta-ExternalAgent", /Meta-ExternalAgent/i],
];

/** Fire-and-forget: record an AI crawler's content-page fetch. Never blocks routing.
 *  Beacons to the backend over the loopback interface (same container as Next in
 *  both preview and production) so it never depends on a public-origin hairpin or
 *  on edge `waitUntil` (unreliable when self-hosting). Awaited with a short abort
 *  timeout — only AI-bot GETs ever reach the await, so real users are unaffected. */
const BOT_BEACON_ORIGIN = process.env.BOT_BEACON_ORIGIN || "http://127.0.0.1:3300";

async function logBotHit(req: NextRequest): Promise<void> {
  try {
    if (req.method !== "GET") return;
    const path = req.nextUrl.pathname;
    if (path.startsWith("/api") || path.startsWith("/_next")) return;
    const ua = req.headers.get("user-agent") || "";
    if (!ua) return;
    let bot: string | null = null;
    for (const [name, re] of AI_BOTS) {
      if (re.test(ua)) { bot = name; break; }
    }
    if (!bot) return;
    const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 800);
    try {
      await fetch(`${BOT_BEACON_ORIGIN}/api/track/bot-hit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bot, path, host, ip, ua }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* never let analytics break routing */
  }
}

export async function middleware(req: NextRequest) {
  // AI-crawler analytics — awaited only for bot GETs (loopback beacon ~few ms);
  // real users short-circuit before any await.
  await logBotHit(req);

  // SafeDeal (safedeal.sh) is served by this same app from /safedeal/*. Rewrite
  // the host's root paths onto that section so one deployment serves both domains.
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (SAFEDEAL_HOSTS.has(host)) {
    const p = req.nextUrl.pathname;
    const passthrough = p.startsWith("/_next") || p.startsWith("/api") || p.startsWith("/safedeal") || /\.[a-z0-9]+$/i.test(p);
    if (!passthrough) {
      const url = req.nextUrl.clone();
      url.pathname = `/safedeal${p === "/" ? "" : p}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  if (!shouldBlock()) return NextResponse.next();

  // Normalise a trailing slash so "/QA/" is treated the same as "/QA".
  const pathname = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (!DEV_ONLY_PATHS.has(pathname)) return NextResponse.next();

  // Rewrite to a path that intentionally does not exist. Next then resolves its
  // own 404 page AND returns a genuine 404 status code — rewriting straight to
  // "/404" would render the right page but answer with 200, which would keep
  // these URLs indexable.
  const url = req.nextUrl.clone();
  url.pathname = "/_dev-page-not-available";
  return NextResponse.rewrite(url);
}

export const config = {
  // Exact dev-page paths + everything except static assets for the SafeDeal host
  // rewrite (the handler itself early-returns for non-SafeDeal hosts).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
