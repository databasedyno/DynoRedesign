import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useVerticalAccent, Eyebrow, type Vertical } from "@/Components/UI/_shared";

/**
 * OnboardingBanner — the compact "Welcome, let's set up your X" strip that
 * appears at the top of each vertical-specific first-run destination.
 *
 * Behaviour:
 *   • Only renders when the URL includes `?onboarding=1` (the query the
 *     register success flow appends to the destination path — see
 *     `helpers/verticalOnboarding.ts`).
 *   • The label + icon change per vertical (creator page / first product /
 *     campaign page / API access).
 *   • The accent color follows `useVerticalAccent()` so the banner already
 *     shows the color the rest of the app will adopt once the user's
 *     purpose_vertical is loaded from Redux.
 *   • Has a right-aligned "Skip setup, go to dashboard →" link that clears
 *     the `?onboarding=1` param (via `router.replace`) and routes to
 *     `/dashboard`.
 *   • Also clears the query param once the user completes the setup step
 *     (`shouldRender` becomes false on re-render). Reload-safe.
 */

const VERTICAL_META: Record<Vertical, { icon: string; label: string; heading: string; body: string }> = {
  creators: {
    icon: "mdi:sparkles-outline",
    label: "creator page",
    heading: "Claim your @handle",
    body: "Pick a handle and turn on the tip widget — your public creator page goes live in under a minute.",
  },
  merchants: {
    icon: "mdi:storefront-outline",
    label: "first product",
    heading: "Add your first product",
    body: "Name it, price it, pick the crypto you'll accept. Your storefront + a shareable pay-link land in one shot.",
  },
  fundraisers: {
    icon: "mdi:hand-heart-outline",
    label: "campaign page",
    heading: "Launch your first campaign",
    body: "Set a funding goal, add reward tiers, and share a page that accepts BTC, ETH, USDT, and more.",
  },
  developers: {
    icon: "mdi:code-tags",
    label: "API access",
    heading: "Grab your API keys",
    body: "Copy your live + sandbox keys, install the SDK, and drop the embed on any page in ~10 lines of code.",
  },
};

export default function OnboardingBanner({ vertical }: { vertical: Vertical }) {
  const theme = useTheme();
  const router = useRouter();
  const dark = theme.palette.mode === "dark";
  const accent = useVerticalAccent(vertical);
  const meta = VERTICAL_META[vertical];

  // Only render when `?onboarding=1` is present. Read from `router.query`
  // so we react to client-side navigations too. `mounted` gate prevents
  // SSR/CSR mismatch (query is populated only on the client for dynamic
  // routes).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const shouldRender = mounted && router.query.onboarding === "1";
  if (!shouldRender) return null;

  const handleSkip = () => {
    // Strip the `?onboarding=1` param and route home. Using `router.replace`
    // instead of `push` so the current URL doesn't stack in the back button.
    router.replace("/dashboard");
  };

  return (
    <Box
      data-testid="onboarding-banner"
      data-vertical={vertical}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "12px",
        padding: { xs: "16px 18px", md: "18px 22px" },
        marginBottom: { xs: 2, md: 2.5 },
        border: `1px solid ${accent.color}33`,
        backgroundColor: accent.tint,
        display: "flex",
        alignItems: { xs: "flex-start", md: "center" },
        gap: { xs: 1.5, md: 2 },
        flexWrap: "wrap",
      }}
    >
      {/* Left accent bar — vertical-tinted stripe */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accent.color,
        }}
      />

      {/* Vertical icon tile */}
      <Box
        sx={{
          width: 40, height: 40, flexShrink: 0,
          borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: accent.color,
          color: accent.onColor,
        }}
      >
        <Icon icon={meta.icon} width={22} />
      </Box>

      {/* Copy */}
      <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
        <Eyebrow tone="ink" sx={{ color: accent.color, mb: 0.4, fontSize: 10.5 }}>
          Welcome to Dynopay
        </Eyebrow>
        <Typography
          sx={{
            fontFamily: "var(--font-hero), var(--font-body)",
            fontSize: { xs: 16, md: 18 },
            fontWeight: 700,
            letterSpacing: "-0.015em",
            color: theme.palette.text.primary,
            lineHeight: 1.2,
          }}
        >
          {meta.heading}
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-body)",
            fontSize: { xs: 12.5, md: 13.5 },
            color: theme.palette.text.secondary,
            lineHeight: 1.5,
            mt: 0.5,
          }}
        >
          {meta.body}
        </Typography>
      </Box>

      {/* Skip link */}
      <Link href="/dashboard" passHref legacyBehavior>
        <Typography
          component="a"
          data-testid="onboarding-skip"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            handleSkip();
          }}
          sx={{
            flexShrink: 0,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            color: theme.palette.text.secondary,
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: "8px",
            border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,15,0.10)"}`,
            cursor: "pointer",
            whiteSpace: "nowrap",
            "&:hover": {
              color: theme.palette.text.primary,
              borderColor: dark ? "rgba(255,255,255,0.20)" : "rgba(10,10,15,0.20)",
            },
          }}
        >
          Skip setup →
        </Typography>
      </Link>
    </Box>
  );
}
