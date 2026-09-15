import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { ALLCRYPTOCURRENCIES } from "@/hooks/useWalletData";
import { getAssetColor } from "@/helpers/assetColor";

interface Props {
  missing: string[];
  onAdd: (crypto: string) => void;
}

/** Coins your live payment links accept but that have no payout wallet — listed first because those payments can't land. */
const CoverageStrip: React.FC<Props> = ({ missing, onAdd }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("walletScreen");
  if (missing.length === 0) return null;
  const warn = isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light;
  const known = missing.filter((c) => ALLCRYPTOCURRENCIES.some((a) => a.code === c));
  const unknown = missing.filter((c) => !ALLCRYPTOCURRENCIES.some((a) => a.code === c));

  return (
    <Box
      role="alert"
      data-testid="wallet-coverage-strip"
      data-count={missing.length}
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: { xs: "flex-start", md: "center" },
        gap: { xs: 1.25, md: 2 },
        p: { xs: 1.75, md: 2 },
        borderRadius: "14px",
        border: `1px solid ${isDark ? "rgba(251,191,36,0.35)" : "rgba(180,83,9,0.28)"}`,
        backgroundColor: isDark ? CB_TOKENS.semantic.warning.glowDark : CB_TOKENS.semantic.warning.glowLight,
      }}
    >
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
        <Icon name="triangle-alert" size={20} style={{ color: warn, flexShrink: 0, marginTop: 2 }} />
        <Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 700, color: theme.palette.text.primary }}>
            {t("coverageTitle", { count: missing.length, defaultValue: "{{count}} accepted coins have no payout wallet" })}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: theme.palette.text.secondary, mt: 0.25 }}>
            {t("coverageBody", { defaultValue: "Your live payment links accept these coins, but payments in them have nowhere to land. Add a wallet to start receiving them." })}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, flexShrink: 0 }}>
        {(known ?? []).map((code) => {
          const meta = (ALLCRYPTOCURRENCIES ?? []).find((a) => a.code === code);
          const accent = getAssetColor(code);
          return (
            <Box
              key={code}
              component="button"
              type="button"
              data-testid={`wallet-coverage-add-${code}`}
              onClick={() => onAdd(code)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.25,
                py: 0.6,
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 600,
                color: theme.palette.text.primary,
                border: `1px solid ${accent}55`,
                backgroundColor: isDark ? CB_TOKENS.surface.dark : "#FFFFFF",
                transition: "transform 140ms ease, box-shadow 140ms ease",
                "&:hover": { transform: "translateY(-1px)", boxShadow: `0 4px 14px ${accent}33` },
              }}
            >
              {meta?.icon && <Image src={meta.icon} alt={code} width={16} height={16} draggable={false} />}
              {code}
              <Icon name="plus" size={14} style={{ color: theme.palette.text.secondary }} />
            </Box>
          );
        })}
        {unknown.length > 0 && (
          <Typography data-testid="wallet-coverage-unknown" sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.secondary, alignSelf: "center" }}>
            {unknown.join(", ")}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default CoverageStrip;
