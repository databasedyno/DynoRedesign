import React from "react";
import { Box, Tooltip, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CoinChips from "@/Components/UI/CoinChips";
import { useWalletData } from "@/hooks/useWalletData";

const splitCoins = (value?: string | string[] | null): string[] =>
  (Array.isArray(value) ? value.join(",") : String(value || ""))
    .split(/[,\s/|]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

interface Props {
  /** Link's accepted coins — empty/null means "every configured coin". */
  value?: string | string[] | null;
  max?: number;
  size?: "sm" | "xs";
}

/** "Accepts all N coins" when a link takes every configured coin, otherwise the usual chips. */
export const LinkCoinsBadge: React.FC<Props> = ({ value, max = 4, size = "sm" }) => {
  const theme = useTheme();
  const { t } = useTranslation("paymentLinks");
  const { walletData } = useWalletData();
  const configured = Array.from(new Set(walletData.map((w) => String(w.walletTitle).trim().toUpperCase()).filter(Boolean)));
  const linkCoins = splitCoins(value);
  const acceptsAll =
    configured.length > 0 && (linkCoins.length === 0 || (linkCoins.length === configured.length && configured.every((c) => linkCoins.includes(c))));

  if (!acceptsAll) {
    if (linkCoins.length === 0) return null;
    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <CoinChips value={linkCoins} max={max} size={size} />
        {configured.length > linkCoins.length && (
          <Box component="span" data-testid="paylink-coins-partial" sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: theme.palette.text.secondary }}>
            {t("coins.acceptsSome", { defaultValue: "Accepts {{count}} of {{total}} coins", count: linkCoins.length, total: configured.length })}
          </Box>
        )}
      </Box>
    );
  }

  const isDark = theme.palette.mode === "dark";
  return (
    <Tooltip title={t("coins.acceptsAllHint", { defaultValue: "Buyers can pay with any coin you have a payout wallet for: {{list}}", list: configured.join(", ") })} arrow>
      <Box
        component="span"
        data-testid="paylink-coins-all"
        data-count={configured.length}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.1,
          py: 0.3,
          borderRadius: 999,
          fontFamily: "var(--font-sans)",
          fontSize: size === "xs" ? 11 : 12,
          fontWeight: 700,
          letterSpacing: "0.01em",
          color: isDark ? "#A7F3D0" : "#047857",
          backgroundColor: isDark ? "rgba(16,185,129,0.14)" : "rgba(16,185,129,0.10)",
          border: `1px solid ${isDark ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.25)"}`,
          cursor: "default",
          whiteSpace: "nowrap",
        }}
      >
        {t("coins.acceptsAll", { defaultValue: "Accepts all {{count}} coins", count: configured.length })}
      </Box>
    </Tooltip>
  );
};

export default LinkCoinsBadge;
