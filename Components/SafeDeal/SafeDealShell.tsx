import React, { ReactNode, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Box, Button, Container, Stack, Typography, ThemeProvider, createTheme, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { isPlaceholderSdEmail } from "@/api/safedeal";
import { useSdHref, useSdSession } from "./sdRouting";
import { SdLockup } from "./brand/SdLockup";
import { SD_MARK } from "./brand/sdLogoData";
import AddEmailDialog from "./AddEmailDialog";
import ReferralBanner from "./Rewards/ReferralBanner";
import InstallAppPrompt from "@/Components/UI/InstallAppPrompt";
import ToastHost from "@/Components/UI/Toast/ToastHost";
import {
  SD_GOLD,
  SD_GOLD_DARK,
  SD_GOLD_DEEP,
  SD_GOLD_SOFT,
  SD_INK as SD_INK_TOKEN,
  SD_INK_SOFT as SD_INK_SOFT_TOKEN,
  SD_INK_MUTED as SD_INK_MUTED_TOKEN,
  POWERED_BY_LINE,
} from "./sdTheme";

/* Back-compat re-exports (kept so existing SafeDeal components keep importing
   these names from the shell). SD_AMBER is now the brand GOLD accent. */
export const SD_INK = SD_INK_TOKEN;
export const SD_INK_SOFT = SD_INK_SOFT_TOKEN;
export const SD_AMBER = SD_GOLD;
export const SD_INK_MUTED = SD_INK_MUTED_TOKEN;

/** Full SafeDeal logo — symbol + one-colour wordmark. `size` ≈ the old font size (cap height = 72%). */
export function SafeDealLogo({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  return <SdLockup mark={SD_MARK} cap={Math.round(size * 0.72)} ink={light ? "#FFFFFF" : SD_INK} testId="sd-logo" />;
}

const FOOTER_LINKS = [
  { label: "Fees", to: "/#fees", testid: "sd-footer-fees" },
  { label: "Help centre", to: "/help", testid: "sd-footer-help" },
  { label: "Terms of use", to: "/terms", testid: "sd-footer-terms" },
  { label: "Privacy", to: "/privacy", testid: "sd-footer-privacy" },
];

/** Canonical production origin — SEO/OG URLs always point here, even from the preview host. */
const SD_SITE = "https://safedeal.sh";
const SD_DEFAULT_DESC =
  "SafeDeal holds the buyer's payment in USDT escrow until the seller delivers, and steps in only if there's a dispute. 5% fee, no account to set up — both sides sign in with an email code.";

export default function SafeDealShell({
  children,
  title,
  description,
  noindex = false,
  ogImage,
  ogImageAlt,
  wide = false,
  dark = false,
  jsonLd,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  noindex?: boolean;
  ogImage?: string;
  ogImageAlt?: string;
  wide?: boolean;
  dark?: boolean;
  /** Page-specific schema.org structured data (FAQPage, Service, …). Merged with the base Organization + WebSite graph. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  const href = useSdHref();
  const router = useRouter();
  // Inherit Dynopay's base theme but override ONLY the primary palette to
  // SafeDeal gold, so every unstyled MUI control (default buttons, links,
  // Switch, TextField focus ring/label, CircularProgress, Tabs) renders gold
  // instead of Dynopay's indigo. Portaled dialogs keep React context, so this
  // covers the SafeDeal dialogs too.
  const parentTheme = useTheme();
  const sdMuiTheme = React.useMemo(
    () =>
      createTheme(parentTheme, {
        palette: { primary: { main: SD_GOLD_DEEP, light: SD_GOLD, dark: SD_GOLD_DARK, contrastText: "#fff" }, error: { main: "#CE1A41" } },
        components: {
          // Dynopay's theme hardcodes an indigo focus border + legacy navy select text; SafeDeal is gold/ink.
          MuiOutlinedInput: { styleOverrides: { root: { "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: SD_GOLD_DEEP } } } },
          MuiSelect: { styleOverrides: { outlined: { color: "inherit" } } },
          // Dynopay's parent theme sets palette.{success,info,warning,error}.light to a TRANSLUCENT
          // colour (e.g. success.light="rgba(5,150,105,0.10)"). MUI uses `.light` as the base for the
          // STANDARD Alert variant, so darken()/lighten() keep that ~10% alpha and the alert's text +
          // background render almost invisible (only the opaque icon shows). Restore opaque, readable,
          // on-brand colours for every standard alert used across SafeDeal (credited, reserved, parked…).
          MuiAlert: {
            styleOverrides: {
              standardSuccess: { color: "#065F46", backgroundColor: "#ECFDF5", "& .MuiAlert-icon": { color: "#059669" } },
              standardInfo: { color: "#1F2937", backgroundColor: SD_GOLD_SOFT, "& .MuiAlert-icon": { color: SD_GOLD_DEEP } },
              standardWarning: { color: "#92400E", backgroundColor: "#FFFAEB", "& .MuiAlert-icon": { color: "#D97706" } },
              standardError: { color: "#B91C1C", backgroundColor: "#FEF2F2", "& .MuiAlert-icon": { color: "#DC2626" } },
            },
          },
        },
      }),
    [parentTheme],
  );
  const { user, ready, signOut } = useSdSession();
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const path = router.asPath;
  // SEO — titles/OG/canonical always resolve to the production SafeDeal origin.
  const fullTitle = title ? `${title} · SafeDeal` : "SafeDeal — escrow for buying & selling online";
  const metaDescription = description || SD_DEFAULT_DESC;
  const cleanPath = path.split("?")[0].split("#")[0].replace(/^\/safedeal(?=\/|$)/, "") || "/";
  const canonicalUrl = `${SD_SITE}${cleanPath === "/" ? "" : cleanPath}`;
  const ogImageUrl = ogImage || `${SD_SITE}/safedeal/og-image.png?v=2`;
  // Structured data (schema.org). Base Organization + WebSite graph on every
  // indexable SafeDeal page so Google/Bing resolve the brand entity; pages may
  // add their own (FAQPage on /help, Service on the landing).
  const baseJsonLd: Array<Record<string, unknown>> = noindex
    ? []
    : [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": `${SD_SITE}/#organization`,
          name: "SafeDeal",
          url: SD_SITE,
          logo: `${SD_SITE}/safedeal/favicon-512.png?v=2`,
          image: ogImageUrl,
          description: SD_DEFAULT_DESC,
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${SD_SITE}/#website`,
          name: "SafeDeal",
          url: SD_SITE,
          inLanguage: "en",
          publisher: { "@id": `${SD_SITE}/#organization` },
        },
      ];
  const pageJsonLd = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const allJsonLd = [...baseJsonLd, ...pageJsonLd];
  const isActive = (p: string) => path.includes(p);
  // The deal-detail page renders a mobile-only fixed "Your move" action bar
  // (position:fixed, bottom:0). Reserve safe-area at the very bottom so that
  // bar never covers the footer's legal line on small screens.
  const isDealPage = path.includes("/deal/");
  const [legalName, setLegalName] = useState("SafeDeal");
  useEffect(() => {
    safedealApi.config().then((c) => c.legal_name && setLegalName(c.legal_name)).catch(() => undefined);
  }, []);

  const nav: Array<{ label: string; to: string; key: string; testid: string; icon?: string }> = user
    ? [
        { label: "Home", to: "/deals", key: "/deals", testid: "sd-nav-deals" },
        { label: "Wallet", to: "/wallet", key: "/wallet", testid: "sd-nav-wallet" },
        { label: "Rewards", to: "/rewards", key: "/rewards", testid: "sd-nav-rewards", icon: "mdi:gift-outline" },
      ]
    : [{ label: "How it works", to: "/#how", key: "#how", testid: "sd-nav-how" }, { label: "Fees", to: "/#fees", key: "#fees", testid: "sd-nav-fees" }];

  const fg = dark ? "#fff" : SD_INK;
  const muted = dark ? SD_INK_MUTED : "#6B6B72";
  const navActive = dark ? SD_GOLD : SD_GOLD_DEEP;

  return (
    <ThemeProvider theme={sdMuiTheme}>
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: dark ? SD_INK : "#F5F7FA",
        color: fg,
        "--dyno-focus-ring": SD_GOLD,
        "--dyno-focus-ring-shadow": "0 0 0 3px rgba(255,198,26,0.35)",
      }}
    >
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={metaDescription} />
        {/* theme-color / apple title are route-aware in _app.tsx (gold on /safedeal). */}
        {/* Canonical + OG/Twitter reuse the SAME keys as the global _app Head so
            these SafeDeal values DEDUPE-OVERRIDE the Dynopay defaults (next/head
            keeps the last-rendered tag per key; the page Head wins over _app). */}
        <link key="canonical" rel="canonical" href={canonicalUrl} />
        <meta key="robots" name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"} />
        {/* Open Graph (link previews on WhatsApp / Telegram / Slack / iMessage) */}
        <meta key="og:type" property="og:type" content="website" />
        <meta key="og:site_name" property="og:site_name" content="SafeDeal" />
        <meta key="og:title" property="og:title" content={fullTitle} />
        <meta key="og:description" property="og:description" content={metaDescription} />
        <meta key="og:url" property="og:url" content={canonicalUrl} />
        <meta key="og:image" property="og:image" content={ogImageUrl} />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta key="og:image:alt" property="og:image:alt" content={ogImageAlt || "SafeDeal — escrow for online deals"} />
        {/* Twitter / X card */}
        <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
        <meta key="twitter:title" name="twitter:title" content={fullTitle} />
        <meta key="twitter:description" name="twitter:description" content={metaDescription} />
        <meta key="twitter:image" name="twitter:image" content={ogImageUrl} />
        {/* schema.org structured data — Organization + WebSite (+ page-specific FAQPage/Service). */}
        {allJsonLd.map((obj, i) => (
          <script
            key={`sd-jsonld-${i}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
          />
        ))}
        {/* Dialogs portal to <body>, outside this Box — set the ring var globally so they stay gold too. */}
        <style key="sd-focus-ring">{`:root{--dyno-focus-ring:${SD_GOLD};--dyno-focus-ring-shadow:0 0 0 3px rgba(255,198,26,0.35)}`}</style>
      </Head>
      <Box component="header" sx={{ borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E1E5EA", backgroundColor: dark ? "rgba(10,10,11,0.85)" : "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: "env(safe-area-inset-top, 0px)", zIndex: 20 }}>
        <Container maxWidth={wide ? "xl" : "lg"} sx={{ py: 1.4, px: { xs: 1, sm: 3 }, display: "flex", alignItems: "center", justifyContent: "space-between", gap: { xs: 0.75, sm: 2 } }}>
          <Link href={href(user ? "/deals" : "/")} style={{ textDecoration: "none" }} aria-label="SafeDeal home">
            <SafeDealLogo light={dark} />
          </Link>
          <Stack component="nav" aria-label="Main" direction="row" spacing={{ xs: 0.25, sm: 2.5 }} alignItems="center">
            {nav.map((n) => (
              <Link key={n.key} href={href(n.to)} data-testid={n.testid} style={{ textDecoration: "none", display: "inline-flex" }} aria-current={isActive(n.key) ? "page" : undefined} aria-label={n.label}>
                {/* ≥44px tap target on phones (was a bare 26px text run) */}
                <Typography component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minHeight: 44, px: { xs: 0.6, sm: 0.5 }, borderRadius: 2, fontSize: { xs: 13.5, sm: 14 }, fontWeight: 700, whiteSpace: "nowrap", color: isActive(n.key) ? navActive : dark ? "rgba(255,255,255,0.8)" : "#4B4B52", "&:hover": { color: navActive }, "&:active": { backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(18,18,20,0.05)" }, transition: "color .15s, background-color .15s" }}>
                  {n.icon && <Icon icon={n.icon} width={17} aria-hidden />}
                  {/* Icon-only on phones so the header never overflows. */}
                  <Box component="span" sx={n.icon ? { display: { xs: "none", sm: "inline" } } : undefined}>{n.label}</Box>
                </Typography>
              </Link>
            ))}
            {ready && user ? (
              <Stack direction="row" spacing={1} alignItems="center">
                {isPlaceholderSdEmail(user.email) ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setAddEmailOpen(true)}
                    data-testid="sd-nav-add-email"
                    startIcon={<Icon icon="mdi:email-plus-outline" width={16} />}
                    sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, whiteSpace: "nowrap", minWidth: 0, minHeight: 44, borderColor: SD_GOLD, color: fg, "&:hover": { borderColor: SD_GOLD_DEEP, backgroundColor: SD_GOLD_SOFT } }}
                  >
                    Add email
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setAddEmailOpen(true)}
                    data-testid="sd-nav-user"
                    endIcon={<Icon icon="mdi:pencil-outline" width={13} />}
                    sx={{ textTransform: "none", fontWeight: 700, fontSize: 12.5, color: muted, display: { xs: "none", sm: "inline-flex" }, minWidth: 0, px: 0.75, "&:hover": { color: fg, backgroundColor: "transparent" } }}
                  >
                    {user.email}
                  </Button>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    signOut();
                    void router.push(href("/"));
                  }}
                  data-testid="sd-nav-signout"
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99, whiteSpace: "nowrap", minWidth: 0, minHeight: 44, px: { xs: 1.25, sm: 1.5 }, borderColor: dark ? "rgba(255,255,255,0.25)" : "#D5DAE0", color: fg, "&:hover": { borderColor: SD_GOLD_DEEP } }}
                >
                  Sign out
                </Button>
              </Stack>
            ) : ready ? (
              <Link href={href("/signin")} data-testid="sd-nav-signin" style={{ textDecoration: "none" }}>
                <Button size="small" variant="contained" sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, px: { xs: 1.5, sm: 2 }, minHeight: 44, whiteSpace: "nowrap", color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>
                  Sign in
                </Button>
              </Link>
            ) : null}
          </Stack>
        </Container>
      </Box>

      <Box component="main" sx={{ flex: 1 }}>
        {ready && user && !dark && (
          <Container maxWidth={wide ? "xl" : "lg"} sx={{ pt: 1.5, pb: 0, "&:empty": { display: "none" } }}>
            <InstallAppPrompt brand="safedeal" body="Track your deals and cash out in one tap." />
          </Container>
        )}
        {ready && !user && <ReferralBanner wide={wide} dark={dark} />}
        {children}
      </Box>

      <Box component="footer" sx={{ borderTop: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E1E5EA", py: 4, mt: 6 }} data-testid="sd-footer">
        <Container maxWidth={wide ? "xl" : "lg"}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "flex-start" }} spacing={3}>
            <Box sx={{ maxWidth: 400 }}>
              <SafeDealLogo light={dark} size={18} />
              <Typography sx={{ fontSize: 13, color: muted, mt: 1.2, lineHeight: 1.6 }}>
                Escrow for online deals. SafeDeal holds the buyer&apos;s payment in USDT and releases it to the seller once the deal is done.
              </Typography>
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1.2 }} data-testid="sd-powered-by">
                <Icon icon="mdi:credit-card-check-outline" width={15} color={dark ? SD_GOLD : SD_GOLD_DEEP} aria-hidden />
                <Typography sx={{ fontSize: 12.5, color: muted }}>
                  {POWERED_BY_LINE}
                </Typography>
              </Stack>
            </Box>
            <Stack component="nav" aria-label="Footer" direction="row" spacing={{ xs: 2, sm: 3 }} flexWrap="wrap" useFlexGap>
              {FOOTER_LINKS.map((l) => (
                <Link key={l.to} href={href(l.to)} data-testid={l.testid} style={{ textDecoration: "none" }}>
                  <Typography component="span" sx={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 13.5, fontWeight: 700, color: dark ? "rgba(255,255,255,0.85)" : "#374151", "&:hover": { color: navActive } }}>{l.label}</Typography>
                </Link>
              ))}
            </Stack>
          </Stack>
          <Typography sx={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.6)" : "#6B6B72", mt: 3 }} data-testid="sd-footer-legal">
            © {new Date().getFullYear()} SafeDeal · safedeal.sh{legalName && legalName !== "SafeDeal" ? ` · Operated by ${legalName.replace(/\.$/, "")}` : ""}. Not a bank; funds are held as USDT in SafeDeal escrow.
          </Typography>
        </Container>
      </Box>
      {isDealPage && <Box aria-hidden data-testid="sd-mobile-sticky-safearea" sx={{ display: { xs: "block", md: "none" }, height: 84 }} />}
      {user && <AddEmailDialog open={addEmailOpen} onClose={() => setAddEmailOpen(false)} onDone={(connected) => { if (connected > 0) router.reload(); }} />}
      <ToastHost />
    </Box>
    </ThemeProvider>
  );
}
