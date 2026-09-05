import "@/styles/globals.css";
import "nprogress/nprogress.css";
import i18n from "../i18n";

// ── 3B: hydrate the server-selected locale synchronously BEFORE first render ──
// The server picks the ?lang= locale in App.getInitialProps and serializes its
// resources into __NEXT_DATA__; applying them here (client, at module eval)
// guarantees the first client render matches the server HTML — no hydration flash.
if (typeof window !== "undefined") {
  try {
    const boot = (
      window as unknown as {
        __NEXT_DATA__?: { props?: { i18nLang?: string; i18nResources?: Record<string, object> } };
      }
    ).__NEXT_DATA__?.props;
    const bl = boot?.i18nLang;
    if (bl && bl !== "en") {
      const res = boot?.i18nResources;
      if (res) for (const ns of Object.keys(res)) i18n.addResourceBundle(bl, ns, res[ns], true, true);
      if (i18n.language !== bl) i18n.changeLanguage(bl);
    }
  } catch {
    /* non-fatal — falls back to English */
  }
}

// Geist Sans + Mono — Vercel's OSS typeface, self-hosted from the `geist`
// package but declared with next/font/local directly so we control `display`.
// HISTORY: 2026-07-10 set display:"optional" to kill a FOUT size-jump. That
// caused a WORSE user-reported bug (2026-08-14): on a COLD mobile load the
// font missed the ~100ms "optional" window, so the ENTIRE landing page stuck
// on the Arial/Helvetica fallback for the whole visit (hero wrapped in 2
// lines instead of 3, wrong body/mono faces) and only looked right on warm
// (cached) visits — i.e. the page style differed between visits.
// FIX: display:"swap" — the correct font ALWAYS wins once loaded. next/font's
// automatic size-adjusted fallback (adjustFontFallback, on by default) keeps
// the swap-in shift small, and same-origin preload makes a visible swap rare
// (cold first paint only). DO NOT change back to "optional" — that re-breaks
// cold-load font consistency (same class of bug was already fixed for the
// Manrope @font-face set in globals.css, see comments there).
import localFont from "next/font/local";

const GeistSans = localFont({
  src: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

// Swiss landing / dashboard display + body + mono faces.
// HISTORY: 2026-07-21 moved these off the Google Fonts <link> onto next/font
// with display:"optional". Same cold-load bug as above (2026-08-14): Unbounded
// is THE hero-headline font ("Get paid in crypto. Every way you sell.") — with
// "optional" a first-time mobile visitor got the fallback for the whole visit
// (hero in Helvetica, 2 lines) while repeat visitors got Unbounded (3 lines).
// FIX: display:"swap" so the brand font always applies. Self-hosted + preloaded
// by next/font, so the swap window only exists on a genuinely cold first paint.
import { Unbounded, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const UnboundedFont = Unbounded({
  subsets: ["latin"],
  // F6 font diet: Unbounded is only a FALLBACK in the --font-hero stack (Manrope
  // wins, see globals.css), so it is essentially never painted. It previously
  // shipped 5 weight files (300/400/500/600/800) for nothing. Trimmed to a
  // single weight — enough for the rare fallback case, ~4 fewer font downloads.
  weight: ["400"],
  display: "swap",
});

const PlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const PlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

import type { NextPage } from "next";
import NextApp, { type AppProps, type AppContext } from "next/app";
import { useRouter } from "next/router";
import Head from "next/head";
import React, { ReactNode, useEffect, useLayoutEffect, useMemo, useState } from "react";
import NProgress from "nprogress";
import dynamic from "next/dynamic";
import { useTranslation, I18nextProvider } from "react-i18next";

import type { SxProps, Theme } from "@mui/material";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { CacheProvider, type EmotionCache } from "@emotion/react";
import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";

import LanguageBootstrap from "@/helpers/LanguageBootstrap";
import LanguageOnboardingBar from "@/Components/UI/LanguageOnboardingBar";
import LanguageSuggestBanner from "@/Components/UI/LanguageSuggestBanner";
import AttributionTracker from "@/Components/AttributionTracker";
import { enforceSessionPersistence } from "@/helpers/authPersistence";
import store from "@/store";
import ErrorBoundary from "@/Components/ErrorBoundary";
import { ThemeProvider as AppThemeProvider, useThemeMode } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
import { SWRConfig } from "swr";
import { localStorageProvider } from "@/utils/swrLocalCache";
import { CompanyDataProvider } from "@/contexts/CompanyDataContext";
import { WalletDataProvider } from "@/contexts/WalletDataContext";
import IdleTimeoutManager from "@/Components/UI/IdleTimeoutManager";
import RouteTransitionLoader from "@/Components/Common/RouteTransitionLoader";
import { createEmotionCache } from "@/utils/createEmotionCache";

import { homeTheme, homeThemeDark } from "@/styles/homeTheme";
import { theme, themeDark } from "@/styles/theme";
import { lightTheme, darkTheme } from "@/styles/theme";
import { authThemeLight, authThemeDark } from "@/styles/authTheme";
import { appThemeLight, appThemeDark } from "@/styles/appTheme";

// Client-side emotion cache shared across the whole app (created once).
const clientSideEmotionCache = createEmotionCache();

// Run before paint on the client, fall back to useEffect on the server so SSR
// doesn't warn. Used so the auth-shell decision (marketing "home" shell vs the
// authenticated "client" shell — e.g. on a hard reload of /help-support) is
// corrected BEFORE the browser paints: no visible marketing→app flash.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Enforce "session-only" (Remember-me unchecked) login expiry as early as possible on
// the client — this runs once when the _app module first loads, BEFORE any component
// (incl. the withAuth HOC) reads the token, so an expired session-only login can't
// briefly render an authenticated page or fire API calls with a stale token.
if (typeof window !== "undefined") {
  enforceSessionPersistence();
}

// ─── Dynamic imports: each layout only loads when its route is hit ───
const HomeLayout = dynamic(() => import("@/Containers/Home"), {
  loading: () => null,
});
const ClientLayout = dynamic(() => import("@/Containers/Client"), {
  loading: () => null,
});
const AdminLayout = dynamic(() => import("@/Containers/Admin"), {
  loading: () => null,
});
const LoginLayout = dynamic(() => import("@/Containers/Login"), {
  loading: () => null,
});
const PaymentLayout = dynamic(() => import("@/Containers/Payment"), {
  loading: () => null,
});

// AI support chat widget — client-only (uses localStorage session), shown on
// the public landing pages + inside the merchant app (not on checkout/admin).
const SupportChatWidget = dynamic(
  () => import("@/Components/Common/SupportChatWidget"),
  { ssr: false, loading: () => null }
);

// -----------------------------
// Types
// -----------------------------

export type LayoutSetterProps = {
  setPageName?: (value: string) => void;
  setPageDescription?: (value: string) => void;
  setPageAction?: (value: ReactNode | null) => void;
  setPageWarning?: (value: ReactNode | null) => void;
  setPageHeaderSx?: (value: SxProps<Theme> | null) => void;
};

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  layout?: "home" | "client" | "login" | "payment" | "pay" | "admin" | "none";
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
  emotionCache?: EmotionCache;
  initialThemeMode?: "light" | "dark";
};

// -----------------------------
// Inner App (has access to theme context)
// -----------------------------

function AppInner({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  const pathname = router.pathname;
  const { isDark } = useThemeMode();

  // NProgress for route transitions
  useEffect(() => {
    NProgress.configure({ showSpinner: false, speed: 300, minimum: 0.2 });
    const handleStart = () => NProgress.start();
    const handleDone = () => NProgress.done();
    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleDone);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleDone);
    };
  }, [router]);

  // Stale-chunk recovery (DO-log #7): after a new deploy a still-open tab holds
  // the OLD build's HTML and requests old /_next/static chunk hashes that no
  // longer exist (404 -> ChunkLoadError). Force a ONE-TIME hard reload so the
  // tab picks up the current build. A sessionStorage guard prevents reload loops.
  useEffect(() => {
    const RELOAD_KEY = "dp_chunk_reload_at";
    const isChunkError = (msg?: string) =>
      !!msg && /ChunkLoadError|Loading chunk [0-9]+ failed|Loading CSS chunk/i.test(msg);
    const reloadOnce = () => {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last < 10000) return; // already reloaded recently — avoid a loop
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch { /* sessionStorage unavailable — still attempt a single reload */ }
      window.location.reload();
    };
    const onRouteError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err || "");
      if (isChunkError(msg)) reloadOnce();
    };
    const onWindowError = (e: ErrorEvent) => { if (isChunkError(e?.message)) reloadOnce(); };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason;
      const msg = r instanceof Error ? r.message : String(r || "");
      if (isChunkError(msg)) reloadOnce();
    };
    router.events.on("routeChangeError", onRouteError);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      router.events.off("routeChangeError", onRouteError);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [router]);


  const [pageName, setPageName] = useState<string>("");
  const [pageDescription, setPageDescription] = useState<string>("");
  const [pageAction, setPageAction] = useState<ReactNode | null>(null);
  const [pageWarning, setPageWarning] = useState<ReactNode | null>(null);
  const [pageHeaderSx, setPageHeaderSx] = useState<SxProps<Theme> | null>(null);

  // Session 54 fix (Bug C): detect login state on the client so dual-purpose
  // pages (help-support) can render inside the authenticated app shell for
  // logged-in merchants instead of the public marketing shell (which made them
  // look logged out). Auth token lives in localStorage under "token".
  const [isAuthed, setIsAuthed] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const check = () => {
      try {
        enforceSessionPersistence();
        setIsAuthed(!!localStorage.getItem("token"));
      } catch {
        setIsAuthed(false);
      }
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [pathname]);

  // -----------------------------
  // Layout Resolver
  // -----------------------------

  const resolvedLayout = useMemo(() => {
    if (Component.layout) return Component.layout;

    const homePaths = new Set([
      "/",
      "/terms-conditions",
      "/privacy-policy",
      "/aml-policy",
      "/system-status",
      "/documentation",
      "/fees",
      "/blog",
      "/about",
      "/press",
      "/referral-program",
      "/how-to",
    ]);

    if (
      homePaths.has(pathname) ||
      pathname.startsWith("/blog/") ||
      pathname.startsWith("/accept-crypto-payments-in/") ||
      pathname.startsWith("/for/") ||
      pathname.startsWith("/compare/")
    ) {
      return "home";
    }

    // Session 54 fix (Bug C): /help-support is dual-purpose — public marketing
    // when logged out, but logged-in merchants should see it inside the
    // authenticated app shell (sidebar/topbar) instead of the marketing shell,
    // which made them appear logged out. The "client" layout also width-
    // constrains the content, fixing the desktop overflow.
    if (pathname.startsWith("/help-support")) {
      return isAuthed ? "client" : "home";
    }

    if (
      pathname.startsWith("/auth") ||
      pathname === "/reset-password" ||
      pathname === "/admin/login"
    ) {
      return "login";
    }

    if (pathname.startsWith("/payment")) {
      return "payment";
    }

    if (pathname.startsWith("/pay/") || pathname === "/pay") {
      return "pay";
    }

    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      return "admin";
    }

    return "client";
  }, [Component.layout, pathname, isAuthed]);

  // -----------------------------
  // Page Titles & Meta
  // -----------------------------

  const { t: tTitle, i18n } = useTranslation("pageTitles");

  // ─── Dynamic <html lang> ───
  useEffect(() => {
    if (typeof document !== "undefined" && i18n.language) {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language]);

  const SITE_URL = "https://dynopay.com";
  const DEFAULT_OG_IMAGE = `${SITE_URL}/og/dynopay-og.png?v=2`;
  // Per-page branded share cards (public/og/, built by scripts/generate-og-images.py)
  const ROUTE_OG_IMAGE: Record<string, string> = {
    "/fees": `${SITE_URL}/og/fees.png`,
    "/about": `${SITE_URL}/og/about.png`,
    "/how-to": `${SITE_URL}/og/how-to.png`,
    "/blog": `${SITE_URL}/og/blog.png`,
  };
  const OG_IMAGE = ROUTE_OG_IMAGE[pathname] || DEFAULT_OG_IMAGE;
  const LOGO_IMAGE = `${SITE_URL}/favicon-512.png`;
  const OG_LOCALES: Record<string, string> = { en: "en_US", pt: "pt_BR", fr: "fr_FR", es: "es_ES", de: "de_DE", nl: "nl_NL" };

  // ─── Private routes that should NOT be indexed ───
  const isPrivatePage = useMemo(() => {
    const privatePrefixes = [
      "/dashboard", "/transactions", "/pay-links", "/create-pay-link",
      "/wallet", "/customers", "/developer-keys", "/invoices",
      "/company", "/profile", "/notifications", "/referrals",
      "/settings", "/admin", "/auth",
      "/reset-password", "/payment/verify", "/storefront",
      "/payouts",
    ];
    return privatePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }, [pathname]);

  const LOCALE_LANGS = ["en", "pt", "fr", "es", "de", "nl"];
  const localeBaseUrl = useMemo(() => {
    // Strip dynamic segments for a clean base URL
    const cleanPath = pathname.replace(/\[.*?\]/g, "").replace(/\/+$/, "");
    return `${SITE_URL}${cleanPath || "/"}`;
  }, [pathname]);
  // Pages whose content is fully i18n-driven get real per-locale SSR variants
  // (self-canonical ?lang= + hreflang). Data-driven English pages (blog, /for/*)
  // stay English-only.
  const isLocalizablePage =
    pathname === "/" || pathname === "/fees" || pathname === "/help-support";
  const canonicalUrl = useMemo(
    () =>
      isLocalizablePage && i18n.language !== "en"
        ? `${localeBaseUrl}?lang=${i18n.language}`
        : localeBaseUrl,
    [isLocalizablePage, i18n.language, localeBaseUrl],
  );

  const { pageTitle, pageDescription: metaDescription } = useMemo(() => {
    // Map route paths to translation keys
    const routeKeyMap: Record<string, string> = {
      // ─── Public / Landing ───
      "/":                         "home",
      "/about":                    "about",
      "/press":                    "press",
      "/fees":                     "fees",
      "/referral-program":         "referralProgram",
      "/documentation":            "documentation",
      "/blog":                     "blog",
      "/system-status":            "systemStatus",
      "/terms-conditions":         "termsConditions",
      "/privacy-policy":           "privacyPolicy",
      "/aml-policy":               "amlPolicy",

      // ─── Auth ───
      "/auth/login":               "authLogin",
      "/auth/register":            "authRegister",
      "/auth/validateSocialLogin": "authValidateSocialLogin",
      "/auth/secure-account":      "authSecureAccount",
      "/auth/github/callback":     "authGithubCallback",
      "/reset-password":           "resetPassword",

      // ─── Dashboard / App ───
      "/dashboard":                "dashboard",
      "/transactions":             "transactions",
      "/pay-links":                "payLinks",
      "/pay-links/[slug]":         "editPayLink",
      "/create-pay-link":          "createPayLink",
      "/wallet":                   "wallet",
      "/customers":                "customers",
      "/developer-keys":           "developerKeys",
      "/invoices":                 "invoices",
      "/company":                  "company",
      "/profile":                  "profile",
      "/notifications":            "notifications",
      "/referrals":                "referrals",
      "/settings":                 "settings",
      "/help-support":             "helpSupport",
      "/help-support/[slug]":      "helpArticle",

      // ─── Checkout / Pay ───
      "/pay":                      "pay",
      "/pay/demo":                 "payDemo",
      "/pay/aml-policy":           "payAmlPolicy",
      "/pay/terms-of-service":     "payTermsOfService",
      "/pay/payment-states-demo":  "paymentStatesDemo",
      "/pay/success-demo":         "paySuccessDemo",
      "/payment":                  "payment",
      "/payment/success":          "paymentSuccess",
      "/payment/failed":           "paymentFailed",
      "/payment/verify":           "paymentVerify",

      // ─── Admin ───
      "/admin":                    "admin",
      "/admin/login":              "adminLogin",
      "/admin/fee":                "adminFee",
      "/admin/wallet":             "adminWallet",
      "/admin/withdraw":           "adminWithdraw",
      "/admin/transferSpeed":      "adminTransferSpeed",
      "/admin/profile":            "adminProfile",
    };

    const key = routeKeyMap[pathname];
    return {
      pageTitle: key ? tTitle(`${key}_title`) : tTitle("default_title"),
      pageDescription: key ? tTitle(`${key}_desc`) : tTitle("default_desc"),
    };
  }, [pathname, tTitle, i18n.language]);

  // ─── JSON-LD Structured Data ───
  const jsonLd = useMemo(() => {
    const org = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Dynopay",
      "url": SITE_URL,
      "logo": LOGO_IMAGE,
      "description": "Dynopay is a cryptocurrency payment gateway that enables businesses to accept Bitcoin, Ethereum, and stablecoins. Payments are forwarded directly to the merchant's own wallet — as the original crypto, or auto-converted to USDT or USDC if enabled.",
      "foundingDate": "2024",
      "sameAs": [
        "https://x.com/Dynopaycom",
        "https://www.instagram.com/dynopay",
        "https://www.linkedin.com/company/dynopay/",
        "https://www.facebook.com/dynopay",
        "https://t.me/Dynopay_Announcements"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "availableLanguage": ["English", "Portuguese", "French", "Spanish", "German", "Dutch"]
      }
    };
    const webSite = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Dynopay",
      "url": SITE_URL,
      "description": "Cryptocurrency payment gateway — accept Bitcoin, Ethereum, and 20+ cryptocurrencies with automatic stablecoin settlement.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${SITE_URL}/documentation?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
    const product = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Dynopay Crypto Payment Gateway",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "url": SITE_URL,
      "description": "Accept cryptocurrency payments on your website or app. Bitcoin, Ethereum, Litecoin, USDT, USDC and more — receive the original crypto, or opt in to auto-convert settlements to a stablecoin. Low processing fees.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start — pay only per transaction"
      },
      "featureList": [
        "Accept Bitcoin (BTC) payments",
        "Accept Ethereum (ETH) payments",
        "Accept USDT and USDC stablecoin payments",
        "Automatic conversion to stablecoins",
        "Low transaction fees",
        "Developer-friendly REST API",
        "Shareable payment links — no code required",
        "Real-time webhook notifications",
        "Multi-currency merchant dashboard",
        "Built-in tax compliance and invoicing"
      ],
      "creator": {
        "@type": "Organization",
        "name": "Dynopay"
      }
    };
    return JSON.stringify([org, webSite, product]);
  }, []);

  const pageSetterProps: LayoutSetterProps = {
    setPageName,
    setPageDescription,
    setPageAction,
    setPageWarning,
    setPageHeaderSx,
  };

  // Pick the right MUI theme based on layout + dark mode
  const activeTheme = useMemo(() => {
    switch (resolvedLayout) {
      case "home":
        return isDark ? homeThemeDark : homeTheme;
      case "login":
        return isDark ? authThemeDark : authThemeLight;
      case "pay":
        return isDark ? homeThemeDark : homeTheme;
      default:
        return isDark ? appThemeDark : appThemeLight;
    }
  }, [resolvedLayout, isDark]);

  const renderWithLayout = () => {
    switch (resolvedLayout) {
      case "home":
        return (
          <HomeLayout>
            <Component {...pageProps} />
          </HomeLayout>
        );

      case "login":
        return (
          <LoginLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </LoginLayout>
        );

      case "payment":
        return (
          <PaymentLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </PaymentLayout>
        );

      case "pay":
        return (
          <PaymentLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </PaymentLayout>
        );

      case "admin":
        return (
          <AdminLayout pageName={pageName} pageDescription={pageDescription}>
            <Component {...pageProps} {...pageSetterProps} />
          </AdminLayout>
        );

      case "none":
        return <Component {...pageProps} {...pageSetterProps} />;

      default:
        return (
          <ClientLayout
            pageName={pageName}
            pageDescription={pageDescription}
            pageAction={pageAction}
            pageWarning={pageWarning}
            pageHeaderSx={pageHeaderSx || undefined}
          >
            <Component {...pageProps} {...pageSetterProps} />
          </ClientLayout>
        );
    }
  };

  return (
    <MuiThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Head>
        {/* ─── Font CSS variables — Blueprint §1.3: consolidated to Manrope (display),
             IBM Plex Sans (body/UI), IBM Plex Mono (money/figures). Legacy vars are
             repointed at the new families so ~1000 existing references update for free. ─── */}
        {/* MUST be dangerouslySetInnerHTML: a string child of <style> gets HTML-escaped
             by React SSR (" -> &quot;, ' -> &#x27;) and browsers do NOT decode entities
             inside <style>, so every var(--font-*) was invalid until hydration rewrote
             the text -> whole page painted in the browser default serif first, then
             "grew" into Manrope/Plex ("page appears small then normal" bug). */}
        <style
          data-testid="font-vars-style"
          dangerouslySetInnerHTML={{
            __html: `
          :root {
            --font-sans: ${PlexSans.style.fontFamily}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --font-mono: ${PlexMono.style.fontFamily}, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            --font-display: "Manrope", "Manrope Fallback", ${PlexSans.style.fontFamily}, -apple-system, sans-serif;
            --font-hero: "Manrope", "Manrope Fallback", ${UnboundedFont.style.fontFamily}, ${GeistSans.style.fontFamily}, -apple-system, sans-serif;
            --font-body: ${PlexSans.style.fontFamily}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --font-tech: ${PlexMono.style.fontFamily}, ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
            --font-inter: ${PlexSans.style.fontFamily}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --font-roboto-mono: ${PlexMono.style.fontFamily}, ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
          }
        `,
          }}
        />
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />

        {/* ─── Viewport ─── */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />

        {/* ─── Canonical URL ─── */}
        {/* `key="canonical"` lets per-page Head overrides (e.g. SEOLandingPage
             with its slug-specific canonical) DEDUPE this fallback. */}
        <link key="canonical" rel="canonical" href={canonicalUrl} />

        {/* ─── Robots: noindex for private pages ─── */}
        {isPrivatePage && <meta name="robots" content="noindex, nofollow" />}

        {/* ─── Open Graph ─── */}
        <meta key="og:type" property="og:type" content={pathname.startsWith("/blog/") ? "article" : "website"} />
        <meta key="og:title" property="og:title" content={pageTitle} />
        <meta key="og:description" property="og:description" content={metaDescription} />
        <meta key="og:url" property="og:url" content={canonicalUrl} />
        <meta key="og:image" property="og:image" content={OG_IMAGE} />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta key="og:site_name" property="og:site_name" content="Dynopay" />
        <meta key="og:locale" property="og:locale" content={OG_LOCALES[i18n.language] || "en_US"} />

        {/* ─── Twitter Cards ─── */}
        <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
        <meta key="twitter:title" name="twitter:title" content={pageTitle} />
        <meta key="twitter:description" name="twitter:description" content={metaDescription} />
        <meta key="twitter:image" name="twitter:image" content={OG_IMAGE} />
        <meta name="twitter:site" content="@Dynopaycom" />

        {/* ─── hreflang alternates — REAL per-locale ?lang= SSR variants ───
             Emitted only on fully-localised pages (home, /fees, /help-support).
             English is x-default and self-canonical at the bare URL. */}
        {isLocalizablePage &&
          LOCALE_LANGS.map((l) => (
            <link
              key={`alt-${l}`}
              rel="alternate"
              hrefLang={l}
              href={l === "en" ? localeBaseUrl : `${localeBaseUrl}?lang=${l}`}
            />
          ))}
        {isLocalizablePage && (
          <link key="x-default" rel="alternate" hrefLang="x-default" href={localeBaseUrl} />
        )}

        {/* ─── JSON-LD Structured Data ─── */}
        {pathname === "/" && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        )}
      </Head>
      <IdleTimeoutManager />
      <RouteTransitionLoader />
      {renderWithLayout()}
      {(resolvedLayout === "home" || resolvedLayout === "client") && (
        <SupportChatWidget layout={resolvedLayout} />
      )}
    </MuiThemeProvider>
  );
}

// -----------------------------
// App Component
// -----------------------------

function App({
  emotionCache = clientSideEmotionCache,
  initialThemeMode,
  ...props
}: AppPropsWithLayout) {
  const { i18nLang, i18nResources } = props as unknown as {
    i18nLang?: string;
    i18nResources?: Record<string, object>;
  };
  // Per-request i18n instance on the SERVER (isolates locale so concurrent
  // requests never leak languages into each other). The CLIENT keeps using the
  // shared global instance so the language switcher and localStorage persistence
  // keep working; the module-level bootstrap already set it to the ?lang= locale.
  const activeI18n = useMemo(() => {
    const lng = i18nLang || "en";
    if (typeof window !== "undefined" || lng === "en") return i18n;
    const inst = i18n.cloneInstance({ lng, initImmediate: false });
    if (i18nResources) {
      for (const ns of Object.keys(i18nResources)) {
        inst.addResourceBundle(lng, ns, i18nResources[ns], true, true);
      }
    }
    inst.changeLanguage(lng);
    return inst;
  }, [i18nLang, i18nResources]);
  return (
    <I18nextProvider i18n={activeI18n}>
    <CacheProvider value={emotionCache}>
      <ErrorBoundary>
        <Provider store={store}>
          <LanguageBootstrap />
          <SessionProvider
            // Provide a DEFINED initial session (null when none). In NextAuth v4
            // this skips the mount-time fetch to /api/auth/session — which, in
            // this proxy environment, gets aborted during navigation and surfaced
            // as a noisy CLIENT_FETCH_ERROR / occasional ERR_ABORTED. OAuth still
            // works: the session is refreshed via the sign-in flow when used.
            session={props.pageProps.session ?? null}
            refetchInterval={0}
            refetchOnWindowFocus={false}
            refetchWhenOffline={false}
          >
            <AppThemeProvider initialMode={initialThemeMode}>
              {/* CartProvider — Product Catalog Phase 1 (spec §6.3). Wraps the
                  whole app so useCart() hits the real context (not the
                  standalone-localStorage fallback), enabling cross-tab sync
                  and single source of truth for the buyer cart badge. */}
              <CartProvider>
                {/* SWR — money-safe global defaults: never auto-poll, don't
                    refetch on window focus (avoids surprise balance flicker),
                    dedupe bursts of identical reads. Wallet + Company data now
                    flow through SWR (CompanyDataProvider → WalletDataProvider)
                    instead of redux-saga. */}
                <SWRConfig
                  value={{
                    // F2: persist SWR cache to localStorage (per-user, TTL'd)
                    // so repeat dashboard/company/wallet visits hydrate
                    // instantly with last-known values, then revalidate in the
                    // background — no more skeletons on every visit.
                    provider: localStorageProvider,
                    revalidateOnFocus: false,
                    revalidateOnReconnect: true,
                    shouldRetryOnError: true,
                    errorRetryCount: 2,
                    dedupingInterval: 8000,
                  }}
                >
                  <CompanyDataProvider>
                    <WalletDataProvider>
                      <AppInner {...(props as AppPropsWithLayout)} />
                      <AttributionTracker />
                      <LanguageOnboardingBar />
                      <LanguageSuggestBanner />
                    </WalletDataProvider>
                  </CompanyDataProvider>
                </SWRConfig>
              </CartProvider>
            </AppThemeProvider>
          </SessionProvider>
        </Provider>
      </ErrorBoundary>
    </CacheProvider>
    </I18nextProvider>
  );
}

// Read the theme preference server-side. Now route-context-aware (2025-07):
//   - In-app surfaces (dashboard, transactions, wallets, settings, admin…)
//     default to DARK when the user has never toggled there.
//   - Public surfaces (landing, marketing, buyer checkout, auth, docs, legal)
//     default to LIGHT.
// Two independent cookies (`theme-mode-inapp`, `theme-mode-public`) hold the
// user's explicit choice per context so a manual toggle on the dashboard
// doesn't blow away the clean light landing page (or vice versa).
//
// Order of precedence for the initial mode:
//   1. Context-scoped cookie (`theme-mode-{inapp|public}`)
//   2. Legacy `theme-mode` cookie (single-preference migration, only if the
//      context cookie is missing) — one-time carry-over.
//   3. Route-context default: dark for in-app, light for public.
App.getInitialProps = async (appContext: AppContext) => {
  const appProps = await NextApp.getInitialProps(appContext);
  const req = appContext.ctx.req;
  const reqHeaders = req?.headers || {};

  // Client hint kept for potential future analytics; NOT used for the mode
  // decision (see Session 44 comment in ThemeContext).
  const clientHintRaw = reqHeaders["sec-ch-prefers-color-scheme"];
  const clientHint = Array.isArray(clientHintRaw) ? clientHintRaw[0] : clientHintRaw;
  void (clientHint === "light" || clientHint === "dark" ? clientHint : null);

  // Determine route context from the incoming URL.
  const rawUrl = (appContext.ctx.pathname || (req as any)?.url || "/") as string;
  const pathname = rawUrl.split(/[?#]/)[0] || "/";
  const {
    getRouteContext,
    getDefaultThemeForContext,
    getDefaultThemeForPath,
    getCookieNameForContext,
    isAuthPath,
    isHelpSupportPath,
  } = await import("@/utils/theme/routeContext");
  const routeCtx = getRouteContext(pathname);
  // Help & Support follows the in-app theme preference, so read its cookie.
  const cookieName = isHelpSupportPath(pathname)
    ? "theme-mode-inapp"
    : getCookieNameForContext(routeCtx);

  const cookieHeader =
    reqHeaders.cookie ||
    (typeof document !== "undefined" ? document.cookie : "");

  const escaped = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contextMatch = new RegExp(
    `(?:^|;\\s*)${escaped}=(light|dark)`,
  ).exec(cookieHeader || "");
  const contextCookieValue = contextMatch
    ? (contextMatch[1] as "light" | "dark")
    : null;

  // Legacy single-key migration (one-time; ThemeContext + _document
  // blocking script also handle their own migration paths).
  const legacyMatch = /(?:^|;\s*)theme-mode=(light|dark)/.exec(cookieHeader || "");
  const legacyValue = legacyMatch ? (legacyMatch[1] as "light" | "dark") : null;

  // Auth-path inheritance: on /auth/* and /reset-password, if the user has
  // NOT set an explicit public cookie AND has an explicit in-app DARK
  // cookie, render dark so the login card feels connected to the
  // merchant's dashboard.
  let inheritedMode: "light" | "dark" | null = null;
  if (isAuthPath(pathname) && !contextCookieValue) {
    const inappMatch = /(?:^|;\s*)theme-mode-inapp=(light|dark)/.exec(
      cookieHeader || "",
    );
    if (inappMatch && inappMatch[1] === "dark") inheritedMode = "dark";
  }

  const initialThemeMode: "light" | "dark" =
    contextCookieValue ||
    inheritedMode ||
    legacyValue ||
    (isHelpSupportPath(pathname)
      ? getDefaultThemeForPath(pathname)
      : getDefaultThemeForContext(routeCtx));
  // ── 3B: server-side locale for ?lang= (renders translated HTML per request) ──
  const I18N_LANGS = ["en", "pt", "fr", "es", "de", "nl"];
  const qLang = appContext.ctx.query?.lang;
  const langParam = Array.isArray(qLang) ? qLang[0] : qLang;
  const i18nLang =
    typeof langParam === "string" && I18N_LANGS.includes(langParam) ? langParam : "en";
  let i18nResources: Record<string, object> | undefined;
  if (typeof window === "undefined" && i18nLang !== "en") {
    try {
      const req2 = eval("require");
      const fsMod = req2("fs");
      const pathMod = req2("path");
      const dir = pathMod.join(process.cwd(), "langs", "locales", i18nLang);
      const NS = [
        "common", "auth", "dashboardLayout", "profile", "notifications", "apiScreen",
        "walletScreen", "companyDialog", "companySettings", "transactions",
        "createPaymentLinkScreen", "paymentLinks", "helpAndSupport", "landing", "fees",
        "apiStatus", "termsConditions", "privacyPolicy", "amlPolicy", "referrals", "pageTitles",
      ];
      // Perf: public marketing/auth pages never render the authenticated-app
      // screens, so DON'T serialize those namespaces into __NEXT_DATA__ for them
      // (they were the bulk of the 255–283 kB SSR payload on ?lang= pages). The
      // client still lazy-loads the full set post-hydration via loadLanguageAsync,
      // and i18next falls back to English for any not-yet-loaded key.
      const APP_ONLY_NS = new Set([
        "dashboardLayout", "profile", "notifications", "walletScreen",
        "companyDialog", "companySettings", "transactions",
        "createPaymentLinkScreen", "paymentLinks",
      ]);
      const publicPrefixes = ["/fees", "/help-support", "/blog", "/for", "/about",
        "/press", "/documentation", "/how-to", "/referral-program", "/system-status",
        "/accept-crypto-payments-in", "/auth", "/pay", "/terms-conditions",
        "/privacy-policy", "/aml-policy", "/reset-password", "/creator", "/order"];
      const isPublicPage = pathname === "/" ||
        publicPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
      const activeNS = isPublicPage ? NS.filter((ns) => !APP_ONLY_NS.has(ns)) : NS;
      const bundle: Record<string, object> = {};
      for (const ns of activeNS) {
        try {
          bundle[ns] = JSON.parse(fsMod.readFileSync(pathMod.join(dir, ns + ".json"), "utf8"));
        } catch {
          /* namespace missing for this locale — skip */
        }
      }
      for (const ns of Object.keys(bundle)) i18n.addResourceBundle(i18nLang, ns, bundle[ns], true, true);
      i18nResources = bundle;
    } catch {
      /* fs unavailable — fall back to English SSR */
    }
  }

  // Edge/CDN caching for public marketing pages (softens the per-request SSR cost).
  const res2 = appContext.ctx.res;
  const pubPrefixes = ["/fees", "/help-support", "/blog", "/for", "/about", "/press",
    "/documentation", "/how-to", "/referral-program", "/system-status", "/accept-crypto-payments-in"];
  if (res2 && !res2.headersSent) {
    const isPublic = pathname === "/" ||
      pubPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (isPublic) {
      res2.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
      res2.setHeader("Vary", "Accept-Language");
    }
  }

  return { ...appProps, initialThemeMode, i18nLang, i18nResources };
};

export default App;
