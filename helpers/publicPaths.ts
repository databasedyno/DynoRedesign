/**
 * Route classification for session handling.
 *
 * Only the merchant dashboard (in-app) and the admin panel require a signed-in
 * session. EVERYTHING else — marketing pages (/, /press, /about, /fees…), blog and
 * SEO pages, auth screens, buyer checkout (/pay, /payment, /<handle>/…), receipts,
 * order pages, the help centre — is public: a visitor with no token, or with a
 * stale/expired token left in localStorage, must never be bounced to /auth/login.
 *
 * Works with real URL paths ("/jltvisuals/shop") AND Next route patterns
 * ("/[handle]/shop"): protected routes are literal prefixes, so any route with a
 * dynamic first segment is public by construction.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/brands",
  "/transactions",
  "/wallet",
  "/wallet-security",
  "/customers",
  "/invoices",
  "/notifications",
  "/settings",
  "/profile",
  "/create-pay-link",
  "/pay-links",
  "/referrals",
  "/developer-keys",
  "/payouts",
  "/get-started",
  "/kyc",
  "/storefront",
  "/escrow",
  "/admin",
];
const PROTECTED_EXCEPTIONS = new Set(["/admin/login"]);

/**
 * Public sub-trees that live UNDER a protected prefix. The escrow counterparty
 * page (/escrow/invite/:token) is a public, account-less surface even though
 * the merchant escrow dashboard (/escrow, /escrow/:id) is protected — so a
 * lost/expired token must never bounce an invited buyer/seller to /auth/login.
 */
const PUBLIC_PREFIXES = ["/escrow/invite"];

const normalize = (pathname: string) => (pathname || "/").replace(/\/+$/, "") || "/";

/** In-app / admin route — the only surfaces that may redirect to login on a lost session. */
export const isProtectedPath = (pathname: string): boolean => {
  const p = normalize(pathname);
  if (PROTECTED_EXCEPTIONS.has(p)) return false;
  if (PUBLIC_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/"))) return false;
  return PROTECTED_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/"));
};

export const isPublicPath = (pathname: string): boolean => !isProtectedPath(pathname);
