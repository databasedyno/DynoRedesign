import Document, {
  Html,
  Head,
  Main,
  NextScript,
  type DocumentContext,
  type DocumentInitialProps,
} from "next/document";
import createEmotionServer from "@emotion/server/create-instance";
import { createEmotionCache } from "@/utils/createEmotionCache";

type MyDocumentProps = DocumentInitialProps & {
  emotionStyleTags: JSX.Element[];
  lang: string;
};

export default function MyDocument({ emotionStyleTags, lang }: MyDocumentProps) {
  return (
    <Html lang={lang}>
      <Head>
        {/* Favicon — deliberately minimal & unambiguous (consolidated 2026-09-07).
            Modern browsers use the SVG, which self-switches dark/light via an embedded
            @media(prefers-color-scheme), so the mark never disappears on dark chrome.
            Every other entry is color-scheme-independent, giving Google's favicon
            crawler (which ignores prefers-color-scheme) ONE clear signal set:
            /favicon.ico + unconditional 48/192 PNGs + the web manifest. The indigo
            coin reads fine on both light and dark backgrounds, so no separate dark-mode
            PNG variants are needed. v5 bump forces browsers/crawlers to drop the cached
            v4 icon. */}
        <link rel="icon" href="/favicon.ico?v=5" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=5" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png?v=5" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png?v=5" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=5" />
        <link rel="manifest" href="/site.webmanifest?v=5" />
        {/* iOS safe area and mobile optimization — viewport is set via next.config or _app */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#0A0A0A" />
        <link rel="alternate" type="application/rss+xml" title="Dynopay Blog" href="https://dynopay.com/blog/rss.xml" />

        {/* Preload core Manrope weights (incl. ExtraBold for the boldest hero
            headings) — paired with font-display:swap + the metric-matched
            "Manrope Fallback" in globals.css so headings/labels never stick on
            a mismatched fallback and never visibly resize on a cold load. */}
        <link rel="preload" href="/fonts/Manrope-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Manrope-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Manrope-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Manrope-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Manrope-ExtraBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

        {/* Fonts now served via next/font (Geist Sans + Geist Mono). See _app.tsx.
            Legacy Manrope woffs kept in /public/fonts as fallback for any
            component that still references Manrope by name during hydration. */}

        {/* Swiss landing display/body/mono fonts (Unbounded + IBM Plex) are
            self-hosted + preloaded via next/font/local in _app.tsx with
            display:"swap" (2026-08-14 — was "optional", which left COLD loads
            stuck on the Helvetica fallback for the whole visit: hero wrapped
            in 2 lines instead of 3. "swap" guarantees the brand font always
            applies once loaded; preload keeps the swap window tiny). */}

        {/* Google Identity Services script moved to the auth pages (login/register)
             that actually use it — keeps this third-party connection off every
             marketing/landing page. See pages/auth/login.tsx & register.tsx. */}

        {/* MUI/emotion critical CSS extracted during SSR (prevents FOUC) */}
        <meta name="emotion-insertion-point" content="" />
        {emotionStyleTags}
      </Head>
      <body>
        {/* ── Blocking language script: sets <html lang> BEFORE React hydrates ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var SUPPORTED = ['en','pt','fr','es','de','nl'];
    var lang = null;
    try { var m = location.search.match(/[?&]lang=([a-z]{2})/); if (m) lang = m[1]; } catch(e){}
    if (!lang) { try { lang = localStorage.getItem('lang'); } catch(e){} }
    if (!lang || SUPPORTED.indexOf(lang) === -1) { lang = 'en'; }
    document.documentElement.lang = lang;
  } catch(e) {
    document.documentElement.lang = 'en';
  }
})();
`,
          }}
        />
        {/* ── Blocking theme script: runs BEFORE React hydrates to prevent flash.
             Now route-context-aware (2025-07 pass): in-app surfaces default
             to DARK (dashboard, transactions, wallets, settings, etc.),
             public surfaces (landing, marketing, buyer checkout, auth,
             docs) default to LIGHT. User toggles are scoped per context.
             Auth paths additionally inherit the merchant's in-app dark
             preference so a link from a dark email doesn't jarringly
             flash light. ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  // Compute the route context (in-app vs public) WITHOUT touching storage,
  // so a blocked/throwing localStorage (e.g. iOS Safari private mode, or a
  // browser with site-data disabled) can never downgrade an in-app surface
  // to light. Keep INAPP/AUTH IN SYNC with utils/theme/routeContext.ts.
  function stripPath(){
    try { return ((location && location.pathname) || '/').replace(/\\/+$/, '') || '/'; }
    catch (e) { return '/'; }
  }
  function matchPrefix(p, list){
    for (var i = 0; i < list.length; i++) {
      if (p === list[i] || p.indexOf(list[i] + '/') === 0) return true;
    }
    return false;
  }
  var INAPP = ['/dashboard','/transactions','/wallet','/wallets','/customers','/invoices','/notifications','/settings','/profile','/create-pay-link','/pay-links','/referrals','/developer-keys','/company','/fees','/admin','/creator','/storefront','/payouts','/get-started','/kyc'];
  var AUTH  = ['/auth','/reset-password'];
  var HELP  = ['/help-support'];
  function readCk(name){ try { var m = document.cookie.match(new RegExp('(?:^|;\\\\s*)' + name + '=([^;]+)')); return m ? m[1] : null; } catch(e){ return null; } }
  var path = stripPath();
  var context = matchPrefix(path, INAPP) ? 'inapp' : 'public';
  var isAuth = matchPrefix(path, AUTH);
  var isHelp = matchPrefix(path, HELP);
  // Help & Support is dual-purpose: FOLLOW the in-app theme preference (so a
  // dark merchant keeps dark) but DEFAULT to light for logged-out visitors.
  var storageKey = (context === 'inapp' || isHelp) ? 'theme-mode-inapp' : 'theme-mode-public';
  // 2026-08 usability plan (decision 1a): LIGHT is the default everywhere;
  // saved dark preferences (localStorage/cookie) still win below.
  var defaultMode = 'light';

  // Start from the ROUTE default. Only a stored preference (or auth-path
  // inheritance) may override it — and reading storage is isolated so its
  // failure leaves the correct route default intact.
  var mode = defaultMode;
  try {
    if (isHelp) {
      // Follow the in-app preference: localStorage first, then the cookie
      // (covers default-dark merchants who never manually toggled). Otherwise
      // keep the light marketing default for logged-out visitors.
      var hSaved = localStorage.getItem('theme-mode-inapp');
      if (hSaved !== 'light' && hSaved !== 'dark') hSaved = readCk('theme-mode-inapp');
      if (hSaved === 'light' || hSaved === 'dark') mode = hSaved;
    } else {
      var saved = localStorage.getItem(storageKey);
      // One-time migration from the legacy single 'theme-mode' key.
      if (saved !== 'light' && saved !== 'dark') {
        var legacy = localStorage.getItem('theme-mode');
        if (legacy === 'light' || legacy === 'dark') {
          saved = legacy;
          try { localStorage.setItem(storageKey, legacy); } catch (e) {}
        }
      }
      if (saved === 'light' || saved === 'dark') {
        mode = saved;
      } else if (isAuth) {
        // Auth-path inheritance: mirror an explicit in-app DARK preference so a
        // link from a dark email doesn't jarringly flash the login card white.
        var inappSaved = localStorage.getItem('theme-mode-inapp');
        if (inappSaved === 'dark') mode = 'dark';
      }
    }
  } catch (e) {
    // Storage unavailable/blocked — keep the route-aware default (dark for
    // in-app). Do NOT force light here (that was the mobile-Safari bug).
  }

  try {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.backgroundColor = mode === 'light' ? '#F2F3F8' : '#0B0D17';
  } catch (e) {}
  try {
    // Never auto-persist the theme cookie on /help-support (see ThemeContext):
    // it would pollute either the public cookie (dark bleeds onto marketing)
    // or the in-app cookie (a visitor's light default bleeds into the app).
    if (!isHelp) {
      document.cookie = storageKey + '=' + mode + '; path=/; max-age=31536000; samesite=lax';
    }
  } catch (e) {}
})();
`,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

MyDocument.getInitialProps = async (ctx: DocumentContext): Promise<MyDocumentProps> => {
  const originalRenderPage = ctx.renderPage;
  const cache = createEmotionCache();
  const { extractCriticalToChunks } = createEmotionServer(cache);

  ctx.renderPage = () =>
    originalRenderPage({
      enhanceApp: (App: any) =>
        function EnhanceApp(props) {
          return <App emotionCache={cache} {...props} />;
        },
    });

  const initialProps = await Document.getInitialProps(ctx);
  const emotionStyles = extractCriticalToChunks(initialProps.html);
  const emotionStyleTags = emotionStyles.styles.map((style) => (
    <style
      data-emotion={`${style.key} ${style.ids.join(" ")}`}
      key={style.key}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: style.css }}
    />
  ));

  // <html lang> reflects the ?lang= locale so crawlers see the correct language.
  const SUPPORTED = ["en", "pt", "fr", "es", "de", "nl"];
  const q = ctx.query?.lang;
  const qv = Array.isArray(q) ? q[0] : q;
  const lang = typeof qv === "string" && SUPPORTED.includes(qv) ? qv : "en";

  return { ...initialProps, emotionStyleTags, lang };
};
