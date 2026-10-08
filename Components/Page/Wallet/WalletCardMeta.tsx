import React from "react";
import { Box, Skeleton, Tooltip, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { money, relativeTime } from "@/Components/Page/Dashboard/v2026/command/format";
import { explorerTxUrl } from "@/helpers/explorerUrl";
import { addressFormatStatus } from "@/helpers/addressFormat";
import type { PayoutWallet } from "@/Components/Page/Payouts/useDashboardPayouts";

/** Tiny chip next to the address: does it look like a <chain> address? (client-side shape check only). */
export const AddressFormatBadge: React.FC<{ chain: string; address: string; testId: string; compact?: boolean }> = ({ chain, address, testId, compact = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("walletScreen");
  const status = addressFormatStatus(chain, address);
  if (status === "unknown") return null;
  const ok = status === "ok";
  const tone = ok
    ? (isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light)
    : (isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light);
  const glow = ok
    ? (isDark ? CB_TOKENS.semantic.positive.glowDark : CB_TOKENS.semantic.positive.glowLight)
    : (isDark ? CB_TOKENS.semantic.warning.glowDark : CB_TOKENS.semantic.warning.glowLight);
  return (
    <Tooltip
      arrow
      placement="top"
      title={ok
        ? t("formatOkTip", { defaultValue: "This address matches the usual {{chain}} format.", chain })
        : t("formatUnusualTip", { defaultValue: "This doesn't look like a typical {{chain}} address. Double-check it before your next payout.", chain })}
    >
      <Box
        component="span"
        data-testid={testId}
        data-format={status}
        aria-label={(ok ? t("formatOk", { defaultValue: "Format OK" }) : t("formatUnusual", { defaultValue: "Unusual format" })) as string}
        sx={compact && ok
          ? { display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 600, color: tone, whiteSpace: "nowrap" }
          : { ml: compact ? 0 : "auto", display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.25, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: tone, backgroundColor: glow, whiteSpace: "nowrap" }}
      >
        <Icon name={ok ? "circle-check" : "triangle-alert"} size={compact && ok ? 13 : 11} />
        {compact && ok ? null : ok ? t("formatOk", { defaultValue: "Format OK" }) : t("formatUnusual", { defaultValue: "Unusual format" })}
      </Box>
    </Tooltip>
  );
};

interface ForwardProps {
  wallet: PayoutWallet | undefined;
  loading: boolean;
  symbol: string;
  currency: string;
  testId: string;
  stacked?: boolean;
}

/** "Last payout · 3 h ago · $120 in 30d ↗" line on each wallet card. */
export const LastForwardRow: React.FC<ForwardProps> = ({ wallet, loading, symbol, currency, testId, stacked = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation(["walletScreen", "common"]);
  const muted = theme.palette.text.secondary;
  const ink = theme.palette.text.primary;
  if (loading && !wallet) return <Skeleton width="60%" height={16} data-testid={`${testId}-loading`} />;
  const idle = !wallet?.last_forward_at;
  const explorer = !idle && wallet!.last_tx_hash ? (
    <Box
      component="a"
      href={explorerTxUrl(wallet!.wallet_type, wallet!.last_tx_hash)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`${testId}-explorer`}
      data-hit-area=""
      aria-label={t("common:payouts.viewOnExplorer", { defaultValue: "View on explorer" }) as string}
      sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, m: "-8px", verticalAlign: "middle", borderRadius: "8px", color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light, "&:hover": { textDecoration: "underline" } }}
    >
      <Icon name="external-link" size={12} />
    </Box>
  ) : null;
  const when = idle ? "" : t("walletScreen:lastPayoutAt", { when: relativeTime(wallet!.last_forward_at, ((k: string, o?: Record<string, unknown>) => t(`common:${k}`, o)) as any, i18n.language), defaultValue: "Last payout {{when}}" });
  const amount = !idle && wallet!.forwarded_count > 0 ? (
    <Box component="span" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: ink }}>
      {stacked ? "" : "· "}{money(wallet!.forwarded_amount, symbol, currency)} <Box component="span" sx={{ fontFamily: "var(--font-sans)", color: muted }}>{t("walletScreen:in30d", { defaultValue: "in 30d" })}</Box>
    </Box>
  ) : null;
  return (
    <Box data-testid={testId} data-idle={idle ? "1" : "0"} sx={{ display: "flex", alignItems: stacked ? "flex-start" : "center", gap: 0.75, minWidth: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted, lineHeight: 1.3 }}>
      <Icon name="arrow-up-right" size={13} style={{ flexShrink: 0, marginTop: stacked ? 2 : 0, color: idle ? muted : (isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light) }} />
      {idle ? (
        <Box component="span">{t("walletScreen:lastPayoutNone", { defaultValue: "No payouts to this address yet" })}</Box>
      ) : stacked ? (
        <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>{when}{explorer}</Box>
          {amount}
        </Box>
      ) : (
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flexWrap: "wrap" }}>
          <Box component="span">{when}</Box>
          {amount}
          {explorer}
        </Box>
      )}
    </Box>
  );
};
