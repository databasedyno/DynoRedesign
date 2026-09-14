import React from "react";
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { StatusDot } from "@/Components/UI/StatusDot";
import { toTxStatusBucket, TX_STATUS_TONE, type TxStatusBucket } from "@/helpers/txStatus";
import SwapHorizIcon from "@/assets/Icons/swap-round-icon.svg";

/**
 * StatusChip — THE transaction status chip (UX plan 1.4).
 *
 * Accepts any raw backend status, normalises it onto the 7 merchant buckets
 * (helpers/txStatus) and renders the same dot + tinted label everywhere:
 * dashboard, tables, detail drawers, notifications. Copy comes from the
 * `transactions` namespace (all 6 languages); a plain-language tooltip explains
 * each state on hover / long-press.
 */
const TIP_KEY: Record<TxStatusBucket, string> = {
  settled: "statusTipSettled",
  confirmed: "statusTipConfirming",
  processing: "statusTipPending",
  underpaid: "statusTipUnderpaid",
  pending: "statusTipPending",
  awaiting_payment: "statusTipAwaiting",
  unpaid: "statusTipUnpaid",
  failed: "statusTipFailed",
};

export interface StatusChipProps {
  /** Raw backend status or one of the 7 buckets. */
  status: string;
  autoConverted?: boolean;
  /** `inline` = dot + text (lists); `pill` = same inside a soft tinted chip (drawer headers). */
  variant?: "inline" | "pill";
  /** Short label for awaiting_payment ("Awaiting" instead of "Awaiting payment"). */
  short?: boolean;
  tooltip?: boolean;
  sx?: SxProps<Theme>;
  "data-testid"?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  autoConverted,
  variant = "inline",
  short,
  tooltip = true,
  sx,
  "data-testid": testId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const isDark = theme.palette.mode === "dark";
  const bucket = toTxStatusBucket(status);
  const converted = !!autoConverted && bucket === "settled";
  const tip = converted ? t("statusTipConverted") : t(TIP_KEY[bucket]);
  const label =
    short && bucket === "awaiting_payment"
      ? t("awaitingShort", { defaultValue: "Awaiting" })
      : String(t(bucket));

  const dot = (
    <StatusDot
      tone={TX_STATUS_TONE[bucket]}
      data-testid={testId || `tx-status-${bucket}`}
      data-status={bucket}
      sx={sx}
    >
      <Box component="span" sx={{ textTransform: "capitalize" }}>
        {label}
      </Box>
      {converted && (
        <Typography
          component="span"
          data-testid="tx-status-converted"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: 11,
            fontFamily: "var(--font-sans)",
            color: theme.palette.text.secondary,
            ml: 0.25,
          }}
        >
          <Image src={SwapHorizIcon} alt="" width={12} height={12} draggable={false} className="themed-icon" />
          {t("autoConvertedShort", { defaultValue: "Converted" })}
        </Typography>
      )}
    </StatusDot>
  );

  const body =
    variant === "pill" ? (
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 12px",
          borderRadius: 999,
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.04)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(10,10,15,0.08)"}`,
          flexShrink: 0,
        }}
      >
        {dot}
      </Box>
    ) : (
      <Box component="span" sx={{ display: "inline-flex" }}>
        {dot}
      </Box>
    );

  if (!tooltip || !tip) return body;
  return (
    <Tooltip title={tip} arrow enterTouchDelay={50} leaveTouchDelay={2500}>
      {body}
    </Tooltip>
  );
};

export default StatusChip;
