import React, { useCallback, useEffect, useState } from "react";
import { Box, Typography, useTheme, IconButton, useMediaQuery } from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { useRouter } from "next/router";
import { useFeeFreeStatus } from "@/hooks/useFeeFreeStatus";

/**
 * FeeFreeBanner — persistent top-strip that shows the merchant's remaining
 * fee-free allowance across ALL logged-in pages (not just the dashboard).
 *
 * Design intent: users often skip company/wallet setup and never see the
 * FeeFreeWelcomeModal. This banner is the always-on reminder so the offer
 * doesn't get lost between page navigations, and the progress bar acts as a
 * subtle nudge to complete first-payment.
 *
 * Show conditions (all must hold):
 *  - User is logged in (JWT in localStorage) — checked implicitly via 401 fallback.
 *  - GET /api/company/fee-free-status → is_fee_free && fee_free_remaining_usd > 0
 *  - Not permanently dismissed on this browser (per-user localStorage flag).
 *
 * The fee-free status is read through the shared `useFeeFreeStatus` SWR hook so
 * this banner, the FeeFreeWidget and the FeeFreeWelcomeModal collapse into a
 * single deduped /company/fee-free-status request per page.
 */

const FeeFreeBanner: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [dismissed, setDismissed] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  // Suppress on unauthenticated pages (auth, marketing, checkout)
  const path = router.pathname || "";
  const suppressPaths = ["/auth", "/pay/", "/checkout", "/kyc", "/system-status"];
  const suppressed = suppressPaths.some((p) => path.startsWith(p));

  const { data } = useFeeFreeStatus({ enabled: !suppressed });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (suppressed) return;

    const resolveIdentity = (): string | null => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return null;
        const payloadB64 = token.split(".")[1] || "";
        const json = JSON.parse(
          atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
        );
        return json?.email || (json?.user_id != null ? `uid:${json.user_id}` : null);
      } catch {
        return null;
      }
    };

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attempt = () => {
      const identity = resolveIdentity();
      if (!identity) {
        // Token not yet in localStorage (e.g. tester injected AFTER mount).
        // Retry a few times before giving up so the banner catches up.
        if (!cancelled) retryTimer = setTimeout(attempt, 500);
        return;
      }
      const key = `ff_banner_dismissed:${identity}`;
      setStorageKey(key);
      try {
        if (localStorage.getItem(key)) setDismissed(true);
      } catch {
        /* ignore */
      }
    };

    attempt();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [suppressed, path]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  const handleCta = useCallback(() => {
    router.push("/create-pay-link");
  }, [router]);

  const showable =
    !!data && data.is_fee_free && Number(data.fee_free_remaining_usd) > 0;

  if (dismissed || suppressed || !showable || !data) return null;

  return (
    <Box
      data-testid="fee-free-banner"
      role="region"
      aria-label="Fee-free trial progress"
      sx={{
        width: "100%",
        background: "linear-gradient(90deg, #0A0A0A 0%, #111111 100%)",
        color: "#FFFFFF",
        borderBottom: "1px solid rgba(63,217,138,0.35)",
        px: { xs: 1.5, md: 3 },
        py: { xs: 0.75, md: 1 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, md: 2 },
          maxWidth: 1440,
          mx: "auto",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            flexShrink: 0,
          }}
        >
          <LocalOfferRounded sx={{ fontSize: { xs: 16, md: 18 }, color: "#3FD98A" }} />
          <Typography
            component="span"
            sx={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: { xs: 12, md: 14 },
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {isMobile ? "0% platform fee" : "Your first payment: 0% platform fee"}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: { xs: "none", md: "block" } }}>
          <Typography
            component="span"
            sx={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            We waive our full platform fee — you only pay the network (blockchain) cost.
          </Typography>
        </Box>

        {!isMobile && (
          <Box
            component="button"
            onClick={handleCta}
            sx={{
              background: "#3FD98A",
              color: "#0A0A0A",
              border: "none",
              px: 1.75,
              py: 0.6,
              borderRadius: 999,
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexShrink: 0,
              transition: "transform 120ms ease, filter 120ms ease",
              "&:hover": { transform: "translateY(-1px)", filter: "brightness(1.05)" },
            }}
          >
            Start accepting payments
            <ArrowForwardRounded sx={{ fontSize: 14 }} />
          </Box>
        )}

        <IconButton
          size="small"
          aria-label="Dismiss fee-free banner"
          onClick={handleDismiss}
          sx={{
            color: "rgba(255,255,255,0.7)",
            "&:hover": { color: "#FFFFFF", background: "rgba(255,255,255,0.08)" },
            flexShrink: 0,
          }}
        >
          <CloseRounded sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default FeeFreeBanner;
