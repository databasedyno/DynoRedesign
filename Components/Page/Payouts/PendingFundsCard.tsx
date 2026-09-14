import React, { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Box, Chip, Divider, Stack, Typography, useTheme } from "@mui/material";
import HourglassTopRounded from "@mui/icons-material/HourglassTopRounded";
import useApiSWR from "@/hooks/useApiSWR";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { WARNING_AMBER } from "@/constants/theme";
import { CardSx, amountLabel, coinOf, coinTransactionsHref, fiatLabel, fmtUsd, minutesLeftToConfirm, payerLabel } from "./payoutsHelpers";

interface Props {
  companyId: number | null;
  cardSx: CardSx;
  sym: string;
  onSettled?: () => void;
}

/** Pending funds — awaiting on-chain confirmation (GET /dashboard/pending-summary, 30 s refresh). */
const PendingFundsCard: React.FC<Props> = ({ companyId, cardSx, sym, onSettled }) => {
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");
  const rel = useRelativeTime();

  const { data: pendingSummary } = useApiSWR<any>(
    companyId ? `/dashboard/pending-summary?company_id=${companyId}` : null,
    { select: (raw) => raw?.data ?? raw, refreshInterval: 30000 },
  );
  const pendingTxns: any[] = Array.isArray(pendingSummary?.transactions) ? pendingSummary.transactions : [];
  const pendingCount: number = pendingSummary?.count ?? pendingTxns.length;
  const pendingTotalUsd: number = Number(pendingSummary?.total_usd) || 0;

  // Real-time nudge: when a previously-pending payment leaves the pending set
  // (confirmed → settled), toast the merchant and refresh the settlements list.
  const prevPendingIdsRef = useRef<Set<string>>(new Set());
  const pendingSeededRef = useRef(false);
  useEffect(() => {
    if (!pendingSummary) return;
    const ids = new Set<string>(pendingTxns.map((tx) => String(tx?.transaction_id ?? tx?.id ?? "")).filter(Boolean));
    if (!pendingSeededRef.current) {
      prevPendingIdsRef.current = ids;
      pendingSeededRef.current = true;
      return;
    }
    const settled = [...prevPendingIdsRef.current].filter((id) => !ids.has(id));
    if (settled.length > 0) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: settled.length === 1 ? t("payoutsToast.settledOne") : t("payoutsToast.settledMany", { count: settled.length }),
          severity: "success",
        },
      });
      onSettled?.();
    }
    prevPendingIdsRef.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSummary]);

  return (
    <Box sx={cardSx} data-testid="payouts-pending-funds-card">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: `${WARNING_AMBER}1A`, color: WARNING_AMBER }}>
            <HourglassTopRounded fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{t("payouts.pendingFunds", { defaultValue: "Pending funds" })}</Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {t("payouts.pendingFundsDesc", { defaultValue: "Payments awaiting on-chain confirmation" })}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: "right" }}>
          <Typography
            data-testid="payouts-pending-total"
            sx={{ fontSize: { xs: 18, sm: 22 }, fontWeight: 800, lineHeight: 1.1, color: pendingTotalUsd > 0 ? WARNING_AMBER : theme.palette.text.primary }}
          >
            {`\u2248 ${fmtUsd(pendingTotalUsd)}`}
          </Typography>
          <Typography variant="caption" data-testid="payouts-pending-count" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
            {pendingCount === 1
              ? t("payouts.paymentAwaiting", { defaultValue: "1 payment awaiting" })
              : t("payouts.paymentsAwaiting", { defaultValue: "{{count}} payments awaiting", count: pendingCount })}
          </Typography>
        </Box>
      </Stack>
      {pendingTxns.length === 0 ? (
        <Typography variant="body2" data-testid="payouts-pending-empty" sx={{ color: theme.palette.text.secondary, py: 1.5, textAlign: "center" }}>
          {t("payouts.noPendingNow", { defaultValue: "No payments awaiting confirmation right now." })}
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={0}>
          {pendingTxns.slice(0, 6).map((tx, i) => {
            const who = payerLabel(tx);
            const started = rel(tx?.createdAt || tx?.created_at);
            const left = minutesLeftToConfirm(tx?.createdAt || tx?.created_at);
            return (
              <Stack
                key={tx?.transaction_id || tx?.id || i}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                role="link"
                tabIndex={0}
                onClick={() => router.push(coinTransactionsHref(tx))}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") router.push(coinTransactionsHref(tx)); }}
                sx={{ py: 1.25, px: 0.75, mx: -0.75, borderRadius: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 } }}
                data-testid={`payouts-pending-row-${i}`}
                data-coin={coinOf(tx) || ""}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                    {amountLabel(tx, sym)}
                    {fiatLabel(tx) && (
                      <Box component="span" data-testid={`payouts-pending-fiat-${i}`} sx={{ color: theme.palette.text.secondary, fontWeight: 500, fontSize: 13, ml: 0.75 }}>
                        {"\u2248"} {fiatLabel(tx)}
                      </Box>
                    )}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {who ? `${who} \u00b7 ` : ""}
                    {started ? t("payouts.startedRel", { defaultValue: "started {{when}}", when: started }) : ""}
                    {left != null ? t("payouts.minLeft", { defaultValue: " \u00b7 ~{{n}}m left to confirm", n: left }) : ""}
                  </Typography>
                </Box>
                <Chip size="small" label={t("payouts.confirming", { defaultValue: "Confirming" })} sx={{ color: WARNING_AMBER, bgcolor: `${WARNING_AMBER}1A`, fontWeight: 700 }} />
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default PendingFundsCard;
