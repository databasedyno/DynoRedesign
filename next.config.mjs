/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  // Optional alternate build dir so a prod build can run beside the dev server.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // TypeScript strict-mode is now enforced by `next build` (2026-08-02
  // Session 97i). Previously ignored because the frontend had 286
  // pre-existing strict-tsc errors; the Session 97e→97h cleanup arc
  // drove the count to 0 (see /app/.github/workflows/preflight.yml
  // history + backlog notes in test_result.md). The CI still runs a
  // separate `tsc --noEmit` check on every PR/push to catch drift in
  // <30s rather than the ~60s next build; this flag is the second
  // safety net so DO's `yarn build` also fails if drift ever lands.
  typescript: {
    ignoreBuildErrors: false,
  },
  // ESLint remains ignored during builds — the ruleset has ~500+
  // pre-existing warnings/errors (unused vars, missing-key, exhaustive-deps)
  // that would need a separate cleanup arc. Turning this on today would
  // block every build. Leave as-is until an ESLint cleanup PR arrives.
  eslint: {
    // Build fails on ESLint ERRORS only (warnings still allowed). Codebase is
    // error-clean as of 2026-08-23. `dirs` is explicit because Next's defaults
    // don't include the capital-C "Components" dir on case-sensitive Linux.
    ignoreDuringBuilds: false,
    dirs: ["pages", "Components", "utils", "hooks", "contexts", "helpers", "api", "Redux", "Containers"],
  },
  transpilePackages: ["mui-tel-input", "geist"],

  // ─── Performance: tree-shake heavy barrel-file libraries ───
  experimental: {
    // Restore scroll position on browser back/forward navigation (QA #35).
    scrollRestoration: true,
    optimizePackageImports: [
      "@mui/material",
      "@mui/icons-material",
      "@mui/lab",
      "recharts",
      "date-fns",
      "lodash",
      "@iconify/react",
      "react-i18next",
    ],
    // ─── Build-time memory guardrail (see Dockerfile Stage 2) ───
    // `next build` spawns `os.cpus().length - 1` static-generation worker
    // PROCESSES (7 on DigitalOcean's 8-core build machine), each with its own
    // multi-GB V8 heap ceiling. Stacked on kaniko's snapshotter that blew App
    // Platform's fixed 8 vCPU / 15 GiB build budget and DO terminated the job
    // ("BuildJobTerminated" — deployment f36c39b6, 2026-08-12). The Dockerfile
    // sets NEXT_BUILD_CPUS=2 for container builds; local/dev builds are left
    // at full speed because the var is unset there.
    ...(process.env.NEXT_BUILD_CPUS
      ? {
          cpus: Math.max(1, Number(process.env.NEXT_BUILD_CPUS) || 1),
          workerThreads: false,
        }
      : {}),
  },

  // Source maps are pure build-time memory/disk overhead for this app (errors
  // are triaged from server logs, not browser stacks). Explicit > implicit.
  productionBrowserSourceMaps: false,

  // ─── Compiler optimisations ───
  compiler: {
    // Remove console.log in production builds (keep errors/warns)
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dynopay.com",
      },
      {
        protocol: "https",
        hostname: "**.dynopay.com",
      },
      {
        protocol: "https",
        hostname: "**.preview.emergentagent.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      // Merchant product/store cover images are user-provided and can live on
      // ANY https host (own CDN, S3, Cloudinary, etc.), so allow the optimizer
      // to fetch any https image. Non-https / relative / data-URI sources are
      // rendered with a plain <img> fallback (see Components/UI/ProductImage),
      // so this wildcard only ever handles genuine https URLs.
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Uploaded avatars/logos are served by the BACKEND at /images/*. The Emergent
  // preview's K8s ingress only routes /api/* to the backend, so without this the
  // browser's /images/* requests hit Next and 404. Proxy them to the backend.
  // Dormant in production (nginx serves /images before Next ever sees it).
  async rewrites() {
    const backend = process.env.INTERNAL_API_URL || "http://localhost:8001";
    const afterFiles = [
      { source: "/images/:path*", destination: `${backend}/images/:path*` },
    ];
    // ─── Branded short checkout links ───
    // On the checkout subdomain a bare 6-char base62 code renders the hosted
    // checkout with a clean URL (no ?d=). Host-scoped to CHECKOUT_URL so it
    // never touches the main/creator domain or the Emergent preview (whose host
    // is never checkout.dynopay.com), and length-locked to 6 chars so it can't
    // shadow /pay, /api, static assets or any real single-segment checkout page.
    const beforeFiles = [];
    const checkoutHost = (process.env.CHECKOUT_URL || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    if (checkoutHost) {
      beforeFiles.push({
        source: "/:code([A-Za-z0-9]{6})",
        has: [{ type: "host", value: checkoutHost }],
        destination: "/pay?d=:code",
      });
    }
    return { beforeFiles, afterFiles };
  },


  // ─── Opt-in to the User Preference Media-Features Client Hint so the
  //     browser sends `Sec-CH-Prefers-Color-Scheme` on every request. This
  //     lets SSR pick the correct MUI theme on the FIRST paint (no flash
  //     from dark → light for users whose OS is set to light). `Critical-CH`
  //     tells Chromium browsers to re-issue the very first request with the
  //     hint attached, so even a brand-new visitor never sees the wrong
  //     theme on first load. Firefox/Safari fall back to the cookie set by
  //     the blocking script in `_document.tsx` on subsequent loads.
  //     Docs: https://developer.mozilla.org/en-US/docs/Web/HTTP/Client_hints
  async headers() {
    // Private / authenticated / transactional route prefixes (first path
    // segment). These are CRAWLABLE (see public/robots.txt) so Googlebot can
    // read this authoritative noindex and drop them from the index — the fix
    // for the "Indexed, though blocked by robots.txt" Search Console warning.
    // Kept in sync with pages/_app.tsx `isPrivatePage`. None of these are public
    // marketing pages (e.g. /referral-program & /about stay indexable).
    const PRIVATE_SEGMENTS = [
      "dashboard", "transactions", "pay-links", "create-pay-link",
      "wallet", "wallet-security", "customers", "developer-keys",
      "invoices", "company", "profile", "notifications", "referrals",
      "settings", "admin", "auth", "reset-password", "payouts",
      "payment", "order", "receipt", "kyc", "unsubscribe", "storefront",
    ].join("|");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Accept-CH", value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Critical-CH", value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Vary", value: "Sec-CH-Prefers-Color-Scheme" },
        ],
      },
      {
        // Matches the prefix itself AND everything under it (":path*" is zero-or-more):
        // /auth, /auth/login, /dashboard, /dashboard/settings, /reset-password, …
        source: `/:seg(${PRIVATE_SEGMENTS})/:path*`,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

// F3: opt-in bundle analysis. Lazily import @next/bundle-analyzer ONLY when
// ANALYZE=true so normal dev/prod builds and the running server never load it.
// Run `ANALYZE=true yarn build` to generate the treemap report and name the
// exact heavy chunks (framer-motion / MUI / recharts) before trimming them.
let withBundleAnalyzer = (config) => config;
if (process.env.ANALYZE === "true") {
  const mod = await import("@next/bundle-analyzer");
  withBundleAnalyzer = mod.default({ enabled: true });
}

export default withBundleAnalyzer(nextConfig);
