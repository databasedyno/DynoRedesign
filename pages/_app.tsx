import "@/styles/globals.css";
import "nprogress/nprogress.css";
import "../i18n";

// Geist Sans + Mono — Vercel's OSS typeface, self-hosted from the `geist`
// package but declared with next/font/local directly so we control `display`.
// FIX (2026-07-10): the upstream `geist/font/sans` export hardcodes
// font-display: swap, which caused a visible FOUT on the landing header —
// text painted in the (slightly smaller) metric-adjusted Arial fallback, then
// "grew" when Geist swapped in. `display: "optional"` eliminates that
// mid-paint size jump: if the font isn't ready within the ~100ms block
// period, the fallback is kept for the whole paint (no swap), and the cached
// font renders instantly on every subsequent load.
import localFont from "next/font/local";

const GeistSans = localFont({
  src: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "optional",
});

const GeistMono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "optional",
});

// Swiss landing / dashboard display + body + mono faces.
// FIX (2026-07-21): these were previously loaded via a <link> to Google Fonts
// in _document.tsx with `display=swap`, which caused the reported FOUT — the
// hero (and every `var(--font-hero)` heading, incl. the in-app dashboard)
// first painted in the thin Geist fallback then "jumped" to bold Unbounded
// when the network font arrived. Self-hosting via next/font (preloaded, same
// origin) + `display: "optional"` eliminates the mid-paint swap: the font is
// used only if it's ready within the ~100ms block window (near-guaranteed
// thanks to preload + caching), otherwise the fallback is kept for the whole
// paint — never a swap.
import { Unbounded, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const UnboundedFont = Unbounded({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "800"],
  display: "optional",
});

const PlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "optional",
});

const PlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "optional",
});

import type { NextPage } from "next";
import NextApp, { type AppProps, type AppContext } from "next/app";
import { useRouter } from "next/router";
import Head from "next/head";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import NProgress from "nprogress";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";

import type { SxProps, Theme } from "@mui/material";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { CacheProvider, type EmotionCache } from "@emotion/react";
import { SessionProvider } from "next-auth/react";
import { Provider } from "react-redux";

import LanguageBootstrap from "@/helpers/LanguageBootstrap";
import { enforceSessionPersistence } from "@/helpers/authPersistence";
import store from "@/store";
import ErrorBoundary from "@/Components/ErrorBoundary";
import { ThemeProvider as AppThemeProvider, useThemeMode } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
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
  useEffect(() => {
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
    ]);

    if (
      homePaths.has(pathname) ||
      pathname.startsWith("/blog/") ||
      pathname.startsWith("/accept-crypto-payments-in/") ||
      pathname.startsWith("/for/")
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
  const OG_IMAGE = `${SITE_URL}/og/dynopay-og.png`;
  const LOGO_IMAGE = `${SITE_URL}/favicon-512.png`;
  const SUPPORTED_LANGS = ["en", "pt", "fr", "es", "de", "nl"];

  // ─── Private routes that should NOT be indexed ───
  const isPrivatePage = useMemo(() => {
    const privatePrefixes = [
      "/dashboard", "/transactions", "/pay-links", "/create-pay-link",
      "/wallet", "/customers", "/developer-keys", "/invoices",
      "/company", "/profile", "/notifications", "/referrals",
      "/settings", "/help-support", "/admin", "/auth",
      "/reset-password", "/payment/verify",
    ];
    return privatePrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }, [pathname]);

  const canonicalUrl = useMemo(() => {
    // Strip dynamic segments for a clean canonical
    const cleanPath = pathname.replace(/\[.*?\]/g, "").replace(/\/+$/, "");
    return `${SITE_URL}${cleanPath || "/"}`;
  }, [pathname]);

  const { pageTitle, pageDescription: metaDescription } = useMemo(() => {
    // Map route paths to translation keys
    const routeKeyMap: Record<string, string> = {
      // ─── Public / Landing ───
      "/":                         "home",
      "/fees":                     "fees",
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
      "description": "Dynopay is a cryptocurrency payment gateway that enables businesses to accept Bitcoin, Ethereum, and stablecoins. Payments are forwarded instantly to the merchant's own wallet — as the original crypto, or auto-converted to USDT or USDC if enabled.",
      "foundingDate": "2024",
      "sameAs": [
        "https://x.com/Dynopaycom"
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
      "description": "Cryptocurrency payment gateway — accept Bitcoin, Ethereum, and 20+ cryptocurrencies with instant stablecoin settlement.",
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
        {/* ─── Font CSS variables (Geist Sans + Geist Mono, self-hosted via next/font) ─── */}
        <style>{`
          :root {
            --font-sans: ${GeistSans.style.fontFamily}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --font-mono: ${GeistMono.style.fontFamily}, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            --font-display: ${GeistSans.style.fontFamily}, -apple-system, sans-serif;
            --font-hero: ${UnboundedFont.style.fontFamily}, ${GeistSans.style.fontFamily}, -apple-system, sans-serif;
            --font-body: ${PlexSans.style.fontFamily}, ${GeistSans.style.fontFamily}, -apple-system, sans-serif;
            --font-tech: ${PlexMono.style.fontFamily}, ${GeistMono.style.fontFamily}, ui-monospace, SFMono-Regular, Menlo, monospace;
          }
        `}</style>
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
        <meta key="og:type" property="og:type" content={pathname === "/" ? "website" : "article"} />
        <meta key="og:title" property="og:title" content={pageTitle} />
        <meta key="og:description" property="og:description" content={metaDescription} />
        <meta key="og:url" property="og:url" content={canonicalUrl} />
        <meta key="og:image" property="og:image" content={OG_IMAGE} />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta property="og:site_name" content="Dynopay" />
        <meta property="og:locale" content={i18n.language || "en"} />

        {/* ─── Twitter Cards ─── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta key="twitter:title" name="twitter:title" content={pageTitle} />
        <meta key="twitter:description" name="twitter:description" content={metaDescription} />
        <meta key="twitter:image" name="twitter:image" content={OG_IMAGE} />
        <meta name="twitter:site" content="@Dynopaycom" />

        {/* ─── hreflang tags for i18n ─── */}
        {SUPPORTED_LANGS.map((lang) => (
          <link key={lang} rel="alternate" hrefLang={lang} href={canonicalUrl} />
        ))}
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

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

export default function App({
  emotionCache = clientSideEmotionCache,
  initialThemeMode,
  ...props
}: AppPropsWithLayout) {
  return (
    <CacheProvider value={emotionCache}>
      <ErrorBoundary>
        <Provider store={store}>
          <LanguageBootstrap />
          <SessionProvider session={props.pageProps.session} refetchInterval={0} refetchOnWindowFocus={false}>
            <AppThemeProvider initialMode={initialThemeMode}>
              {/* CartProvider — Product Catalog Phase 1 (spec §6.3). Wraps the
                  whole app so useCart() hits the real context (not the
                  standalone-localStorage fallback), enabling cross-tab sync
                  and single source of truth for the buyer cart badge. */}
              <CartProvider>
                <AppInner {...(props as AppPropsWithLayout)} />
              </CartProvider>
            </AppThemeProvider>
          </SessionProvider>
        </Provider>
      </ErrorBoundary>
    </CacheProvider>
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
    getCookieNameForContext,
    isAuthPath,
  } = await import("@/utils/theme/routeContext");
  const routeCtx = getRouteContext(pathname);
  const cookieName = getCookieNameForContext(routeCtx);

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
    getDefaultThemeForContext(routeCtx);
  return { ...appProps, initialThemeMode };
};
