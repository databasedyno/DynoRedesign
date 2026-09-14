import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useWalletData } from "@/hooks/useWalletData";
import useAccountProfile from "@/hooks/useAccountProfile";
import { CB_TOKENS } from "@/Components/UI/_shared";
import { MONO } from "@/styles/uiKit";
import { rootReducer } from "@/utils/types";

/** Minimal symbol map — matches the currencies the wallet totals actually
 *  ship in today. Falls back to the ISO code when unmapped, which is the
 *  safest default for anything else. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", NGN: "₦", GHS: "₵", RWF: "₣",
  KES: "KES ", UGX: "UGX ", INR: "₹", ZAR: "R", AUD: "A$", CAD: "C$", BRL: "R$",
};

/**
 * WalletTotalHero — aurora "big number" hero for /wallet.
 *
 * Shipped as part of the 2026-08-05 design audit Phase 3 (in-app polish).
 * Answers the first question a merchant has when they land on /wallet:
 * "how much did I make across ALL my chains?" — that number wasn't
 * visible anywhere on the wallet page before. The dashboard has a
 * VolumeHero for the same purpose; this brings the same treatment here.
 *
 * Layout:
 *   • Left: mono eyebrow "TOTAL PROCESSED · ALL CHAINS", then a very
 *     large aurora-inked number ($X,XXX.XX in the user's base currency).
 *   • Right: three compact stat pills — active chains count, wallets
 *     configured, chain coverage as a percentage. Feed off the existing
 *     `useWalletData()` hook so no new API traffic.
 *   • Bottom hairline separator; flat surface (no glow orb — the decorative
 *     blob used to overflow the viewport at 1920px, UX plan 3.3).
 *
 * Numbers are pre-computed on the frontend from `walletData.totalProcessed`
 * (already in USD via the backend's currency conversion), so this
 * component is zero-network — safe to render immediately on page load.
 */
export default function WalletTotalHero() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation(["walletScreen", "common"]);
  const { walletData, allCryptocurrencies } = useWalletData();
  const { account, isIndividual } = useAccountProfile();
  const profile = useSelector((s: rootReducer) => (s as any).userReducer?.profile);
  const currencyCode = profile?.display_currency || profile?.base_currency || "USD";
  const currencySymbol = useMemo(
    () => CURRENCY_SYMBOLS[String(currencyCode).toUpperCase()] || "$",
    [currencyCode]
  );

  const stats = useMemo(() => {
    const totalUsd = walletData.reduce((sum, w) => sum + (Number(w.totalProcessed) || 0), 0);
    const activeWallets = walletData.filter((w) => Boolean(w.walletAddress)).length;
    const coverage = allCryptocurrencies.length > 0
      ? Math.round((activeWallets / allCryptocurrencies.length) * 100)
      : 0;
    return { totalUsd, activeWallets, coverage, totalChains: allCryptocurrencies.length };
  }, [walletData, allCryptocurrencies]);

  const formatted = useMemo(() => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(stats.totalUsd);
  }, [stats.totalUsd]);

  return (
    <Box
      data-testid="wallet-total-hero"
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "20px",
        padding: { xs: "20px", md: "28px 32px" },
        marginBottom: { xs: 2.5, md: 3 },
        border: `1px solid ${dark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
        background: dark
          ? CB_TOKENS.surface.dark
          : CB_TOKENS.surface.light,
        boxShadow: dark
          ? "0 1px 0 rgba(255,255,255,0.02) inset"
          : "0 1px 3px rgba(10,10,15,0.04)",
      }}
    >
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "flex-end" },
          justifyContent: "space-between",
          gap: { xs: 2.5, md: 3 },
        }}
      >
        {/* Big number */}
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
              mb: { xs: 1, md: 1.25 },
            }}
          >
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: theme.palette.text.secondary,
              }}
            >
              {t("totalProcessedEyebrow", {
                defaultValue: "Total processed · all chains",
                ns: "walletScreen",
              })}
            </Typography>
            {/* Wallets are scoped to the active Account — say so, otherwise a
                merchant with both an individual and a business account cannot
                tell which set of wallets they are looking at. */}
            {account?.company_name && (
              <Box
                data-testid="wallet-account-scope"
                sx={{
                  px: 1,
                  py: "2px",
                  borderRadius: 999,
                  fontFamily: "var(--font-sans)",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: theme.palette.text.secondary,
                  border: `1px solid ${dark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
                }}
              >
                {account.company_name} ·{" "}
                {isIndividual
                  ? t("accountTypeIndividual", { defaultValue: "Individual", ns: "common" })
                  : t("accountTypeBusiness", { defaultValue: "Business", ns: "common" })}
              </Box>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, flexWrap: "wrap" }}>
            <Typography
              component="span"
              sx={{
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                fontSize: { xs: 34, md: 56 },
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: theme.palette.text.primary,
              }}
            >
              {currencySymbol}{formatted}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontFamily: MONO,
                fontSize: { xs: 12, md: 14 },
                fontWeight: 500,
                color: theme.palette.text.secondary,
                letterSpacing: "0.06em",
                ml: 1,
              }}
            >
              {currencyCode}
            </Typography>
          </Box>
        </Box>

        {/* Stat pills */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: { xs: 1, md: 1.5 },
            width: { xs: "100%", md: "auto" },
            minWidth: { md: 360 },
          }}
        >
          <StatChip
            icon="mdi:link-variant"
            label={t("activeChains", { defaultValue: "Active chains", ns: "walletScreen" })}
            value={stats.activeWallets.toString()}
          />
          <StatChip
            icon="mdi:database-outline"
            label={t("supported", { defaultValue: "Supported", ns: "walletScreen" })}
            value={stats.totalChains.toString()}
          />
          <StatChip
            icon="mdi:chart-donut"
            label={t("coverage", { defaultValue: "Coverage", ns: "walletScreen" })}
            value={`${stats.coverage}%`}
          />
        </Box>
      </Box>
    </Box>
  );
}

function StatChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        padding: "10px 12px",
        borderRadius: "12px",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.08)"}`,
        backgroundColor: dark ? "rgba(255,255,255,0.02)" : "rgba(10,10,15,0.02)",
        minWidth: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Icon icon={icon} width={13} color={theme.palette.text.secondary} />
        <Typography
          sx={{
            fontFamily: "var(--font-tech), ui-monospace, monospace",
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontFamily: MONO,
          fontVariantNumeric: "tabular-nums",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          color: theme.palette.text.primary,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
