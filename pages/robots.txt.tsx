import { GetServerSideProps } from "next";

/**
 * Host-aware robots.txt.
 *
 * WHY A PAGE (not public/robots.txt): SafeDeal (safedeal.sh) and Dynopay
 * (dynopay.com) are served by the SAME app. A single static file would point
 * both hosts at the same Sitemap: line. Dotted paths bypass middleware, so this
 * server-rendered route inspects the Host header and returns the right robots
 * body per brand — each pointing at its OWN sitemap so Google/Bing discover the
 * correct URL set.
 */

const SAFEDEAL_HOSTS = new Set(["safedeal.sh", "www.safedeal.sh"]);

// Explicit allow-groups for AI search / answer engines (ChatGPT, Perplexity,
// Claude, Apple Intelligence, Common Crawl …) AND Google's AI surfaces. A named
// User-agent group overrides the generic `*` group for that agent, so each is
// granted the SAME full-content access (incl. model-training crawlers like
// GPTBot/CCBot, per an explicit "maximum visibility" decision). Only the
// non-indexable JSON API stays disallowed — identical to the `*` group.
const AI_BOT_RULES = `# ── AI search & answer engines — explicitly welcomed (maximum visibility, incl. training) ──
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Extended
User-agent: Googlebot
User-agent: Applebot-Extended
User-agent: ClaudeBot
User-agent: Claude-Web
User-agent: anthropic-ai
User-agent: CCBot
User-agent: Bytespider
User-agent: Amazonbot
User-agent: Meta-ExternalAgent
Allow: /
Allow: /api/public/
Allow: /api/status/
Disallow: /api/
`;


const DYNOPAY_ROBOTS = `# Dynopay — Cryptocurrency Payment Gateway
# https://dynopay.com
#
# Indexing is controlled PER PAGE with <meta name="robots" content="noindex">
# (pages/_app.tsx \`isPrivatePage\` + individual pages) and reinforced with an
# \`X-Robots-Tag: noindex\` response header on private routes (next.config.mjs).
#
# Private / authenticated / transactional pages are deliberately CRAWLABLE so
# Googlebot can SEE that noindex and DROP them from the index. Blocking them
# here instead is what caused "Indexed, though blocked by robots.txt" — Google
# indexed the bare URL because it was never allowed to crawl in and read the
# noindex tag. Only the non-HTML JSON API (no crawl value, never indexable)
# stays disallowed.

User-agent: *
Allow: /

# Public, read-only JSON that the marketing homepage renders (FX rates, price
# tickers, on-chain proof, recent settlements). Let Googlebot fetch these so the
# rendered page is complete for indexing. A more-specific Allow overrides the
# Disallow below (Googlebot uses longest-match). Analytics/geo endpoints
# (/api/geo-detect, /api/track/*) stay blocked on purpose — no crawl value.
Allow: /api/public/
Allow: /api/status/

# Backend JSON API — not indexable content, no crawl value.
Disallow: /api/

${AI_BOT_RULES}
Sitemap: https://dynopay.com/sitemap.xml
`;

const SAFEDEAL_ROBOTS = `# SafeDeal — Crypto Escrow
# https://safedeal.sh
#
# SafeDeal is served from the same app as Dynopay (see middleware.ts host
# rewrite). Private deal/wallet/signin pages carry a per-page noindex meta and
# are deliberately crawlable so search engines can read that noindex and drop
# them. Only the non-HTML JSON API stays disallowed.

User-agent: *
Allow: /

# Public, read-only JSON used by the marketing pages.
Allow: /api/public/
Allow: /api/status/

# Backend JSON API — not indexable content, no crawl value.
Disallow: /api/

${AI_BOT_RULES}
Sitemap: https://safedeal.sh/sitemap.xml
`;

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const host = (req.headers.host || "").toLowerCase().split(":")[0];
  const body = SAFEDEAL_HOSTS.has(host) ? SAFEDEAL_ROBOTS : DYNOPAY_ROBOTS;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(body);
  res.end();

  return { props: {} };
};

// Never rendered — getServerSideProps writes the plaintext response directly.
export default function RobotsTxt() {
  return null;
}
