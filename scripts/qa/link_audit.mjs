#!/usr/bin/env node
// CTA / link audit — three passes, one JSON report.
//   node scripts/qa/link_audit.mjs --base=<preview> [--prod=https://dynopay.com] [--out=memory/reports/link_audit.json]
//
//  A. STATIC (frontend): every internal href/route literal in Components/, pages/, Containers/, hooks/, utils/,
//     helpers/, constants/ is resolved against the real pages/ tree (dynamic segments honoured). Unresolved → "broken".
//  B. EMAIL / BACKEND: every `${<urlBase>}/path` literal built in backend/ (emails, notifications, receipts) is
//     resolved the same way (frontend routes) or against known backend/public routes (/api/*, /images/*, /og/*).
//  C. LIVE: crawl the public pages on --base (and --prod when given), collect every same-origin <a href>, and
//     request each unique URL once. Non-2xx (after redirects) → "broken".
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const OUT = path.resolve(ROOT, args.out || "memory/reports/link_audit.json");
const BASE = (args.base || "").replace(/\/+$/, "");
const PROD = (args.prod || "").replace(/\/+$/, "");

function walk(dir, exts, skip = ["node_modules", "__tests__", "tests"]) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (skip.includes(ent.name)) continue;
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(rel, exts, skip));
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(rel);
  }
  return out;
}

/* ---------- routes from pages/ ---------- */
function collectRoutes() {
  const files = walk("pages", [".tsx", ".ts"]).filter((f) => !f.startsWith("pages/api/"));
  const routes = [];
  for (const f of files) {
    let r = f.replace(/^pages/, "").replace(/\.tsx?$/, "").replace(/\/index$/, "") || "/";
    if (/^\/_(app|document|error)$/.test(r)) continue;
    routes.push(r);
  }
  routes.push("/404");
  return routes;
}
function routeToRegex(r) {
  const parts = r.split("/").filter(Boolean).map((seg) => {
    if (/^\[\.\.\..+\]$/.test(seg)) return ".+";
    if (/^\[.+\]$/.test(seg)) return "[^/]+";
    return seg.replace(/[.*+?^${}()|\\]/g, "\\$&");
  });
  return new RegExp("^/" + parts.join("/") + "/?$");
}
const ROUTES = collectRoutes();
const ROUTE_RX = ROUTES.map((r) => ({ r, rx: routeToRegex(r) }));
// Non-page paths that are legitimately served (rewrites, static, backend proxies, host-scoped).
const SERVED_PREFIXES = ["/api/", "/images/", "/og/", "/_next/", "/landing/", "/press/", "/safedeal/", "/email/", "/fonts/", "/icons/", "/badges/", "/brand/", "/docs/"];
const STATIC_FILE = /\.(png|jpe?g|svg|webp|gif|ico|css|js|json|xml|txt|pdf|webmanifest|mp4|woff2?|zip|md)$/i;
function resolveInternal(href) {
  let p = href.split("#")[0].split("?")[0];
  if (!p) return { ok: true, kind: "hash/query-only" };
  if (!p.startsWith("/")) return { ok: true, kind: "external" };
  if (p.startsWith("//")) return { ok: true, kind: "protocol-relative" };
  if (STATIC_FILE.test(p)) return { ok: fs.existsSync(path.join(ROOT, "public", p)) || SERVED_PREFIXES.some((s) => p.startsWith(s)), kind: "static" };
  if (SERVED_PREFIXES.some((s) => p.startsWith(s))) return { ok: true, kind: "served-prefix" };
  if (p.length > 1) p = p.replace(/\/+$/, "");
  const hit = ROUTE_RX.find(({ rx }) => rx.test(p));
  // Storefront catch-all: /[handle] also serves any single-segment merchant handle (resolved at runtime).
  return hit ? { ok: true, kind: "page", route: hit.r } : { ok: false, kind: "unresolved" };
}

/* ---------- A. static frontend literals ---------- */
const FE_DIRS = ["Components", "pages", "Containers", "hooks", "utils", "helpers", "constants", "contexts"];
const HREF_RX = /(?:href|to|link|url|path|route|pathname|as|target|redirect|goto)\s*[:=]\s*(?:\{\s*)?["'`](\/[^"'`\s]*)["'`]|\.(?:push|replace|prefetch)\(\s*["'`](\/[^"'`\s]*)["'`]|<a[^>]*href=["'](\/[^"']*)["']|href=\{["'](\/[^"']*)["']\}/g;
function scanFrontend() {
  const files = FE_DIRS.flatMap((d) => walk(d, [".tsx", ".ts"]));
  const found = new Map(); // href -> [file:line]
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    const lines = src.split("\n");
    lines.forEach((ln, i) => {
      let m;
      HREF_RX.lastIndex = 0;
      while ((m = HREF_RX.exec(ln))) {
        const href = m[1] || m[2] || m[3] || m[4];
        if (!href || href.includes("${") || href.startsWith("/api/") || href.startsWith("//")) continue;
        if (href === "/" ) continue;
        if (!found.has(href)) found.set(href, []);
        if (found.get(href).length < 5) found.get(href).push(`${f}:${i + 1}`);
      }
    });
  }
  const broken = [];
  for (const [href, where] of found) {
    const r = resolveInternal(href);
    if (!r.ok) broken.push({ href, where });
  }
  return { scanned: found.size, broken };
}

/* ---------- B. backend email / notification link literals ---------- */
const BE_LINK_RX = /\$\{[^}]*(?:URL|Url|url|BASE|Base|base|SITE|Site|origin|Origin|host|Host)[^}]*\}(\/[A-Za-z0-9_.\/\-\[\]:${}?=&-]*)/g;
function scanBackend() {
  const out = [];
  for (const f of walk("backend", [".ts"], ["node_modules", "__tests__", "tests", "scripts", "dist"])) {
    const lines = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n");
    lines.forEach((ln, i) => {
      let m;
      BE_LINK_RX.lastIndex = 0;
      while ((m = BE_LINK_RX.exec(ln))) out.push(`${f}:${i + 1}:$\{X\}${m[1]}`);
    });
  }
  const found = new Map();
  for (const line of out) {
    const m = line.match(/^([^:]+):(\d+):\$\{[^}]*\}(\/.*)$/);
    if (!m) continue;
    let p = m[3].replace(/\$\{[^}]*\}/g, "X").replace(/[?#].*$/, "").replace(/[),;'"\`\s].*$/, "");
    if (!p || p.startsWith("/api/")) continue;
    if (!found.has(p)) found.set(p, []);
    if (found.get(p).length < 4) found.get(p).push(`${m[1]}:${m[2]}`);
  }
  const broken = [];
  for (const [p, where] of found) {
    const r = resolveInternal(p);
    if (!r.ok) broken.push({ href: p, where });
  }
  return { scanned: found.size, all: [...found.keys()].sort(), broken };
}

/* ---------- C. live crawl ---------- */
const DEFAULT_PAGES = ["/", "/fees", "/documentation", "/about", "/press", "/blog", "/how-to", "/referral-program", "/system-status", "/help-support", "/terms-conditions", "/privacy-policy", "/aml-policy", "/for/creators", "/for/ecommerce", "/for/saas", "/for/nonprofits", "/auth/login", "/auth/register", "/pay/demo", "/pay/donation-demo", "/safedeal", "/safedeal/help", "/safedeal/terms", "/safedeal/privacy", "/safedeal/deals/new", "/safedeal/signin"];
const PUBLIC_PAGES = args.pages ? args.pages.split(",") : DEFAULT_PAGES;
async function fetchStatus(url, method = "GET") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { method, redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) DynopayLinkAudit/1.0", Accept: "text/html,*/*" } });
    const text = method === "GET" && (r.headers.get("content-type") || "").includes("text/html") ? await r.text() : "";
    return { status: r.status, finalUrl: r.url, html: text };
  } catch (e) {
    return { status: 0, error: String(e.message || e).slice(0, 120), html: "" };
  } finally {
    clearTimeout(t);
  }
}
function extractLinks(html, origin) {
  const links = new Set();
  const rx = /<a\b[^>]*\bhref=["']([^"'#]+)(?:#[^"']*)?["']/gi;
  let m;
  while ((m = rx.exec(html))) {
    let h = m[1].trim();
    if (!h || h.startsWith("mailto:") || h.startsWith("tel:") || h.startsWith("javascript:")) continue;
    try {
      const u = new URL(h, origin);
      if (u.origin !== origin) continue;
      if (u.pathname.startsWith("/_next/")) continue;
      links.add(u.pathname + u.search);
    } catch { /* ignore */ }
  }
  return [...links];
}
async function crawl(origin, label) {
  if (!origin) return null;
  const pageResults = [];
  const allLinks = new Map(); // path -> Set(sourcePage)
  for (const p of PUBLIC_PAGES) {
    const r = await fetchStatus(origin + p);
    pageResults.push({ page: p, status: r.status, finalUrl: r.finalUrl });
    if (r.status >= 200 && r.status < 400 && r.html) {
      for (const l of extractLinks(r.html, origin)) {
        if (!allLinks.has(l)) allLinks.set(l, new Set());
        allLinks.get(l).add(p);
      }
    }
    process.stdout.write(`${label} ${p} ${r.status}\n`);
  }
  const checked = [];
  const paths = [...allLinks.keys()];
  const CONC = 6;
  for (let i = 0; i < paths.length; i += CONC) {
    await Promise.all(paths.slice(i, i + CONC).map(async (l) => {
      const r = await fetchStatus(origin + l);
      checked.push({ href: l, status: r.status, finalUrl: r.finalUrl, error: r.error, from: [...allLinks.get(l)].slice(0, 4) });
    }));
  }
  const broken = checked.filter((c) => !(c.status >= 200 && c.status < 400)).sort((a, b) => a.href.localeCompare(b.href));
  return { origin, pages: pageResults, uniqueLinks: checked.length, broken };
}

/* ---------- run ---------- */
const report = { generatedAt: new Date().toISOString(), routes: ROUTES.length };
report.staticFrontend = args["skip-static"] ? { scanned: 0, broken: [] } : scanFrontend();
report.backendLinks = args["skip-static"] ? { scanned: 0, all: [], broken: [] } : scanBackend();
report.live = { base: await crawl(BASE, "base"), prod: await crawl(PROD, "prod") };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log("\n=== STATIC FRONTEND: scanned", report.staticFrontend.scanned, "hrefs; broken", report.staticFrontend.broken.length);
for (const b of report.staticFrontend.broken) console.log("  ✗", b.href, "←", b.where.join(", "));
console.log("=== BACKEND/EMAIL: scanned", report.backendLinks.scanned, "paths; broken", report.backendLinks.broken.length);
for (const b of report.backendLinks.broken) console.log("  ✗", b.href, "←", b.where.join(", "));
for (const k of ["base", "prod"]) {
  const l = report.live[k];
  if (!l) continue;
  console.log(`=== LIVE ${k} ${l.origin}: pages ${l.pages.filter((p) => p.status >= 200 && p.status < 400).length}/${l.pages.length} ok; unique links ${l.uniqueLinks}; broken ${l.broken.length}`);
  for (const p of l.pages.filter((p) => !(p.status >= 200 && p.status < 400))) console.log("  ✗ PAGE", p.page, p.status);
  for (const b of l.broken) console.log("  ✗", b.href, b.status, b.error || "", "← from", b.from.join(", "));
}
console.log("report:", OUT);
