import React, { ReactNode } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Box, Button, Container, Stack, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import { useSdHref, useSdSession } from "./sdRouting";

export const SD_INK = "#0B1020";
export const SD_INK_SOFT = "#151B2E";
export const SD_AMBER = "#F59E0B";

export function SafeDealLogo({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.9} data-testid="sd-logo">
      <Box
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
      <Typography sx={{ fontWeight: 900, fontSize: size - 2, letterSpacing: -0.5, color: light ? "#fff" : SD_INK }}>
        Safe<span style={{ color: light ? "#A5B4FC" : BRAND_ACCENT }}>Deal</span>
      </Typography>
    </Stack>
  );
}

export default function SafeDealShell({ children, title, wide = false, dark = false }: { children: ReactNode; title?: string; wide?: boolean; dark?: boolean }) {
  const href = useSdHref();
  const router = useRouter();
  const { user, ready, signOut } = useSdSession();
  const theme = useTheme();
  const path = router.asPath;
  const isActive = (p: string) => path.includes(p);

  const nav = user
    ? [
        { label: "My deals", to: "/deals", key: "/deals", testid: "sd-nav-deals" },
        { label: "Wallet", to: "/wallet", key: "/wallet", testid: "sd-nav-wallet" },
      ]
    : [{ label: "How it works", to: "/#how", key: "#how", testid: "sd-nav-how" }, { label: "Fees", to: "/#fees", key: "#fees", testid: "sd-nav-fees" }];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: dark ? SD_INK : "#F6F7FB", color: dark ? "#fff" : SD_INK }}>
      <Head>
        <title>{title ? `${title} · SafeDeal` : "SafeDeal — escrow for online deals, powered by Dynopay"}</title>
        <meta name="description" content="SafeDeal holds the buyer's payment until the seller delivers. 5% fee, no accounts to set up — sign in with your email." />
      </Head>
      <Box component="header" sx={{ borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E5E7EB", backgroundColor: dark ? SD_INK : "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 20 }}>
        <Container maxWidth={wide ? "xl" : "lg"} sx={{ py: 1.4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Link href={href(user ? "/deals" : "/")} style={{ textDecoration: "none" }}>
            <SafeDealLogo light={dark} />
          </Link>
          <Stack direction="row" spacing={{ xs: 1, sm: 2.5 }} alignItems="center">
            {nav.map((n) => (
              <Link key={n.key} href={href(n.to)} data-testid={n.testid} style={{ textDecoration: "none" }}>
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isActive(n.key) ? BRAND_ACCENT : dark ? "rgba(255,255,255,0.75)" : "#4B5563",
                    "&:hover": { color: BRAND_ACCENT },
                    transition: "color .15s",
                  }}
                >
                  {n.label}
                </Typography>
              </Link>
            ))}
            {ready && user ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 12.5, color: dark ? "rgba(255,255,255,0.6)" : "#6B7280", display: { xs: "none", sm: "block" } }} data-testid="sd-nav-user">
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
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99, borderColor: dark ? "rgba(255,255,255,0.25)" : "#D1D5DB", color: dark ? "#fff" : SD_INK }}
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

      <Box component="footer" sx={{ borderTop: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E5E7EB", py: 3, mt: 6 }}>
        <Container maxWidth={wide ? "xl" : "lg"}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" data-testid="sd-powered-by">
              <Icon icon="mdi:lightning-bolt" width={16} color={dark ? "#A5B4FC" : BRAND_ACCENT} />
              <Typography sx={{ fontSize: 12.5, color: dark ? "rgba(255,255,255,0.6)" : "#6B7280" }}>
                Powered by <b style={{ color: dark ? "#fff" : theme.palette.text.primary }}>Dynopay</b> — payments, custody in USDT, and payouts.
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.45)" : "#9CA3AF" }}>© {new Date().getFullYear()} SafeDeal · safedeal.sh</Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
