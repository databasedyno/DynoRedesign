#!/usr/bin/env node
/**
 * Manual IndexNow submitter — force-pushes every URL in the live sitemap to
 * api.indexnow.org (Bing / DuckDuckGo / Yahoo / Yandex / Seznam).
 *
 * The backend does this automatically on boot when the sitemap changes
 * (backend/utils/indexNowSubmitter.ts); use this script for an on-demand
 * push, e.g. right after publishing new content.
 *
 *   node scripts/seo/submit-indexnow.mjs
 */

const SITE_HOST = "dynopay.com";
const SITE_URL = `https://${SITE_HOST}`;
const KEY = process.env.INDEXNOW_KEY || "9753d386db50a90331109c30a3d9dbb0";

const main = async () => {
  const r = await fetch(`${SITE_URL}/sitemap.xml`);
  if (!r.ok) throw new Error(`sitemap fetch failed: HTTP ${r.status}`);
  const xml = await r.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.startsWith(SITE_URL));
  if (!urls.length) throw new Error("no URLs found in sitemap");
  console.log(`Submitting ${urls.length} URLs to IndexNow...`);

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: SITE_HOST,
      key: KEY,
      keyLocation: `${SITE_URL}/${KEY}.txt`,
      urlList: urls.slice(0, 10000),
    }),
  });
  console.log(`IndexNow response: HTTP ${res.status} ${res.statusText}`);
  if (!res.ok && res.status !== 202) {
    console.error(await res.text().catch(() => ""));
    process.exit(1);
  }
  console.log("Done — Bing/DuckDuckGo/Yandex notified.");
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
