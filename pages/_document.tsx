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
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" href="/dynopay-favicon.png" />
        {/* iOS safe area and mobile optimization — viewport is set via next.config or _app */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#0004FF" />

        {/* Google Fonts — preconnect + link (non-blocking, replaces CSS @import) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
        />
        {/* Auth-suite display / body / mono fonts (bold "Floating Glass Bento" theme) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap"
        />

        {/* Preload critical fonts used on landing page for instant rendering */}
        <link rel="preload" href="/fonts/Outfit-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Outfit-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Outfit-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Urbanist-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Urbanist-SemiBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Urbanist-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

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
             Also seeds the theme-mode cookie so the NEXT SSR render matches. ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var saved = localStorage.getItem('theme-mode');
    var mode = (saved === 'light' || saved === 'dark')
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    document.documentElement.style.backgroundColor = mode === 'light' ? '#F2F3F8' : '#0B0D17';
    // Always refresh the theme-mode cookie so it tracks the current preference
    // (used by SSR on the next request in browsers that don't send the
    // Sec-CH-Prefers-Color-Scheme client hint, e.g. Firefox/Safari).
    document.cookie = 'theme-mode=' + mode + '; path=/; max-age=31536000; samesite=lax';
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
