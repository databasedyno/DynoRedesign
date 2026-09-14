import React from "react";
import { Alert, Box, Button, Chip, Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import { useTranslation } from "react-i18next";
import { RefundStatusTimeline, maskAddress } from "./refundStatus";
import { RefundRow, Row, STATUS_COLORS } from "./refundModalShared";

interface Props {
  r: RefundRow;
  copied: boolean;
  onCopy: (text: string) => void;
  simulating: boolean;
  onSimulate: (refundId: string) => void;
}

/** Created / existing refund invoice: status, timeline, deposit instructions and breakdown. */
export const RefundInvoiceView: React.FC<Props> = ({ r, copied, onCopy, simulating, onSimulate }) => {
  const { t } = useTranslation("common");
    const sc = STATUS_COLORS[r.status] || STATUS_COLORS.awaiting_deposit;
    const isPlaceholder = /^DRYRUN-/.test(r.dyno_deposit_address || "");
    return (
      <Stack spacing={2} sx={{ pt: 1 }} data-testid="refund-invoice">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2">{t("refund.status")}</Typography>
          <Chip
            size="small"
            label={String(r.status).replace(/_/g, " ").toUpperCase()}
            sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700 }}
            data-testid="refund-status-chip"
          />
          {r.is_dry_run && (
            <Chip size="small" label="DRY-RUN" sx={{ bgcolor: "#EDE9FE", color: "#5B21B6", fontWeight: 700 }} />
          )}
        </Stack>

        <Box sx={{ px: 0.5 }}>
          <RefundStatusTimeline status={r.status} />
        </Box>

        {r.is_dry_run &&
          ["awaiting_deposit", "deposit_detected", "forwarding"].includes(r.status) && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onSimulate(r.refund_id)}
                disabled={simulating}
                data-testid="refund-simulate-btn"
              >
                {simulating ? t("refund.advancing") : t("refund.advance")}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {t("refund.sandboxHint")}
              </Typography>
            </Box>
          )}

        {r.is_dry_run && (
          <Alert severity="info" sx={{ fontSize: 13 }}>
            {t("refund.dryRunNote")}
          </Alert>
        )}

        <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover" }}>
          <Typography variant="caption" color="text.secondary">
            {t("refund.sendExactly")}
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 20, color: "text.primary" }} data-testid="refund-deposit-amount">
            {Number(r.merchant_deposit_total)} {r.deposit_asset}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("refund.toAddress", { chain: r.chain })}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
            <Typography
              sx={{ fontFamily: "var(--font-mono)", wordBreak: "break-all", fontSize: 13, color: "text.primary" }}
              data-testid="refund-deposit-address"
            >
              {r.dyno_deposit_address}
            </Typography>
            {!isPlaceholder && (
              <Tooltip title={copied ? t("copied", { defaultValue: "Copied" }) : t("copy", { defaultValue: "Copy" })}>
                <IconButton size="small" onClick={() => onCopy(r.dyno_deposit_address)}>
                  <ContentCopyRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <Divider />
        <Stack spacing={0.5}>
          <Row label={t("refund.refundToCustomer")} value={`${Number(r.refund_amount)} ${r.asset}`} />
          <Row
            label={t("refund.networkFeeYouCover")}
            value={`${Number(r.gas_buffer_native)} ${r.gas_buffer_symbol}`}
          />
          <Row
            label={t("refund.customerReceivesAt")}
            value={maskAddress(r.customer_refund_address)}
            mono
          />
        </Stack>
      </Stack>
    );
};

export default RefundInvoiceView;
