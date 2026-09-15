import React from "react";
import { Box, Skeleton, Switch, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { getAssetColor } from "@/helpers/assetColor";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { StatCard } from "@/Components/Page/Dashboard/v2026/styled";
import { money, relativeTime } from "@/Components/Page/Dashboard/v2026/command/format";
import type { PayoutsData } from "./useDashboardPayouts";
import type { AutoConvertSettings } from "./useAutoConvertSettings";

interface Props {
  data: PayoutsData | null | undefined;
  loading: boolean;
  rangeLabel: string;
  ac: AutoConvertSettings;
}

const ASSET_SHADES = [1, 0.72, 0.5, 0.34, 0.22, 0.14];

/** Row of three money tiles: forwarded in range (by asset), awaiting forward, auto-convert status + toggle. */
const PayoutTiles: React.FC<Props> = ({ data, loading, rangeLabel, ac }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t, i18n } = useTranslation("common");
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const sym = data?.currency_symbol || "$";
  const cur = data?.currency || "USD";
  const totals = data?.totals;
  const assets = data?.by_asset || [];
  const maxAsset = Math.max(1, ...assets.map((a) => a.amount));

  const eyebrowSx = { fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase" as const, color: muted };
  const valueSx = { fontFamily: MONO, fontVariantNumeric: "tabular-nums" as const, fontSize: { xs: 26, md: 30 }, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, color: ink, minHeight: 34 };
  const captionSx = { fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.4 };

  return (
    <Box
      data-testid="payouts-tiles"
      sx={{ display: { xs: "flex", md: "grid" }, gridTemplateColumns: { md: "1.3fr 1fr 1fr" }, gap: { xs: 1.5, md: 2 }, overflowX: { xs: "auto", md: "visible" }, scrollSnapType: { xs: "x mandatory", md: "none" }, pb: { xs: 0.5, md: 0 }, mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 }, "&::-webkit-scrollbar": { display: "none" } }}
    >
      <StatCard data-testid="payouts-tile-forwarded" sx={{ gap: 1.25, flex: { xs: "0 0 82%", md: "unset" }, scrollSnapAlign: "start" }}>
        <Box sx={eyebrowSx}>{t("payouts.tileForwarded", { defaultValue: "Forwarded to your wallets" })} · {rangeLabel}</Box>
        <Box data-testid="payouts-tile-forwarded-value" sx={valueSx}>{loading ? <Skeleton width={160} height={34} /> : money(totals?.forwarded_amount ?? 0, sym, cur)}</Box>
        {loading ? <Skeleton width="70%" height={18} /> : (
          <Box sx={captionSx} data-testid="payouts-tile-forwarded-caption">
            {t("payouts.tileForwardedCaption", { count: totals?.forwarded_count ?? 0, defaultValue: "{{count}} payouts" })}
            {totals?.last_forward_at ? ` · ${t("payouts.lastForward", { when: relativeTime(totals.last_forward_at, t as any, i18n.language), defaultValue: "last {{when}}" })}` : ""}
          </Box>
        )}
        {!loading && assets.length > 0 && (
          <Box data-testid="payouts-tile-assets" sx={{ display: "flex", flexDirection: "column", gap: 0.6, mt: 0.5 }}>
            {assets.slice(0, 6).map((a, i) => (
              <Box key={a.asset} data-testid={`payouts-asset-${a.asset}`} sx={{ display: "grid", gridTemplateColumns: "84px 1fr auto", alignItems: "center", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: getAssetColor(a.asset), opacity: ASSET_SHADES[i] ?? 0.14, flexShrink: 0 }} />
                  <Box sx={{ fontFamily: MONO, fontSize: 11.5, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.asset}</Box>
                </Box>
                <Box sx={{ height: 6, borderRadius: 3, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.06)", overflow: "hidden" }}>
                  <Box sx={{ width: `${Math.max(3, (a.amount / maxAsset) * 100)}%`, height: "100%", borderRadius: 3, backgroundColor: getAssetColor(a.asset), transition: "width 400ms ease" }} />
                </Box>
                <Box sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 11.5, color: muted, whiteSpace: "nowrap" }}>{money(a.amount, sym, cur)}</Box>
              </Box>
            ))}
          </Box>
        )}
        {!loading && assets.length === 0 && <Box sx={captionSx}>{t("payouts.noForwardsRange", { defaultValue: "Nothing forwarded in this range yet." })}</Box>}
      </StatCard>

      <StatCard
        data-testid="payouts-tile-awaiting"
        role="link"
        tabIndex={0}
        onClick={() => router.push("/transactions?status=settled&range=all")}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") router.push("/transactions?status=settled&range=all"); }}
        sx={{ gap: 1.25, cursor: "pointer", flex: { xs: "0 0 82%", md: "unset" }, scrollSnapAlign: "start", "&:focus-visible": { outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`, outlineOffset: 2 } }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={eyebrowSx}>{t("payouts.tileAwaiting", { defaultValue: "Settled, on its way" })}</Box>
          <Icon name="arrow-up-right" size={15} color={muted} />
        </Box>
        <Box data-testid="payouts-tile-awaiting-value" sx={{ ...valueSx, color: (totals?.awaiting_count ?? 0) > 0 ? ink : muted }}>
          {loading ? <Skeleton width={120} height={34} /> : money(totals?.awaiting_amount ?? 0, sym, cur)}
        </Box>
        {loading ? <Skeleton width="80%" height={18} /> : (
          <Box sx={captionSx} data-testid="payouts-tile-awaiting-caption">
            {(totals?.awaiting_count ?? 0) === 0
              ? t("payouts.awaitingNone", { defaultValue: "Everything settled has reached your wallets." })
              : t("payouts.awaitingSome", { count: totals?.awaiting_count ?? 0, defaultValue: "{{count}} payments confirmed, forwarding to your wallet" })}
          </Box>
        )}
      </StatCard>

      <StatCard data-testid="payouts-tile-autoconvert" sx={{ gap: 1.25, flex: { xs: "0 0 82%", md: "unset" }, scrollSnapAlign: "start" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={eyebrowSx}>{t("payouts.autoConvert", { defaultValue: "Auto-convert" })}</Box>
          <Switch
            size="small"
            checked={ac.enabled}
            onChange={ac.handleToggle}
            disabled={ac.toggleDisabled}
            data-testid="payouts-autoconvert-toggle"
            inputProps={{ "aria-label": t("payouts.autoConvert", { defaultValue: "Auto-convert" }) as string }}
            sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: positive }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: positive } }}
          />
        </Box>
        <Box data-testid="payouts-tile-autoconvert-value" sx={{ ...valueSx, fontFamily: "var(--font-sans)", fontSize: { xs: 22, md: 26 }, color: ac.enabled ? positive : ink }}>
          {ac.settlementLoading ? <Skeleton width={90} height={34} /> : ac.enabled ? t("payouts.on", { defaultValue: "On" }) : t("payouts.off", { defaultValue: "Off" })}
        </Box>
        <Box sx={captionSx} data-testid="payouts-tile-autoconvert-caption">
          {ac.settlementLoading
            ? ""
            : ac.enabled
              ? t("payouts.settlingTo", { defaultValue: "Settling to {{target}}", target: ac.settlementTarget })
              : ac.hasStablecoinWallet
                ? t("payouts.autoConvertOffShort", { defaultValue: "Payments settle in the coin received. Turn on to lock into a stablecoin." })
                : t("payouts.addWalletFirst", { defaultValue: "Add a stablecoin settlement wallet first" })}
        </Box>
        <Box
          component="button"
          type="button"
          data-testid="payouts-autoconvert-settings-link"
          onClick={() => document.getElementById("payouts-settlement")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          sx={{ alignSelf: "flex-start", background: "none", border: 0, p: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light }}
        >
          {t("payouts.settlementSettings", { defaultValue: "Settlement coin & wallets ↓" })}
        </Box>
      </StatCard>
    </Box>
  );
};

export default PayoutTiles;
