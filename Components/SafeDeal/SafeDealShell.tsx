import React, { ReactNode, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi from "@/api/safedeal";
import { useSdHref, useSdSession } from "./sdRouting";

export const SD_INK = "#0B1020";
export const SD_INK_SOFT = "#151B2E";
export const SD_AMBER = "#F59E0B";
/** Captions on ink cards — ≥ 4.5:1 on SD_INK (was 0.55 which fails WCAG AA). */
export const SD_INK_MUTED = "rgba(255,255,255,0.72)";

export function SafeDealLogo({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.9} data-testid="sd-logo">
      <Box
        aria-hidden
        sx={{
          width: size + 10,
          height: size + 10,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          background: `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #6366F1 100%)`,
          boxShadow: "0 6px 18px rgba(67,56,202,0.35)",
        }}
      >
        <Icon icon="mdi:shield-check" width={size} color="#fff" />
      </Box>
      <Typography component="span" sx={{ fontWeight: 900, fontSize: size - 2, letterSpacing: -0.5, color: light ? "#fff" : SD_INK }}>
        Safe<span style={{ color: light ? "#A5B4FC" : BRAND_ACCENT }}>Deal</span>
      </Typography>
    </Stack>
  );
}

const FOOTER_LINKS = [
  { label: "Fees", to: "/#fees", testid: "sd-footer-fees" },
  { label: "Help centre", to: "/help", testid: "sd-footer-help" },
  { label: "Terms of use", to: "/terms", testid: "sd-footer-terms" },
  { label: "Privacy", to: "/privacy", testid: "sd-footer-privacy" },
];

export default function SafeDealShell({ children, title, wide = false, dark = false }: { children: ReactNode; title?: string; wide?: boolean; dark?: boolean }) {
  const href = useSdHref();
  const router = useRouter();
  const { user, ready, signOut } = useSdSession();
  const path = router.asPath;
  const isActive = (p: string) => path.includes(p);
  const [legalName, setLegalName] = useState("Dynopay Payments Ltd.");
  useEffect(() => {
    safedealApi.config().then((c) => c.legal_name && setLegalName(c.legal_name)).catch(() => undefined);
  }, []);

  const nav = user
    ? [
        { label: "My deals", to: "/deals", key: "/deals", testid: "sd-nav-deals" },
        { label: "Wallet", to: "/wallet", key: "/wallet", testid: "sd-nav-wallet" },
      ]
    : [{ label: "How it works", to: "/#how", key: "#how", testid: "sd-nav-how" }, { label: "Fees", to: "/#fees", key: "#fees", testid: "sd-nav-fees" }];

  const fg = dark ? "#fff" : SD_INK;
  const muted = dark ? SD_INK_MUTED : "#6B7280";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: dark ? SD_INK : "#F6F7FB",
        color: fg,
        // Global focus ring reads these vars (styles/globals.css) — brand indigo inside SafeDeal.
        "--dyno-focus-ring": dark ? "#A5B4FC" : BRAND_ACCENT,
        "--dyno-focus-ring-shadow": dark ? "0 0 0 2px rgba(165,180,252,0.3)" : "0 0 0 2px rgba(67,56,202,0.25)",
      }}
    >
      <Head>
        <title>{title ? `${title} · SafeDeal` : "SafeDeal — escrow for online deals, powered by Dynopay"}</title>
        <meta name="description" content="SafeDeal holds the buyer's payment until the seller delivers. 5% fee, no accounts to set up — sign in with your email." />
      </Head>
      <Box component="header" sx={{ borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E5E7EB", backgroundColor: dark ? SD_INK : "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 20 }}>
        <Container maxWidth={wide ? "xl" : "lg"} sx={{ py: 1.4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: { xs: 1, sm: 2 } }}>
          <Link href={href(user ? "/deals" : "/")} style={{ textDecoration: "none" }} aria-label="SafeDeal home">
            <SafeDealLogo light={dark} />
          </Link>
          <Stack component="nav" aria-label="Main" direction="row" spacing={{ xs: 1, sm: 2.5 }} alignItems="center">
            {nav.map((n) => (
              <Link key={n.key} href={href(n.to)} data-testid={n.testid} style={{ textDecoration: "none" }} aria-current={isActive(n.key) ? "page" : undefined}>
                <Typography component="span" sx={{ fontSize: { xs: 13, sm: 14 }, fontWeight: 700, whiteSpace: "nowrap", color: isActive(n.key) ? BRAND_ACCENT : dark ? "rgba(255,255,255,0.8)" : "#4B5563", "&:hover": { color: BRAND_ACCENT }, transition: "color .15s" }}>
                  {n.label}
                </Typography>
              </Link>
            ))}
            {ready && user ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 12.5, color: muted, display: { xs: "none", sm: "block" } }} data-testid="sd-nav-user">
                  {user.email}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    signOut();
                    void router.push(href("/"));
                  }}
                  data-testid="sd-nav-signout"
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99, whiteSpace: "nowrap", minWidth: 0, borderColor: dark ? "rgba(255,255,255,0.25)" : "#D1D5DB", color: fg }}
                >
                  Sign out
                </Button>
              </Stack>
            ) : ready ? (
              <Link href={href("/signin")} data-testid="sd-nav-signin" style={{ textDecoration: "none" }}>
                <Button size="small" variant="contained" sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, px: 2, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }}>
                  Sign in
                </Button>
              </Link>
            ) : null}
          </Stack>
        </Container>
      </Box>

      <Box component="main" sx={{ flex: 1 }}>{children}</Box>

      <Box component="footer" sx={{ borderTop: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E5E7EB", py: 4, mt: 6 }} data-testid="sd-footer">
        <Container maxWidth={wide ? "xl" : "lg"}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "flex-start" }} spacing={3}>
            <Box sx={{ maxWidth: 380 }}>
              <SafeDealLogo light={dark} size={18} />
              <Typography sx={{ fontSize: 13, color: muted, mt: 1.2, lineHeight: 1.6 }}>
                Escrow for online deals. The buyer&apos;s money is held in USDT by Dynopay and released when the seller delivers.
              </Typography>
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1.2 }} data-testid="sd-powered-by">
                <Icon icon="mdi:lightning-bolt" width={15} color={dark ? "#A5B4FC" : BRAND_ACCENT} aria-hidden />
                <Typography sx={{ fontSize: 12.5, color: muted }}>
                  Powered by <b style={{ color: fg }}>Dynopay</b> — payments, custody and payouts
                </Typography>
              </Stack>
            </Box>
            <Stack component="nav" aria-label="Footer" direction="row" spacing={{ xs: 2, sm: 3 }} flexWrap="wrap" useFlexGap>
              {FOOTER_LINKS.map((l) => (
                <Link key={l.to} href={href(l.to)} data-testid={l.testid} style={{ textDecoration: "none" }}>
                  <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 700, color: dark ? "rgba(255,255,255,0.85)" : "#374151", "&:hover": { color: BRAND_ACCENT } }}>{l.label}</Typography>
                </Link>
              ))}
            </Stack>
          </Stack>
          <Typography sx={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.6)" : "#9CA3AF", mt: 3 }} data-testid="sd-footer-legal">
            © {new Date().getFullYear()} SafeDeal · safedeal.sh · Operated by {legalName.replace(/\.$/, "")}. Not a bank; funds are held as USDT in escrow custody.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
