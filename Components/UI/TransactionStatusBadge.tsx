import React from "react";
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { StatusDot, StatusTone } from "@/Components/UI/StatusDot";
import SwapHorizIcon from "@/assets/Icons/swap-round-icon.svg";

export type TxStatus =
  | "pending"
  | "processing"
  | "confirmed"
  | "settled"
  | "failed"
  | "unpaid"
  | "awaiting_payment"
  | string;

/** Single source of truth: raw status -> StatusDot tone (list + drawer). */
export const txStatusTone = (status: TxStatus): StatusTone => {
  switch (status) {
    case "settled":
      return "settled";
    case "confirmed":
      return "info";
    case "pending":
    case "processing":
      return "pending";
    case "failed":
      return "failed";
    case "unpaid":
    case "awaiting_payment":
      return "unpaid";
    default:
      return "neutral";
  }
};

const TIP_KEY: Record<string, string> = {
  pending: "statusTipPending",
  processing: "statusTipPending",
  confirmed: "statusTipConfirming",
  settled: "statusTipSettled",
  failed: "statusTipFailed",
  unpaid: "statusTipUnpaid",
  awaiting_payment: "statusTipAwaiting",
};

interface Props {
  status: TxStatus;
  autoConverted?: boolean;
  /** `inline` = calm dot+text (tables); `pill` = same dot+text in a soft tinted chip (drawer header). */
  variant?: "inline" | "pill";
  "data-testid"?: string;
}

export const TransactionStatusBadge: React.FC<Props> = ({
  status,
  autoConverted,
  variant = "inline",
  "data-testid": testId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const isDark = theme.palette.mode === "dark";
  const converted = !!autoConverted && status === "settled";
  const tip = converted ? t("statusTipConverted") : TIP_KEY[status] ? t(TIP_KEY[status]) : "";
  const label = String(t(status));

  const dot = (
    <StatusDot tone={txStatusTone(status)} data-testid={testId || `tx-status-${status}`}>
      <Box component="span" sx={{ textTransform: "capitalize" }}>{label}</Box>
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
      <Box component="span" sx={{ display: "inline-flex" }}>{dot}</Box>
    );

  if (!tip) return body;
  return (
    <Tooltip title={tip} arrow enterTouchDelay={50} leaveTouchDelay={2500}>
      {body}
    </Tooltip>
  );
};

export default TransactionStatusBadge;
