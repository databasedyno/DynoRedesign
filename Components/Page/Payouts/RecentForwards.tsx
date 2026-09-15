import React, { useState } from "react";
import { Box, Button, CircularProgress, Skeleton, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { Icon, MONO } from "@/styles/uiKit";
import { getAssetColor } from "@/helpers/assetColor";
import { explorerTxUrl, shortHash } from "@/helpers/explorerUrl";
import { formatDisplayAmount } from "@/utils/currencyFormat";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { money, relativeTime } from "@/Components/Page/Dashboard/v2026/command/format";
import type { PayoutsData } from "./useDashboardPayouts";

interface Props {
  data: PayoutsData | null | undefined;
  loading: boolean;
  companyId: number | null;
}

/** Latest forwards with tx hashes + CSV export of settled payments for the selected range. */
const RecentForwards: React.FC<Props> = ({ data, loading, companyId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation("common");
  const [exporting, setExporting] = useState(false);
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const hairline = isDark ? "rgba(255,255,255,0.06)" : "#EEF1F6";
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const sym = data?.currency_symbol || "$";
  const cur = data?.currency || "USD";
  const rows = data?.recent || [];

  const exportCsv = async () => {
    if (!companyId || !data || exporting) return;
    setExporting(true);
    try {
      const res = await axiosBaseApi.post(
        "/wallet/transactions/export",
        { date_from: data.range.start, date_to: data.range.end, company_id: String(companyId), settled_only: true },
        { responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `payouts_${data.range.start.slice(0, 10)}_${data.range.end.slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      dispatch({ type: TOAST_SHOW, payload: { severity: "success", message: t("payouts.exported", { defaultValue: "Payout history exported" }) } });
    } catch {
      dispatch({ type: TOAST_SHOW, payload: { severity: "error", message: t("payouts.exportFailed", { defaultValue: "Export failed. Please try again." }) } });
    } finally {
      setExporting(false);
    }
  };

  return (
    <SurfaceCard data-testid="payouts-recent" sx={{ p: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, md: 2.5 }, pt: { xs: 1.75, md: 2 }, pb: 1, gap: 1 }}>
        <Eyebrow>{t("payouts.recentForwards", { defaultValue: "Latest payouts" })}</Eyebrow>
        <Button
          size="small"
          variant="text"
          disabled={exporting || !companyId || !data}
          onClick={exportCsv}
          data-testid="payouts-export-csv-btn"
          startIcon={exporting ? <CircularProgress size={12} color="inherit" /> : <Icon name="download" size={14} />}
          sx={{ textTransform: "none", fontFamily: "var(--font-sans)", fontWeight: 600, color: muted }}
        >
          {t("payouts.exportRange", { defaultValue: "Export range (CSV)" })}
        </Button>
      </Box>
      {loading && rows.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} />)}</Box>
      ) : rows.length === 0 ? (
        <Box data-testid="payouts-recent-empty" sx={{ px: 2.5, pb: 2.5, fontFamily: "var(--font-sans)", fontSize: 13.5, color: muted }}>
          {t("payouts.noForwardsYet", { defaultValue: "No payouts yet. Once a payment settles, the forward to your wallet shows up here with its transaction hash." })}
        </Box>
      ) : (
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {rows.map((r, i) => {
            const explorer = r.tx_hash ? explorerTxUrl(r.converted && r.target_currency ? r.target_currency : r.asset, r.tx_hash) : null;
            return (
              <Box
                component="li"
                key={`${r.id}-${i}`}
                data-testid="payouts-recent-row"
                sx={{ display: "grid", gridTemplateColumns: { xs: "10px 1fr auto", sm: "10px 1.1fr 1fr auto" }, alignItems: "center", gap: 1.5, px: { xs: 2, md: 2.5 }, py: 1.2, borderTop: i === 0 ? "none" : `1px solid ${hairline}` }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: getAssetColor(r.asset) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
                    <Box data-testid="payouts-recent-amount" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 600, color: ink, whiteSpace: "nowrap" }}>
                      {formatDisplayAmount(r.crypto_amount, r.asset)} {r.asset}
                    </Box>
                    <Box sx={{ fontFamily: MONO, fontSize: 12, color: muted }}>≈ {money(r.amount, sym, cur)}</Box>
                    {r.converted && (
                      <Box data-testid="payouts-recent-converted" sx={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: positive, backgroundColor: isDark ? CB_TOKENS.semantic.positive.glowDark : CB_TOKENS.semantic.positive.glowLight, px: 0.75, py: 0.15, borderRadius: 999 }}>
                        → {r.target_amount != null ? `${formatDisplayAmount(r.target_amount, r.target_currency || "")} ` : ""}{r.target_currency}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: muted }}>
                    {relativeTime(r.forwarded_at, t as any, i18n.language)} · {t("payouts.toWallet", { wallet: r.wallet_address_masked || r.wallet_type, defaultValue: "to {{wallet}}" })}
                  </Box>
                </Box>
                <Box sx={{ display: { xs: "none", sm: "block" }, fontFamily: MONO, fontSize: 12, color: muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-testid="payouts-recent-hash">
                  {r.tx_hash ? shortHash(r.tx_hash, 10, 8) : "—"}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  {explorer ? (
                    <Box component="a" href={explorer} target="_blank" rel="noopener noreferrer" data-testid="payouts-recent-explorer" aria-label={t("payouts.viewOnExplorer", { defaultValue: "View on explorer" }) as string} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: muted, textDecoration: "none", "&:hover": { color: ink } }}>
                      <Icon name="external-link" size={14} />
                    </Box>
                  ) : (
                    <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: muted }}>{t("payouts.hashPending", { defaultValue: "hash pending" })}</Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </SurfaceCard>
  );
};

export default RecentForwards;
