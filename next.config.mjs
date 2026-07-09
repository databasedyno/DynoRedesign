/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["mui-tel-input", "geist"],

  // ─── Performance: tree-shake heavy barrel-file libraries ───
  experimental: {
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
  },

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
    ],
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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Accept-CH", value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Critical-CH", value: "Sec-CH-Prefers-Color-Scheme" },
          { key: "Vary", value: "Sec-CH-Prefers-Color-Scheme" },
        ],
      },
    ];
  },
};

export default nextConfig;
