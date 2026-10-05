import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { MONO } from "@/styles/uiKit";
import { toFixedStr } from "@/utils/money";
import InfoHint from "@/Components/UI/InfoHint";

export interface ReferralEarningsData {
  summary: { total_earnings: number; pending_earnings: number; credited_earnings: number; withdrawn_earnings: number };
  commission?: { rate_percent: number; window_months: number; total_accrued_usd: number; total_paid_usd: number; unpaid_balance_usd: number; active_windows: number };
}

interface Props {
  earnings: ReferralEarningsData | null;
  stats?: { total_referrals: number; active_referrals: number; pending_referrals: number };
  loading: boolean;
}

const usd = (n: number | undefined) => `$${toFixedStr(n ?? 0, 2)}`;

/** ONE earnings card (was Total earnings tile + Earnings breakdown + Revenue share). */
const ReferralEarningsCard: React.FC<Props> = ({ earnings, stats, loading }) => {
  const theme = useTheme();
  const { t } = useTranslation("referrals");
  const c = earnings?.commission;
  const s = earnings?.summary;
  const rows = [
    { id: "accrued", label: t("earnings.accrued", { defaultValue: "Revenue share earned · all time" }), value: c?.total_accrued_usd ?? 0, always: true },
    { id: "paid", label: t("earnings.paid", { defaultValue: "Paid out or credited" }), value: c?.total_paid_usd ?? 0, always: true },
    { id: "rewards", label: t("earnings.rewardsCredited", { defaultValue: "Sign-up rewards credited" }), value: s?.credited_earnings ?? 0 },
    { id: "pending", label: t("earnings.rewardsPending", { defaultValue: "Sign-up rewards pending" }), value: s?.pending_earnings ?? 0 },
    { id: "withdrawn", label: t("withdrawn"), value: s?.withdrawn_earnings ?? 0 },
  ].filter((r) => r.always || r.value > 0);
  const counts = [
    t("earnings.referralsCount", { count: stats?.total_referrals ?? 0, defaultValue: "{{count}} referrals" }),
    t("earnings.activeCount", { count: stats?.active_referrals ?? 0, defaultValue: "{{count}} active" }),
    t("earnings.pendingCount", { count: stats?.pending_referrals ?? 0, defaultValue: "{{count}} pending" }),
    t("earnings.windowsCount", { count: c?.active_windows ?? 0, defaultValue: "{{count}} earning windows open" }),
  ];

  return (
    <Box data-testid="referral-earnings-card" sx={{ mb: 2.5, p: { xs: 2, md: 3 }, borderRadius: "14px", border: `1px solid ${theme.palette.border.main}`, bgcolor: theme.palette.background.paper }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography component="h2" sx={{ m: 0, fontSize: { xs: 15, md: 16 }, fontWeight: 700, color: theme.palette.text.primary }}>
          {t("earnings.title", { defaultValue: "Earnings" })}
        </Typography>
        <Box sx={{ ml: "auto", px: 1, py: 0.25, borderRadius: 999, bgcolor: theme.palette.action.hover, fontSize: 11, fontFamily: MONO, fontWeight: 600, color: theme.palette.text.secondary }}>
          {`${c?.rate_percent ?? 25}% · ${c?.window_months ?? 12}mo`}
        </Box>
      </Box>
      {loading ? (
        <Skeleton width="100%" height={120} />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 0.8fr) 1.2fr" }, gap: { xs: 2, md: 4 }, alignItems: "start" }}>
          <Box data-testid="referral-revenue-share-card">
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, display: "flex", alignItems: "center" }}>
              {t("availableBalance", { defaultValue: "Available balance" })}
              <InfoHint size={12} testId="referral-available-hint" text={t("earnings.availableHint", { defaultValue: "Revenue share you have earned but not received yet. Paid as fee credit by default — or switch to USDT cash-out below." }) as string} />
            </Typography>
            <Typography data-testid="referral-available-value" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: { xs: 26, md: 30 }, fontWeight: 700, lineHeight: 1.15, color: theme.palette.text.primary }}>
              {usd(c?.unpaid_balance_usd)}
            </Typography>
            <Typography data-testid="referral-counts" sx={{ mt: 1, fontSize: 12.5, color: theme.palette.text.secondary }}>
              {counts.join(" · ")}
            </Typography>
          </Box>
          <Box component="dl" sx={{ m: 0, display: "flex", flexDirection: "column" }}>
            {rows.map((r, i) => (
              <Box key={r.id} data-testid={`referral-earnings-${r.id}`} sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 1, borderTop: i ? `1px solid ${theme.palette.divider}` : "none" }}>
                <Box component="dt" sx={{ fontSize: 13, color: theme.palette.text.secondary }}>{r.label}</Box>
                <Box component="dd" sx={{ m: 0, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>{usd(r.value)}</Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ReferralEarningsCard;
