/**
 * Bing Webmaster Tools readiness check.
 *
 * Bing indexing for dynopay.com is already driven by two mechanisms that need no
 * per-boot API call:
 *   1. IndexNow (see indexNowSubmitter.ts) — Bing is a primary IndexNow consumer,
 *      so every sitemap URL is pushed instantly whenever the URL set changes.
 *   2. robots.txt `Sitemap:` directive — once the site is verified, Bing auto-
 *      discovers and recrawls https://dynopay.com/sitemap.xml on its own.
 *
 * So here we don't re-submit anything (the JSON Webmaster API doesn't expose a
 * working SubmitSitemap operation, and SubmitUrlbatch has a tight daily quota
 * that IndexNow already saves us from). Instead we use the Webmaster API key to
 * CONFIRM that dynopay.com is verified under that key's account and log the URL
 * submission quota — surfacing a clear, actionable reminder if verification ever
 * lapses. Read-only, fails soft, and no-ops without BING_WEBMASTER_API_KEY.
 * Runs on job-enabled (WORKER_ROLE=primary) instances only — see server.ts.
 */
import { log } from "./loggers";

const SITE_URL = "https://dynopay.com";
const BING_API = "https://ssl.bing.com/webmaster/api.svc/json";

export const checkBingWebmasterReadiness = async (): Promise<void> => {
  const apikey = process.env.BING_WEBMASTER_API_KEY;
  if (!apikey) {
    log("[Bing] BING_WEBMASTER_API_KEY not set — skipping Bing readiness check");
    return;
  }
  try {
    const url =
      `${BING_API}/GetUrlSubmissionQuota` +
      `?apikey=${encodeURIComponent(apikey)}&siteUrl=${encodeURIComponent(SITE_URL)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text().catch(() => "");
    let json: { ErrorCode?: number; d?: { DailyQuota?: number; MonthlyQuota?: number } } | undefined;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON */
    }

    if (json?.ErrorCode === 14) {
      log(
        `[Bing] ${SITE_URL} is NOT verified under this API key's account yet. Add the Bing ` +
          `verification CNAME and click Verify in Bing Webmaster Tools (or import from Google ` +
          `Search Console). Bing still receives URLs via IndexNow meanwhile.`,
        "warn",
      );
      return;
    }
    if (!res.ok || json === undefined) {
      log(`[Bing] readiness check inconclusive: HTTP ${res.status} ${text.slice(0, 120)}`, "warn");
      return;
    }

    const daily = json?.d?.DailyQuota;
    log(
      `[Bing] ✅ Webmaster Tools verified for ${SITE_URL}` +
        (typeof daily === "number" ? ` (daily URL-submission quota: ${daily})` : "") +
        ` — sitemap auto-crawled via robots.txt + IndexNow handles instant pings.`,
    );
  } catch (e) {
    log(`[Bing] readiness check failed soft: ${e instanceof Error ? e.message : String(e)}`, "warn");
  }
};
