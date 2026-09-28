import { GetServerSideProps } from "next";

/**
 * Host-aware SafeDeal web-app manifest.
 *
 * WHY A PAGE (not public/safedeal/site.webmanifest): SafeDeal is served from
 * /safedeal/* in preview but from "/" on safedeal.sh (middleware host rewrite).
 * `scope`/`start_url` must match the host the user installs from, otherwise the
 * installed app opens out-of-scope with browser chrome on one of the two hosts.
 * The dotted path bypasses the middleware rewrite and resolves on both hosts.
 */
const SAFEDEAL_HOSTS = new Set(["safedeal.sh", "www.safedeal.sh"]);

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const host = (req.headers.host || "").toLowerCase().split(":")[0];
  const base = SAFEDEAL_HOSTS.has(host) ? "" : "/safedeal";
  const manifest = {
    id: `${base || ""}/?app=safedeal`,
    name: "SafeDeal — Crypto escrow",
    short_name: "SafeDeal",
    description: "Escrow for online deals — SafeDeal holds the buyer's payment in USDT until the seller delivers.",
    lang: "en",
    dir: "ltr",
    scope: `${base}/`,
    start_url: `${base}/deals?source=pwa`,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    theme_color: "#FFC61A",
    background_color: "#F5F7FA",
    categories: ["finance", "business"],
    icons: [
      { src: "/safedeal/favicon-192.png?v=1", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/safedeal/favicon-512.png?v=1", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/safedeal/favicon-maskable-512.png?v=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New deal", short_name: "New deal", url: `${base}/deals/new?source=pwa`, icons: [{ src: "/safedeal/favicon-192.png?v=1", sizes: "192x192" }] },
      { name: "My deals", short_name: "Deals", url: `${base}/deals?tab=deals&source=pwa`, icons: [{ src: "/safedeal/favicon-192.png?v=1", sizes: "192x192" }] },
      { name: "Wallet", short_name: "Wallet", url: `${base}/wallet?source=pwa`, icons: [{ src: "/safedeal/favicon-192.png?v=1", sizes: "192x192" }] },
    ],
  };

  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(JSON.stringify(manifest));
  res.end();
  return { props: {} };
};

// Never rendered — getServerSideProps writes the JSON response directly.
export default function SafeDealManifest() {
  return null;
}
