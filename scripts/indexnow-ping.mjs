#!/usr/bin/env node
/**
 * IndexNow deploy ping — notifies Bing/Yandex/Seznam/Naver the moment a new
 * deployment is live so pages get crawled within hours instead of weeks.
 * (Google ignores IndexNow; it re-crawls the sitemap submitted in Search Console.)
 *
 * Fired automatically by start-all.sh on production boot. The URL list comes
 * from the freshly booted frontend's own /sitemap.xml, so new pages (e.g. the
 * 14 SEO landing pages) are always included without maintaining a list here.
 *
 * Usage:
 *   node scripts/indexnow-ping.mjs [--dry-run] [--delay <seconds>] [--urls <csv>]
 * Env:
 *   INDEXNOW_DISABLED=true   skip entirely
 *   INDEXNOW_KEY             override key (default: read from public/indexnow-key.txt)
 *   FRONTEND_PORT            local Next.js port serving /sitemap.xml (default 3000)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SITE_HOST = "dynopay.com";
const SITE_URL = `https://${SITE_HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const SITEMAP_RETRIES = 20;
const SITEMAP_RETRY_MS = 15_000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const delaySec = Number(args[args.indexOf("--delay") + 1]) || 0;
const urlsOverride = args.includes("--urls")
  ? args[args.indexOf("--urls") + 1].split(",").map((u) => u.trim()).filter(Boolean)
  : null;

const log = (msg) => console.log(`[indexnow] ${msg}`);

function readKey() {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY.trim();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "frontend", "public", "indexnow-key.txt"), // combined prod image
    path.join(here, "..", "public", "indexnow-key.txt"), // repo layout
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8").trim();
  }
  throw new Error("IndexNow key not found (checked env INDEXNOW_KEY + public/indexnow-key.txt)");
}

async function fetchSitemapUrls() {
  const port = process.env.FRONTEND_PORT || 3000;
  const sitemapUrl = `http://localhost:${port}/sitemap.xml`;
  for (let attempt = 1; attempt <= SITEMAP_RETRIES; attempt++) {
    try {
      const res = await fetch(sitemapUrl);
      if (res.ok) {
        const xml = await res.text();
        const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
        if (urls.length > 0) return urls;
      }
      log(`sitemap not ready (HTTP ${res.status}), attempt ${attempt}/${SITEMAP_RETRIES}`);
    } catch (e) {
      log(`sitemap fetch failed (${e.message}), attempt ${attempt}/${SITEMAP_RETRIES}`);
    }
    await new Promise((r) => setTimeout(r, SITEMAP_RETRY_MS));
  }
  throw new Error(`could not read ${sitemapUrl} after ${SITEMAP_RETRIES} attempts`);
}

async function main() {
  if (process.env.INDEXNOW_DISABLED === "true") {
    log("INDEXNOW_DISABLED=true — skipping");
    return;
  }
  if (delaySec > 0) {
    log(`waiting ${delaySec}s for deployment to go live...`);
    await new Promise((r) => setTimeout(r, delaySec * 1000));
  }

  const key = readKey();
  const urlList = urlsOverride ?? (await fetchSitemapUrls());
  const payload = {
    host: SITE_HOST,
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList,
  };

  log(`submitting ${urlList.length} URLs (key ${key.slice(0, 8)}..., keyLocation ${payload.keyLocation})`);
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    log("dry-run — nothing sent");
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (res.status === 200 || res.status === 202) {
    log(`OK (HTTP ${res.status}) — ${urlList.length} URLs submitted; Bing/Yandex/Seznam/Naver will re-crawl shortly`);
  } else {
    log(`FAILED (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  log(`error: ${e.message}`);
  process.exitCode = 1;
});
