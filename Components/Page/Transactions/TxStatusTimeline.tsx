import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { toTxStatusBucket, type TxStatusBucket } from "@/helpers/txStatus";

/**
 * TxStatusTimeline — a prominent, state-specific status banner + a 4-step
 * progress rail (Created → Payment received → Confirmed → Settled) for the
 * transaction details drawer. Gives merchants unambiguous context — especially
 * when the drawer is opened from a notification — instead of three near-identical
 * looking states (plan: Notification clarity).
 */
interface Props {
  status: string;
  autoConverted?: boolean;
  /** e.g. "3/6" or "Confirmed" — shown while confirming. */
  confirmations?: string;
  hasIncoming?: boolean;
  hasOutgoing?: boolean;
  isMobile?: boolean;
}

type BannerSpec = {
  color: string;
  icon: string;
  title: string;
  body: string;
  showConfirmations?: boolean;
};

export const TxStatusTimeline: React.FC<Props> = ({
  status,
  autoConverted,
  confirmations,
  hasIncoming,
  hasOutgoing,
  isMobile,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const tt = (key: string, defaultValue: string): string => {
    const r = t(key, { ns: "transactions", defaultValue });
    return typeof r === "string" ? r : String(r);
  };

  const bucket: TxStatusBucket = toTxStatusBucket(status);

  const AMBER = "#D97706";
  const BLUE = "#2563EB";
  const GREEN = "#059669";
  const ORANGE = "#C2410C";
  const RED = "#DC2626";

  const banner: BannerSpec = (() => {
    switch (bucket) {
      case "settled":
        return {
          color: GREEN,
          icon: "circle-check",
          title: tt("tlSettledTitle", "Payment settled"),
          body: autoConverted
            ? tt("tlSettledConvertedBody", "Funds were received, confirmed on-chain and converted & forwarded to your settlement wallet.")
            : tt("tlSettledBody", "Funds were received, confirmed on-chain and forwarded to your settlement wallet."),
        };
      case "confirmed":
        return {
          color: BLUE,
          icon: "shield-check",
          title: tt("tlConfirmedTitle", "Confirmed on-chain"),
          body: tt("tlConfirmedBody", "The payment is confirmed on the blockchain and is being forwarded to your settlement wallet — it will settle shortly."),
          showConfirmations: true,
        };
      case "processing":
        return {
          color: BLUE,
          icon: "clock",
          title: tt("tlProcessingTitle", "Confirming on-chain"),
          body: tt("tlProcessingBody", "Payment received — waiting for blockchain confirmations. This updates automatically as confirmations come in."),
          showConfirmations: true,
        };
      case "underpaid":
        return {
          color: ORANGE,
          icon: "triangle-alert",
          title: tt("tlUnderpaidTitle", "Partial payment received"),
          body: tt("tlUnderpaidBody", "The customer sent less than the requested amount. See the amount received and remaining balance below."),
        };
      case "failed":
        return {
          color: RED,
          icon: "circle-alert",
          title: tt("tlFailedTitle", "Payment not completed"),
          body: tt("tlFailedBody", "This payment expired or failed before it could settle, so no funds were forwarded to your wallet."),
        };
      default:
        return {
          color: AMBER,
          icon: "clock",
          title: tt("tlAwaitingTitle", "Awaiting payment — no funds received yet"),
          body: tt("tlAwaitingBody", "We haven't detected an on-chain deposit yet, so nothing has been sent to your wallet. This entry updates automatically once the customer's funds arrive and are confirmed."),
        };
    }
  })();

  // ── Step completion ───────────────────────────────────────────────────────
  const receivedDone =
    Boolean(hasIncoming) || ["processing", "confirmed", "settled", "underpaid"].includes(bucket);
  const confirmedDone = ["confirmed", "settled"].includes(bucket);
  const settledDone = bucket === "settled" || Boolean(hasOutgoing);

  const steps = [
    { key: "created", label: tt("tlStepCreated", "Created"), done: true },
    { key: "received", label: tt("tlStepReceived", "Payment received"), done: receivedDone },
    { key: "confirmed", label: tt("tlStepConfirmed", "Confirmed"), done: confirmedDone },
    { key: "settled", label: tt("tlStepSettled", "Settled"), done: settledDone },
  ];

  const isFailed = bucket === "failed";
  // Active = first not-done step (where the payment currently sits). None when settled.
  const activeIndex = isFailed ? -1 : steps.findIndex((s) => !s.done);

  const mutedLine = theme.palette.mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.12)";
  const mutedRing = theme.palette.mode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(10,10,15,0.20)";

  const confLabel = (confirmations || "").trim();
  const showConf = Boolean(banner.showConfirmations && confLabel && confLabel !== "0");

  return (
    <Box data-testid="tx-status-timeline" data-status={bucket} sx={{ mb: isMobile ? 2 : 2.5 }}>
      {/* Status banner */}
      <Box
        data-testid="tx-status-banner"
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          p: 1.5,
          borderRadius: "12px",
          border: `1px solid ${banner.color}40`,
          backgroundColor: `${banner.color}14`,
        }}
      >
        <Box sx={{ color: banner.color, flexShrink: 0, mt: "1px", display: "flex" }}>
          <Icon name={banner.icon} size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            data-testid="tx-status-banner-title"
            sx={{ fontSize: 13.5, fontWeight: 800, color: banner.color, lineHeight: "18px", mb: 0.25 }}
          >
            {banner.title}
            {showConf && (
              <Box
                component="span"
                data-testid="tx-status-confirmations"
                sx={{
                  ml: 1,
                  px: 0.75,
                  py: "1px",
                  borderRadius: "6px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono), monospace",
                  color: banner.color,
                  backgroundColor: `${banner.color}1F`,
                  verticalAlign: "middle",
                }}
              >
                {confLabel.includes("/") ? confLabel : `${tt("tlConfirmationsLabel", "Confirmations")}: ${confLabel}`}
              </Box>
            )}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: "17px" }}>
            {banner.body}
          </Typography>
        </Box>
      </Box>

      {/* Progress rail */}
      {!isFailed && (
        <Box sx={{ display: "flex", alignItems: "flex-start", mt: 2 }}>
          {steps.map((step, i) => {
            const isActive = i === activeIndex;
            const prevDone = i === 0 ? true : steps[i - 1].done;
            const nodeColor = step.done || isActive ? banner.color : mutedRing;
            return (
              <Box
                key={step.key}
                data-testid={`tx-timeline-step-${step.key}`}
                data-done={step.done ? "true" : "false"}
                data-active={isActive ? "true" : "false"}
                sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}
              >
                <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <Box sx={{ flex: 1, height: 2, backgroundColor: i === 0 ? "transparent" : prevDone ? banner.color : mutedLine }} />
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: step.done ? banner.color : "transparent",
                      border: step.done ? "none" : `2px solid ${nodeColor}`,
                      color: step.done ? "#fff" : banner.color,
                      boxShadow: isActive ? `0 0 0 4px ${banner.color}22` : "none",
                    }}
                  >
                    {step.done ? (
                      <Icon name="check" size={14} />
                    ) : isActive ? (
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: banner.color }} />
                    ) : null}
                  </Box>
                  <Box sx={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? "transparent" : step.done ? banner.color : mutedLine }} />
                </Box>
                <Typography
                  sx={{
                    mt: 0.75,
                    fontSize: isMobile ? 10.5 : 11.5,
                    fontWeight: step.done || isActive ? 700 : 500,
                    textAlign: "center",
                    lineHeight: 1.2,
                    color: step.done || isActive ? theme.palette.text.primary : theme.palette.text.secondary,
                  }}
                >
                  {step.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default TxStatusTimeline;
