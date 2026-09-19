import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Production guard for development-only pages.
 *
 * WHY THIS EXISTS
 * ---------------
 * A real `next build` of this repo confirmed that six QA/demo pages ship to the
 * production domain and are publicly routable:
 *
 *   /QA                        /pay/state-demo
 *   /pay/demo                  /pay/success-demo
 *   /pay/donation-demo         /pay/payment-states-demo
 *
 * Five of them render *fake payment states* ("payment received", "pending",
 * success screens). For a payments company, a customer or a search engine
 * finding a convincing fake "payment successful" page on dynopay.com is a
 * trust problem, not a cosmetic one.
 *
 * Middleware is used instead of per-page `getServerSideProps` because none of
 * these six pages export any data-fetching function — they are pure client
 * components, so Next serves them as static HTML and a page-level guard would
 * never run. Middleware executes before the static asset is served, so it is
 * the only reliable gate. The `matcher` below is an exact allow-list, so this
 * file cannot affect any other route in the app.
 *
 * BEHAVIOUR
 *   production                        -> blocked (real 404)
 *   local dev / preview               -> reachable, so QA keeps its tools
 *   BLOCK_DEV_PAGES=true              -> force blocking anywhere (used to test this guard)
 *   BLOCK_DEV_PAGES=false             -> escape hatch to re-open them in production
 */

const DEV_ONLY_PATHS = new Set([
  "/QA",
  "/pay/demo",
  "/pay/donation-demo",
  "/pay/payment-states-demo",
  "/pay/state-demo",
  "/pay/success-demo",
  "/pay/tip-card-demo",
]);

function shouldBlock(): boolean {
  if (process.env.BLOCK_DEV_PAGES === "true") return true;
  if (process.env.BLOCK_DEV_PAGES === "false") return false;
  return process.env.NODE_ENV === "production";
}

const SAFEDEAL_HOSTS = new Set(["safedeal.sh", "www.safedeal.sh"]);

export function middleware(req: NextRequest) {
  // SafeDeal (safedeal.sh) is served by this same app from /safedeal/*. Rewrite
  // the host's root paths onto that section so one deployment serves both domains.
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  if (SAFEDEAL_HOSTS.has(host)) {
    const p = req.nextUrl.pathname;
    const passthrough = p.startsWith("/_next") || p.startsWith("/api") || p.startsWith("/safedeal") || /\.[a-z0-9]+$/i.test(p);
    if (!passthrough) {
      const url = req.nextUrl.clone();
      url.pathname = `/safedeal${p === "/" ? "" : p}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  if (!shouldBlock()) return NextResponse.next();

  // Normalise a trailing slash so "/QA/" is treated the same as "/QA".
  const pathname = req.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (!DEV_ONLY_PATHS.has(pathname)) return NextResponse.next();

  // Rewrite to a path that intentionally does not exist. Next then resolves its
  // own 404 page AND returns a genuine 404 status code — rewriting straight to
  // "/404" would render the right page but answer with 200, which would keep
  // these URLs indexable.
  const url = req.nextUrl.clone();
  url.pathname = "/_dev-page-not-available";
  return NextResponse.rewrite(url);
}

export const config = {
  // Exact dev-page paths + everything except static assets for the SafeDeal host
  // rewrite (the handler itself early-returns for non-SafeDeal hosts).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
