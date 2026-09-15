import React, { useState } from "react";
import { Box, Button, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { Icon } from "@/styles/uiKit";
import { statusToneColors } from "@/Components/UI/StatusDot";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { money, relativeTime } from "@/Components/Page/Dashboard/v2026/command/format";
import type { PayoutsData } from "./useDashboardPayouts";

interface Props {
  data: PayoutsData;
  onChanged: () => void;
}

type Row = {
  key: string;
  severity: "critical" | "warning" | "info";
  icon: string;
  text: string;
  detail?: string | null;
  primary?: { label: string; onClick: () => void; busy?: boolean; testId: string };
  secondary?: { label: string; href: string; testId: string };
};

/** Pinned list: failed conversions (retry), stuck forwards, conversions still in flight. */
const PayoutAttention: React.FC<Props> = ({ data, onChanged }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation("common");
  const [busyId, setBusyId] = useState<number | null>(null);

  const sym = data.currency_symbol || "$";
  const cur = data.currency || "USD";
  const a = data.attention;

  const retry = async (conversionId: number) => {
    setBusyId(conversionId);
    try {
      await axiosBaseApi.post(`/company/conversion/${conversionId}/retry`, {});
      dispatch({ type: TOAST_SHOW, payload: { severity: "success", message: t("payouts.retryStarted", { defaultValue: "Retry started — the conversion re-entered the pipeline." }) } });
      onChanged();
    } catch (e: any) {
      dispatch({ type: TOAST_SHOW, payload: { severity: "error", message: e?.response?.data?.message || t("payouts.retryFailed", { defaultValue: "Couldn't retry this conversion." }) } });
    } finally {
      setBusyId(null);
    }
  };

  const rows: Row[] = [
    ...a.failed_conversions.map<Row>((c) => ({
      key: `conv-${c.conversion_id}`,
      severity: "critical",
      icon: "triangle-alert",
      text: t("payouts.attnFailedConversion", {
        amount: `${c.source_amount} ${c.source_currency}`,
        fiat: money(c.amount, sym, cur),
        target: c.target_currency,
        defaultValue: "{{amount}} (≈ {{fiat}}) could not be converted to {{target}}",
      }),
      detail: c.error_message,
      primary: { label: t("payouts.retry", { defaultValue: "Retry" }), onClick: () => retry(c.conversion_id), busy: busyId === c.conversion_id, testId: `payouts-retry-conversion-${c.conversion_id}` },
      secondary: { label: t("payouts.contactSupport", { defaultValue: "Contact support" }), href: `/help-support?topic=payout&ref=${c.transaction_id}`, testId: `payouts-support-conversion-${c.conversion_id}` },
    })),
    ...a.stuck_forwards.map<Row>((s) => ({
      key: `stuck-${s.id}`,
      severity: "warning",
      icon: "timer",
      text: t("payouts.attnStuck", {
        amount: `${s.crypto_amount} ${s.asset}`,
        fiat: money(s.amount, sym, cur),
        when: relativeTime(s.settled_at, t as any, i18n.language),
        defaultValue: "{{amount}} (≈ {{fiat}}) settled {{when}} but has not reached your wallet yet",
      }),
      primary: { label: t("payouts.viewPayment", { defaultValue: "View payment" }), onClick: () => router.push(`/transactions?search=${s.transaction_id}&range=all`), testId: `payouts-stuck-view-${s.transaction_id}` },
      secondary: { label: t("payouts.contactSupport", { defaultValue: "Contact support" }), href: `/help-support?topic=payout&ref=${s.transaction_id}`, testId: `payouts-stuck-support-${s.transaction_id}` },
    })),
    ...a.in_progress_conversions.map<Row>((c) => ({
      key: `prog-${c.conversion_id}`,
      severity: "info",
      icon: "refresh-cw",
      text: t("payouts.attnInProgress", {
        amount: `${c.source_amount} ${c.source_currency}`,
        target: c.target_currency,
        status: c.status.toLowerCase().replace(/_/g, " "),
        defaultValue: "{{amount}} is converting to {{target}} · {{status}}",
      }),
    })),
  ];

  if (rows.length === 0) return null;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const hairline = isDark ? "rgba(255,255,255,0.06)" : "#EEF1F6";
  const toneOf = (s: Row["severity"]) => statusToneColors(s === "critical" ? "failed" : s === "warning" ? "pending" : "neutral", isDark);

  return (
    <SurfaceCard data-testid="payouts-attention" data-count={rows.length} sx={{ p: 0, overflow: "hidden" }}>
      <Box sx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 1.75, md: 2 }, pb: 1 }}>
        <Eyebrow>
          {t("payouts.needsAttention", { defaultValue: "Needs attention" })}
          <Box component="span" sx={{ ml: 1, fontFamily: "var(--font-sans)", fontWeight: 700, color: ink }}>{rows.length}</Box>
        </Eyebrow>
      </Box>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {rows.map((row, i) => {
          const tone = toneOf(row.severity);
          return (
            <Box
              component="li"
              key={row.key}
              data-testid="payouts-attention-item"
              data-severity={row.severity}
              sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, md: 1.75 }, px: { xs: 2, md: 2.5 }, py: 1.4, borderTop: i === 0 ? "none" : `1px solid ${hairline}`, position: "relative", flexWrap: { xs: "wrap", sm: "nowrap" },
                "&::before": { content: '""', position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: "0 3px 3px 0", backgroundColor: row.severity === "info" ? "transparent" : tone.dot } }}
            >
              <Box aria-hidden sx={{ width: 34, height: 34, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: row.severity === "info" ? muted : tone.fg, backgroundColor: row.severity === "info" ? (isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)") : `${tone.dot}1F` }}>
                <Icon name={row.icon} size={17} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Box data-testid="payouts-attention-text" sx={{ fontFamily: "var(--font-sans)", fontSize: { xs: 13.5, md: 14 }, lineHeight: 1.4, color: ink }}>{row.text}</Box>
                {row.detail && <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 12, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 560 }}>{row.detail}</Box>}
              </Box>
              {(row.primary || row.secondary) && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0, ml: { xs: "46px", sm: 0 } }}>
                  {row.secondary && (
                    <Button size="small" variant="text" data-testid={row.secondary.testId} onClick={() => router.push(row.secondary!.href)} sx={{ textTransform: "none", fontFamily: "var(--font-sans)", fontWeight: 600, color: muted }}>
                      {row.secondary.label}
                    </Button>
                  )}
                  {row.primary && (
                    <Button size="small" variant="outlined" data-testid={row.primary.testId} disabled={row.primary.busy} onClick={row.primary.onClick} sx={{ textTransform: "none", fontFamily: "var(--font-sans)", fontWeight: 600, borderRadius: 999, whiteSpace: "nowrap" }}>
                      {row.primary.busy ? t("payouts.retrying", { defaultValue: "Retrying…" }) : row.primary.label}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </SurfaceCard>
  );
};

export default PayoutAttention;
