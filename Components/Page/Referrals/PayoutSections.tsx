import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { toFixedStr } from "@/utils/money";
import { PayoutHistoryItem, PayoutOverview, PillBtn } from "./payoutShared";

interface StatsProps {
  data: PayoutOverview;
  isMobile: boolean;
}

/** Fee-credit stats (credit mode) — available credit + credited-to-date. */
export const PayoutCreditStats: React.FC<StatsProps> = ({ data, isMobile }) => {
  const theme = useTheme();
  const { t } = useTranslation("referrals");
  const labelSx = { fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, textTransform: "uppercase", letterSpacing: "0.5px" } as const;
  const valueSx = { fontSize: "22px", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: theme.palette.text.primary } as const;
  const hintSx = { fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mt: 0.25 } as const;
  const tile = { flex: 1, minWidth: isMobile ? "100%" : 200, p: 1.5, borderRadius: "10px", border: `1px solid ${theme.palette.border.main}` } as const;
  return (
    <Box data-testid="payout-credit-stats" sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
      <Box sx={{ ...tile, bgcolor: `${theme.palette.primary.main}08` }}>
        <Typography sx={labelSx}>{t("payoutAvailableCredit", { defaultValue: "Available fee credit" })}</Typography>
        <Typography data-testid="payout-credit-available" sx={valueSx}>{`$${toFixedStr(data.available_credit_usd ?? 0, 2)}`}</Typography>
        <Typography sx={hintSx}>{t("payoutAvailableCreditDesc", { defaultValue: "Automatically lowers your Dynopay fee on your next payments." })}</Typography>
      </Box>
      <Box sx={{ ...tile, bgcolor: theme.palette.secondary.main }}>
        <Typography sx={labelSx}>{t("payoutCreditedToDate", { defaultValue: "Credited to date" })}</Typography>
        <Typography data-testid="payout-credited-todate" sx={valueSx}>{`$${toFixedStr(data.credited_balance_usd ?? 0, 2)}`}</Typography>
        <Typography sx={hintSx}>{t("payoutCreditedToDateDesc", { defaultValue: "Total fees already covered by your referral rewards." })}</Typography>
      </Box>
    </Box>
  );
};

interface HistoryProps {
  history: PayoutHistoryItem[];
  onDownload: () => void;
  pillBtn: PillBtn;
}

/** Cash-out history list + CSV download. */
export const PayoutHistory: React.FC<HistoryProps> = ({ history, onDownload, pillBtn }) => {
  const theme = useTheme();
  const { t } = useTranslation("referrals");
  if (history.length === 0) return null;
  return (
    <Box data-testid="payout-history" sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${theme.palette.border.main}` }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
        <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary }}>
          {t("payoutHistoryTitle", { defaultValue: "Cash-out history" })}
        </Typography>
        <Box component="button" type="button" data-testid="payout-history-csv-btn" onClick={onDownload} sx={{ ...pillBtn("ghost"), px: 1.5, py: 0.5, fontSize: "12px" }}>
          <Icon name="download" size={14} />
          {t("payoutDownloadCsv", { defaultValue: "Download CSV" })}
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {history.map((h) => {
          const color =
            h.status === "completed" ? theme.palette.success?.main || "#16A34A"
            : h.status === "failed" ? theme.palette.error?.main || "#DC2626"
            : "#F59E0B";
          const when = h.completed_at ? new Date(h.completed_at).toLocaleDateString() : h.requested_at ? new Date(h.requested_at).toLocaleDateString() : "";
          return (
            <Box key={h.payout_id} data-testid={`payout-history-row-${h.payout_id}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1.25, borderRadius: "8px", bgcolor: theme.palette.secondary.main }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "14px", fontFamily: MONO, fontWeight: 700, color: theme.palette.text.primary }}>{`$${toFixedStr(h.amount_usd, 2)}`}</Typography>
                <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                  {when}{" · "}{h.trc20_address_masked}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {h.tx_url && (
                  <a href={h.tx_url} target="_blank" rel="noopener noreferrer" data-testid={`payout-history-tx-${h.payout_id}`} style={{ display: "inline-flex" }}>
                    <Icon name="external-link" size={14} color={theme.palette.text.secondary} />
                  </a>
                )}
                <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", fontWeight: 600, color, textTransform: "capitalize", px: 1, py: 0.25, borderRadius: "6px", bgcolor: `${color}18` }}>
                  {t(`payoutStatus_${h.status}`, { defaultValue: h.status })}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
