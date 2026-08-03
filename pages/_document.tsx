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
};

export default function MyDocument({ emotionStyleTags }: MyDocumentProps) {
  return (
    <Html>
      <Head>
        {/* Favicon — adaptive dark/light so the mark never disappears on dark browser
            themes. SVG self-switches via prefers-color-scheme; PNG media links cover
            browsers without SVG-favicon support; .ico is the final fallback.
            v3 bump forces browsers/mobiles to drop the cached blue (and v2 dark) icon. */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=3" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png?v=3" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32-light.png?v=3" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16-light.png?v=3" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="apple-touch-icon" href="/dynopay-favicon.png?v=3" />
        {/* iOS safe area and mobile optimization — viewport is set via next.config or _app */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#0A0A0A" />

        {/* Fonts now served via next/font (Geist Sans + Geist Mono). See _app.tsx.
            Legacy Manrope woffs kept in /public/fonts as fallback for any
            component that still references Manrope by name during hydration. */}

        {/* Swiss landing display/body/mono fonts (Unbounded + IBM Plex) are now
            self-hosted + preloaded via next/font/google in _app.tsx with
            display:"optional" (no FOUT). The old Google Fonts <link> that used
            &display=swap was removed on 2026-07-21 — it caused the hero/heading
            font to swap in mid-paint (thin fallback → bold Unbounded). */}

        {/* Google Identity Services for client-side OAuth (bypasses NextAuth /api/auth/* K8s conflict) */}
        <script src="https://accounts.google.com/gsi/client" async defer></script>

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
    var TZ_MAP = {
      'America/Sao_Paulo':'pt','America/Fortaleza':'pt','America/Recife':'pt',
      'America/Bahia':'pt','America/Belem':'pt','America/Manaus':'pt','Europe/Lisbon':'pt',
      'Europe/Madrid':'es','America/Mexico_City':'es','America/Bogota':'es',
      'America/Lima':'es','America/Santiago':'es','America/Argentina/Buenos_Aires':'es',
      'Europe/Paris':'fr','Africa/Dakar':'fr','Africa/Abidjan':'fr',
      'Europe/Berlin':'de','Europe/Vienna':'de','Europe/Zurich':'de',
      'Europe/Amsterdam':'nl','Europe/Brussels':'nl'
    };
    var lang = localStorage.getItem('lang');
    if (!lang || SUPPORTED.indexOf(lang) === -1) {
      var bl = (navigator.language || '').split('-')[0];
      lang = SUPPORTED.indexOf(bl) !== -1 ? bl : null;
      if (!lang) {
        var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        lang = (tz && TZ_MAP[tz]) || 'en';
      }
    }
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
             docs) default to LIGHT. User toggles are scoped per context. ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    // Keep this list IN SYNC with utils/theme/routeContext.ts INAPP_PREFIXES.
    // Duplicated here because this script runs before any JS modules load.
    var INAPP = ['/dashboard','/transactions','/wallet','/wallets','/customers','/invoices','/notifications','/settings','/profile','/create-pay-link','/referrals','/developer-keys','/company','/fees','/admin','/creator','/payouts'];
    var path = (location.pathname || '/').replace(/\\/+$/, '') || '/';
    var context = 'public';
    for (var i = 0; i < INAPP.length; i++) {
      if (path === INAPP[i] || path.indexOf(INAPP[i] + '/') === 0) { context = 'inapp'; break; }
    }
    var storageKey = context === 'inapp' ? 'theme-mode-inapp' : 'theme-mode-public';
    var cookieName = storageKey;
    var defaultMode = context === 'inapp' ? 'dark' : 'light';

    // Read the context-scoped preference; fall back to route default.
    var saved = localStorage.getItem(storageKey);
    // One-time migration: if the old single 'theme-mode' key exists and the
    // new context-scoped key doesn't, seed only the CURRENT context. This
    // preserves a returning user's explicit choice on the surface where
    // they made it, without stamping their dashboard preference onto the
    // landing page (or vice versa).
    if (saved !== 'light' && saved !== 'dark') {
      var legacy = localStorage.getItem('theme-mode');
      if (legacy === 'light' || legacy === 'dark') {
        saved = legacy;
        try { localStorage.setItem(storageKey, legacy); } catch (e) {}
      }
    }
    var mode = (saved === 'light' || saved === 'dark') ? saved : defaultMode;

    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.backgroundColor = mode === 'light' ? '#F2F3F8' : '#0B0D17';
    document.cookie = cookieName + '=' + mode + '; path=/; max-age=31536000; samesite=lax';
  } catch(e) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
    document.documentElement.style.backgroundColor = '#F2F3F8';
  }
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

  return { ...initialProps, emotionStyleTags };
};
