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
        {/* Favicon is managed ROUTE-AWARE in _app.tsx via next/head, so it stays
            correct across client-side navigation: SafeDeal routes (/safedeal/*) get
            the yellow/black SafeDeal mark, every other route keeps Dynopay's coin.
            Kept out of _document because _document only renders on the initial SSR
            and cannot re-assert the icon when the SPA navigates between pages. */}
        {/* iOS safe area and mobile optimization — viewport is set via next.config or _app */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#121214" />
        <link rel="alternate" type="application/rss+xml" title="Dynopay Blog" href="https://dynopay.com/blog/rss.xml" />
        {/* Poppins — display face for the Tatum-inspired marketing homepage headings. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap" rel="stylesheet" />
        {/* Poppins — display face for the Tatum-inspired marketing homepage headings. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap" rel="stylesheet" />

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
             Theme Memory (2026-09): ONE remembered choice (`dyno-theme`) for the
             whole site; with nothing remembered the device preference is used
             (live). SafeDeal is always light. Keep IN SYNC with
             utils/theme/routeContext.ts + contexts/ThemeContext.tsx. ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var KEY = 'dyno-theme', EFF = 'dyno-theme-eff';
  function ck(n){ try { var m = document.cookie.match(new RegExp('(?:^|; *)' + n + '=([^;]+)')); return m ? m[1] : null; } catch (e) { return null; } }
  function ls(n){ try { return localStorage.getItem(n); } catch (e) { return null; } }
  function ok(v){ return (v === 'light' || v === 'dark') ? v : null; }
  var path = '/', host = '';
  try { path = (location.pathname || '/').replace(/[/]+$/, '') || '/'; } catch (e) {}
  try { host = (location.hostname || '').toLowerCase(); } catch (e) {}
  // SafeDeal is always light — by path (/safedeal/* in preview) OR by host
  // (safedeal.sh rewrites "/signin" → "/safedeal/signin" server-side, so the
  // browser path alone never matches there; 2026-09-27 white-on-light inputs on dark-mode phones).
  var fixed = path === '/safedeal' || path.indexOf('/safedeal/') === 0 || host === 'safedeal.sh' || /\.safedeal\.sh$/.test(host);
  var mode = null;
  if (fixed) {
    mode = 'light';
  } else {
    mode = ok(ls(KEY)) || ok(ck(KEY));
    if (!mode) {
      // One-time migration: dashboard choice > legacy single key > public choice.
      var legacy = ok(ls('theme-mode-inapp')) || ok(ck('theme-mode-inapp')) || ok(ls('theme-mode')) || ok(ck('theme-mode')) || ok(ls('theme-mode-public')) || ok(ck('theme-mode-public-v2'));
      if (legacy) {
        mode = legacy;
        try { localStorage.setItem(KEY, legacy); } catch (e) {}
        try { document.cookie = KEY + '=' + legacy + '; path=/; max-age=31536000; samesite=lax'; } catch (e) {}
      }
    }
    if (!mode) {
      try { mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { mode = 'light'; }
    }
    try { document.cookie = EFF + '=' + mode + '; path=/; max-age=31536000; samesite=lax'; } catch (e) {}
  }
  try {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.backgroundColor = mode === 'light' ? '#FFFFFF' : '#000000';
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
