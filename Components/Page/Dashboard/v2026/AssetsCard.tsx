import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useWalletData } from "@/hooks/useWalletData";
import { formatNumberWithComma } from "@/helpers";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../coinbase/styled";
import { MONO } from "@/styles/uiKit";

/**
 * AssetsCard — ranks the merchant's wallets by settled USD volume so they
 * can see, at a glance, which assets are driving revenue. Real data only
 * (walletData.totalProcessed = amount_in_usd); shows a proportional share
 * bar per asset and a truthful empty state when nothing has settled yet.
 */
const AssetsCard: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { walletData } = useWalletData();

  const rows = useMemo(() => {
    const sorted = [...(walletData || [])]
      .map((w) => ({
        code: w.walletTitle,
        name: w.name,
        icon: w.icon,
        total: Number(w.totalProcessed) || 0,
      }))
      .sort((a, b) => b.total - a.total);
    const withVolume = sorted.filter((w) => w.total > 0);
    // If nobody has settled volume yet, still show top configured wallets
    return (withVolume.length > 0 ? withVolume : sorted).slice(0, 6);
  }, [walletData]);

  const maxTotal = useMemo(
    () => Math.max(1, ...rows.map((r) => r.total)),
    [rows],
  );
  const hasVolume = rows.some((r) => r.total > 0);

  return (
    <SurfaceCard data-testid="dash2026-assets" sx={{ p: { xs: 2.25, md: 3 } }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Eyebrow>{t("assetsByVolume", { defaultValue: "Assets by volume" })}</Eyebrow>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => router.push("/wallet")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") router.push("/wallet");
          }}
          data-testid="dash2026-assets-manage"
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {t("manageWallets", { defaultValue: "Manage" })} →
        </Box>
      </Box>

      {rows.length === 0 ? (
        <Box
          data-testid="dash2026-assets-empty"
          sx={{
            py: 3,
            textAlign: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
          }}
        >
          {t("noWalletsYet", {
            defaultValue: "Add a wallet to start accepting crypto.",
          })}
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {rows.map((r) => {
            const pct = hasVolume ? Math.round((r.total / maxTotal) * 100) : 0;
            return (
              <Box key={r.code} data-testid={`dash2026-asset-${r.code}`}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    mb: 0.75,
                  }}
                >
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(10,10,15,0.04)",
                        flexShrink: 0,
                      }}
                    >
                      <Image
                        src={r.icon}
                        alt={r.code}
                        width={18}
                        height={18}
                        draggable={false}
                      />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 14,
                          fontWeight: 600,
                          color: isDark
                            ? CB_TOKENS.ink.primaryDark
                            : CB_TOKENS.ink.primaryLight,
                          lineHeight: 1.2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.name || r.code}
                      </Box>
                      <Box
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 11,
                          color: isDark
                            ? CB_TOKENS.ink.mutedDark
                            : CB_TOKENS.ink.mutedLight,
                        }}
                      >
                        {r.code}
                      </Box>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      fontFamily: MONO,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: 14,
                      fontWeight: 700,
                      color: isDark
                        ? CB_TOKENS.ink.primaryDark
                        : CB_TOKENS.ink.primaryLight,
                      flexShrink: 0,
                    }}
                  >
                    ${formatNumberWithComma(r.total)}
                  </Box>
                </Box>
                <Box
                  sx={{
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(10,10,15,0.05)",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 999,
                      background: isDark
                        ? CB_TOKENS.indigo.dark
                        : CB_TOKENS.indigo.light,
                      transition: "width 500ms ease",
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </SurfaceCard>
  );
};

export default AssetsCard;
