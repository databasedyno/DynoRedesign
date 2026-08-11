import React, { useMemo } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useWalletData } from "@/hooks/useWalletData";
import { formatNumberWithComma } from "@/helpers";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../coinbase/styled";
import { MONO } from "@/styles/uiKit";
import { getAssetColor } from "@/helpers/assetColor";

/**
 * AssetsCard — ranks assets by settled volume FOR THE SELECTED TIME WINDOW
 * (fed by the dashboard chart's currency_breakdown), so the whole dashboard
 * reflects one selected period. Wallet metadata (icon + friendly name) is
 * looked up from useWalletData; a text avatar is shown if no icon matches.
 */
interface AssetRow {
  currency: string;
  count: number;
  volume: number;
}
interface AssetsCardProps {
  assets?: AssetRow[];
  rangeLabel?: string;
  currencySymbol?: string;
  loading?: boolean;
}

const AssetsCard: React.FC<AssetsCardProps> = ({
  assets,
  rangeLabel,
  currencySymbol = "$",
  loading = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { walletData } = useWalletData();

  // currency code -> { name, icon } lookup (tolerant: "USDT_TRC20" ~ "USDT-TRC20").
  const walletLookup = useMemo(() => {
    const map = new Map<string, { name: string; icon: any }>();
    for (const w of walletData || []) {
      const key = String(w.walletTitle || "").toUpperCase().replace(/_/g, "-");
      map.set(key, { name: w.name, icon: w.icon });
    }
    return map;
  }, [walletData]);

  // Range-driven asset volumes (from the dashboard chart's currency_breakdown).
  const rows = useMemo(() => {
    const resolve = (currency: string) => {
      const norm = String(currency || "").toUpperCase().replace(/_/g, "-");
      return (
        walletLookup.get(norm) ||
        walletLookup.get(norm.split("-")[0]) ||
        { name: currency, icon: null }
      );
    };
    return [...(assets || [])]
      .map((a) => {
        const meta = resolve(a.currency);
        return {
          code: a.currency,
          name: meta.name || a.currency,
          icon: meta.icon,
          total: Number(a.volume) || 0,
          count: Number(a.count) || 0,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [assets, walletLookup]);

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
        <Eyebrow>
          {t("assetsByVolume", { defaultValue: "Assets by volume" })}
          {rangeLabel ? ` · ${rangeLabel}` : ""}
        </Eyebrow>
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

      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                <Skeleton width={120} height={20} />
                <Skeleton width={70} height={20} />
              </Box>
              <Skeleton variant="rounded" width="100%" height={6} />
            </Box>
          ))}
        </Box>
      ) : rows.length === 0 ? (
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
          {t("noVolumeInPeriod", {
            defaultValue: "No settled volume in this period yet.",
          })}
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {rows.map((r) => {
            const pct = hasVolume ? Math.round((r.total / maxTotal) * 100) : 0;
            const color = getAssetColor(r.code);
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
                        backgroundColor: `${color}22`,
                        border: `1px solid ${color}33`,
                        flexShrink: 0,
                      }}
                    >
                      {r.icon ? (
                        <Image
                          src={r.icon}
                          alt={r.code}
                          width={18}
                          height={18}
                          draggable={false}
                        />
                      ) : (
                        <Box
                          component="span"
                          sx={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 10,
                            fontWeight: 700,
                            color,
                          }}
                        >
                          {String(r.code || "?").slice(0, 3).toUpperCase()}
                        </Box>
                      )}
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
                    {currencySymbol}{formatNumberWithComma(r.total)}
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
                      background: `linear-gradient(90deg, ${color}, ${color}B3)`,
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
