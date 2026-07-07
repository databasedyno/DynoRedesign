import "@/styles/globals.css";
import "nprogress/nprogress.css";
import "../i18n";

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
import store from "@/store";
import ErrorBoundary from "@/Components/ErrorBoundary";
import { ThemeProvider as AppThemeProvider, useThemeMode } from "@/contexts/ThemeContext";
import IdleTimeoutManager from "@/Components/UI/IdleTimeoutManager";
import { createEmotionCache } from "@/utils/createEmotionCache";

import { homeTheme, homeThemeDark } from "@/styles/homeTheme";
import { theme, themeDark } from "@/styles/theme";
import { lightTheme, darkTheme } from "@/styles/theme";
import { authThemeLight, authThemeDark } from "@/styles/authTheme";
import { appThemeLight, appThemeDark } from "@/styles/appTheme";

// Client-side emotion cache shared across the whole app (created once).
const clientSideEmotionCache = createEmotionCache();

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
  }, [Component.layout, pathname]);

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
  const OG_IMAGE = `${SITE_URL}/dynopay-favicon.png`;
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
      "name": "DynoPay",
      "url": SITE_URL,
      "logo": OG_IMAGE,
      "description": "DynoPay is a cryptocurrency payment gateway that enables businesses to accept Bitcoin, Ethereum, and stablecoins. Merchants keep the crypto they receive, or opt in to auto-convert settlements to USDT or USDC.",
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
      "name": "DynoPay",
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
      "name": "DynoPay Crypto Payment Gateway",
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
        "name": "DynoPay"
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
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />

        {/* ─── Viewport ─── */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />

        {/* ─── Canonical URL ─── */}
        {/* `key="canonical"` lets per-page Head overrides (e.g. SEOLandingPage
             with its slug-specific canonical) DEDUPE this fallback. */}
        <link key="canonical" rel="canonical" href={canonicalUrl} />

        {/* ─── Robots: noindex for private pages ─── */}
        {isPrivatePage && <meta name="robots" content="noindex, nofollow" />}

        {/* ─── Open Graph ─── */}
        <meta property="og:type" content={pathname === "/" ? "website" : "article"} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta key="og:url" property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:site_name" content="DynoPay" />
        <meta property="og:locale" content={i18n.language || "en"} />

        {/* ─── Twitter Cards ─── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={OG_IMAGE} />
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
      {renderWithLayout()}
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
              <AppInner {...(props as AppPropsWithLayout)} />
            </AppThemeProvider>
          </SessionProvider>
        </Provider>
      </ErrorBoundary>
    </CacheProvider>
  );
}

// Read the theme preference server-side. Priority:
//   1. `Sec-CH-Prefers-Color-Scheme` request header (User Preference Media
//      Features client hint — Chromium browsers auto-send this because we
//      opt-in via `Accept-CH` / `Critical-CH` in next.config.mjs). This is
//      the ONLY way for the server to know the user's OS theme preference,
//      so SSR renders the correct MUI theme on first paint.
//   2. `theme-mode` cookie (set by the blocking script in _document.tsx
//      once JS runs, and by the manual toggle) — this covers users who
//      have explicitly picked a theme AND subsequent visits from
//      non-Chromium browsers.
//   3. Fallback: 'light' (the browser default; also what our blocking
//      script defaults to when `matchMedia` doesn't match dark).
// Together with the cookie/localStorage reconciliation done client-side in
// ThemeContext, this eliminates the emotion className hydration mismatch
// AND the "flash of dark" that happened when SSR always defaulted to dark.
App.getInitialProps = async (appContext: AppContext) => {
  const appProps = await NextApp.getInitialProps(appContext);
  const req = appContext.ctx.req;
  const reqHeaders = req?.headers || {};

  // 1. Client hint (Chromium browsers) — sent as "light" or "dark"
  const clientHintRaw = reqHeaders["sec-ch-prefers-color-scheme"];
  const clientHint = Array.isArray(clientHintRaw) ? clientHintRaw[0] : clientHintRaw;
  const normalizedHint =
    clientHint === "light" || clientHint === "dark" ? clientHint : null;

  // 2. Cookie
  const cookieHeader =
    reqHeaders.cookie ||
    (typeof document !== "undefined" ? document.cookie : "");
  const match = /(?:^|;\s*)theme-mode=(light|dark)/.exec(cookieHeader || "");
  const cookieValue = match ? (match[1] as "light" | "dark") : null;

  // 3. Resolve: cookie (explicit choice) > client hint (OS) > default light.
  //    The cookie is refreshed on every load by the blocking script in
  //    _document.tsx to reflect the user's resolved preference
  //    (manual choice via localStorage, else OS preference). It therefore
  //    captures an EXPLICIT theme selection, which must win over the raw OS
  //    `Sec-CH-Prefers-Color-Scheme` hint. Otherwise a user on a dark OS who
  //    picked Light gets a dark SSR first paint that flips to light after
  //    hydration (the reported "dark flash then white" bug). The client hint
  //    is only used as a fallback for a brand-new Chromium visitor who has no
  //    cookie yet.
  const initialThemeMode: "light" | "dark" =
    cookieValue || normalizedHint || "light";
  return { ...appProps, initialThemeMode };
};
