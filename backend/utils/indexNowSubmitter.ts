/**
 * IndexNow auto-submitter — instant indexing pings for Bing / DuckDuckGo /
 * Yahoo / Yandex / Seznam (Google does not support IndexNow; the sitemap in
 * Google Search Console covers it).
 *
 * Flow: fetch the live public sitemap → extract every <loc> URL → hash the
 * sorted URL set → if the hash differs from the last submitted one (Redis),
 * POST the full list to api.indexnow.org. Runs once per boot on job-enabled
 * instances (see server.ts); re-submits automatically whenever the sitemap
 * gains/loses URLs (new blog posts, SEO pages, storefronts, products).
 *
 * The key is intentionally NOT a secret — IndexNow requires it to be publicly
 * served at https://dynopay.com/{key}.txt (file lives in /public).
 */
import { createHash } from "crypto";
import { log } from "./loggers";
import { getRedisItem, setRedisItem } from "./redisInstance";

const SITE_HOST = "dynopay.com";
const SITE_URL = `https://${SITE_HOST}`;
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "9753d386db50a90331109c30a3d9dbb0";
const REDIS_HASH_KEY = "seo:indexnow:sitemap_hash";

export const submitSitemapToIndexNow = async (): Promise<void> => {
  try {
    const r = await fetch(`${SITE_URL}/sitemap.xml`, { headers: { Accept: "application/xml" } });
    if (!r.ok) {
      log(`[IndexNow] sitemap fetch failed: HTTP ${r.status} — skipping`, "warn");
      return;
    }
    const xml = await r.text();
    const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
      .map((m) => m[1].trim())
      .filter((u) => u.startsWith(SITE_URL));
    if (urls.length === 0) {
      log("[IndexNow] no URLs found in sitemap — skipping", "warn");
      return;
    }

    const hash = createHash("sha256").update([...urls].sort().join("\n")).digest("hex");
    const prev = await getRedisItem(REDIS_HASH_KEY);
    if (prev === hash) {
      log(`[IndexNow] sitemap unchanged (${urls.length} URLs) — nothing to submit`);
      return;
    }

    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000),
      }),
    });
    if (res.ok || res.status === 202) {
      await setRedisItem(REDIS_HASH_KEY, hash);
      log(`[IndexNow] submitted ${urls.length} URLs (HTTP ${res.status}) — search engines notified`);
    } else {
      const body = await res.text().catch(() => "");
      log(`[IndexNow] submission rejected: HTTP ${res.status} ${body.slice(0, 200)}`, "warn");
    }
  } catch (e) {
    log(`[IndexNow] failed soft: ${e instanceof Error ? e.message : String(e)}`, "warn");
  }
};
