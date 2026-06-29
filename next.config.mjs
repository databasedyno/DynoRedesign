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
  transpilePackages: ["mui-tel-input"],

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
};

export default nextConfig;
