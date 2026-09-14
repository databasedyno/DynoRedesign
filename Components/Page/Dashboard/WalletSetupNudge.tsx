import React, { useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import axiosBaseApi from "@/axiosConfig";

/**
 * WalletSetupNudge — a prominent dashboard banner for merchants who have created
 * a brand but have NOT added a payout wallet yet. This is the single biggest
 * activation drop-off (about half of new brands never add a wallet, so they
 * physically cannot get paid). One tap opens AddWalletModal inline — no
 * navigation — and the banner auto-hides the instant a wallet is added.
 *
 * Rendered owners-only in pages/dashboard.tsx (a team member never sees it —
 * the business is already set up).
 */
export default function WalletSetupNudge(): React.ReactElement | null {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const companyState = useCompanyStore();
  const walletState = useWalletStore();
  const [open, setOpen] = useState(false);

  const ready = !companyState.loading && !walletState.loading;
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;

  // Only nudge the exact stuck cohort: a brand exists, but no payout wallet yet.
  // While either store is still loading we render nothing (avoids a flash).
  if (!ready || !hasCompany || hasWallet) return null;

  const accent = "#4338CA";

  // Best-effort onboarding funnel tracking — must never break the dashboard.
  const track = (event_type: string): void => {
    try {
      axiosBaseApi
        .post("track/onboarding", { event_type, step_key: "wallet" })
        .catch(() => {});
    } catch {
      /* noop */
    }
  };

  const handleOpen = (): void => {
    track("step_clicked");
    setOpen(true);
  };

  const handleWalletAdded = (): void => {
    track("step_completed");
    try {
      walletState.refetchWallets?.();
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  return (
    <>
      <Box
        data-testid="wallet-setup-nudge"
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "12px",
          padding: { xs: "16px 18px", md: "18px 22px" },
          marginBottom: { xs: 2, md: 2.5 },
          border: `1px solid ${accent}33`,
          backgroundColor: dark ? `${accent}1f` : `${accent}0d`,
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          gap: { xs: 1.5, md: 2 },
          flexWrap: "wrap",
        }}
      >
        {/* Left accent stripe */}
        <Box
          aria-hidden
          sx={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, backgroundColor: accent }}
        />

        {/* Wallet icon tile */}
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accent,
            color: "#fff",
          }}
        >
          <Icon icon="mdi:wallet-plus-outline" width={22} />
        </Box>

        {/* Copy */}
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: accent,
              mb: 0.4,
            }}
          >
            Almost there
          </Typography>
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
            Add a payout wallet to start getting paid
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
            Payments settle straight to a wallet you control. Add one address now —
            it takes about 30 seconds and unlocks payment links, checkout, and the API.
          </Typography>
        </Box>

        {/* One-tap CTA */}
        <Box
          component="button"
          type="button"
          data-testid="wallet-setup-nudge-cta"
          onClick={handleOpen}
          sx={{
            flexShrink: 0,
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            backgroundColor: accent,
            border: "none",
            padding: "10px 18px",
            borderRadius: "10px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "filter 0.15s ease",
            "&:hover": { filter: "brightness(1.08)" },
          }}
        >
          <Icon icon="mdi:plus" width={18} />
          Add wallet
        </Box>
      </Box>

      <AddWalletModal
        open={open}
        onClose={() => setOpen(false)}
        onWalletAdded={handleWalletAdded}
        companyId={companyState.selectedCompanyId ?? undefined}
      />
    </>
  );
}
