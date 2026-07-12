/**
 * LivePreviewPanel — real-time mock of what the customer / donor will see on
 * the checkout page, driven by the create-pay-link form state. Non-interactive.
 */
import React from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { getCurrencySymbolFromFormat, formatWithSeparators } from "@/utils/currencyFormat";
import type { DonationSettingsState } from "./DonationSettingsSection";
import type { LinkKind } from "./LinkTypeSelector";

interface LivePreviewPanelProps {
  linkKind: LinkKind;
  amount: string;
  currency: string;
  clientName?: string;
  description?: string;
  donation: DonationSettingsState;
  purpose?: string;
  acceptedCount: number;
  companyName?: string | null;
}

const LivePreviewPanel = ({
  linkKind,
  amount,
  currency,
  clientName,
  description,
  donation,
  purpose,
  acceptedCount,
  companyName,
}: LivePreviewPanelProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("createPaymentLinkScreen");
  const green = "#10B981";

  const symbol = getCurrencySymbolFromFormat(currency || "USD");
  const fmt = (n: number) => `${symbol}${formatWithSeparators(n, currency || "USD")}`;

  const amountNum = parseFloat(amount);
  const goalNum = parseFloat(donation.goalAmount);
  const hasGoal = Number.isFinite(goalNum) && goalNum > 0;

  const cardBorder = `1px solid ${theme.palette.border.main}`;

  return (
    <Box data-testid="live-preview-panel">
      <Box display="flex" alignItems="center" gap={0.75} mb={1.25}>
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: green,
            boxShadow: `0 0 0 3px ${isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)"}`,
          }}
        />
        <Typography
          sx={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: theme.palette.text.secondary,
            fontFamily: "var(--font-sans)",
          }}
        >
          {t("livePreview", { defaultValue: "Live preview" })}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: 12,
          color: theme.palette.text.secondary,
          fontFamily: "var(--font-sans)",
          mb: 1.5,
        }}
      >
        {linkKind === "donation"
          ? t("livePreviewDonationHint", { defaultValue: "What donors will see when they open your link." })
          : t("livePreviewStandardHint", { defaultValue: "What your customer will see when they open your link." })}
      </Typography>

      {/* The mock checkout card (non-interactive) */}
      <Box
        aria-hidden
        sx={{
          pointerEvents: "none",
          borderRadius: "16px",
          overflow: "hidden",
          border: cardBorder,
          backgroundColor: theme.palette.background.paper,
          boxShadow: isDark
            ? "0 12px 40px rgba(0,0,0,0.35)"
            : "0 8px 32px rgba(10,10,10,0.06), 0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <Box sx={{ height: 3, background: `linear-gradient(90deg, ${green} 0%, ${theme.palette.primary.main} 100%)` }} />

        {linkKind === "donation" && donation.campaignImage && (
          <Box
            component="img"
            src={donation.campaignImage}
            alt=""
            sx={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
          />
        )}

        <Box px={2.25} py={2}>
          {companyName && (
            <Typography
              textAlign="center"
              fontSize={11.5}
              fontWeight={600}
              color={theme.palette.text.secondary}
              fontFamily="var(--font-sans)"
              mb={0.75}
            >
              {companyName}
            </Typography>
          )}

          {linkKind === "donation" ? (
            <>
              <Typography
                textAlign="center"
                fontSize={16}
                fontWeight={700}
                lineHeight={1.3}
                color={theme.palette.text.primary}
                fontFamily="var(--font-sans)"
                data-testid="preview-donation-title"
              >
                {donation.title || t("previewUntitledCampaign", { defaultValue: "Your campaign title" })}
              </Typography>
              {purpose && (
                <Typography
                  textAlign="center"
                  fontSize={12}
                  color={theme.palette.text.secondary}
                  fontFamily="var(--font-sans)"
                  mt={0.5}
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {purpose}
                </Typography>
              )}

              {donation.showProgress && (
                <Box mt={1.5}>
                  <Box display="flex" justifyContent="space-between" alignItems="baseline">
                    <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary} fontFamily="var(--font-sans)">
                      {fmt(0)}{" "}
                      <Typography component="span" fontSize={11.5} fontWeight={500} color={theme.palette.text.secondary}>
                        {hasGoal
                          ? t("previewRaisedOfGoal", { defaultValue: `raised of ${fmt(goalNum)} goal`, goal: fmt(goalNum) })
                          : t("previewRaised", { defaultValue: "raised" })}
                      </Typography>
                    </Typography>
                    {hasGoal && (
                      <Typography fontSize={11} fontWeight={600} color={green} fontFamily="var(--font-sans)">
                        0%
                      </Typography>
                    )}
                  </Box>
                  {hasGoal && (
                    <LinearProgress
                      variant="determinate"
                      value={0}
                      sx={{
                        mt: 0.75,
                        height: 6,
                        borderRadius: 999,
                        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        "& .MuiLinearProgress-bar": { backgroundColor: green },
                      }}
                    />
                  )}
                  {donation.showSupporters && (
                    <Typography fontSize={11} color={theme.palette.text.secondary} fontFamily="var(--font-sans)" mt={0.5}>
                      <Icon icon="mdi:account-heart-outline" width={12} style={{ verticalAlign: "-2px", marginRight: 3 }} />
                      {t("previewSupporters", { defaultValue: "0 supporters" })}
                    </Typography>
                  )}
                </Box>
              )}

              {donation.presets.length > 0 && (
                <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={0.75} mt={1.5}>
                  {donation.presets.slice(0, 6).map((p) => (
                    <Box
                      key={p}
                      sx={{
                        textAlign: "center",
                        py: 0.9,
                        borderRadius: "8px",
                        border: `1px solid ${theme.palette.border.main}`,
                        fontSize: 12.5,
                        fontWeight: 600,
                        fontFamily: "var(--font-sans)",
                        fontVariantNumeric: "tabular-nums",
                        color: theme.palette.text.primary,
                      }}
                    >
                      {fmt(p)}
                    </Box>
                  ))}
                </Box>
              )}

              {donation.allowCustom && (
                <Box
                  mt={donation.presets.length ? 0.75 : 1.5}
                  sx={{
                    borderRadius: "8px",
                    border: `1px solid ${theme.palette.border.main}`,
                    px: 1.5,
                    py: 0.9,
                    fontSize: 12.5,
                    color: theme.palette.text.disabled,
                    fontFamily: "var(--font-sans)",
                    textAlign: "left",
                  }}
                >
                  {symbol} {t("previewOtherAmount", { defaultValue: "Other amount" })}
                </Box>
              )}

              <Box
                mt={1.5}
                sx={{
                  borderRadius: "9px",
                  py: 1.1,
                  textAlign: "center",
                  backgroundColor: theme.palette.primary.main,
                  color: "#0A0A0B",
                  fontWeight: 700,
                  fontSize: 13.5,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {t("previewDonateBtn", { defaultValue: "Donate" })}
              </Box>
              {donation.autoCloseAtGoal && hasGoal && (
                <Typography fontSize={10.5} color={theme.palette.text.disabled} fontFamily="var(--font-sans)" textAlign="center" mt={0.75}>
                  <Icon icon="mdi:flag-checkered" width={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
                  {t("previewAutoClose", { defaultValue: "Closes automatically at goal" })}
                </Typography>
              )}
            </>
          ) : (
            <>
              <Typography
                textAlign="center"
                fontSize={16}
                fontWeight={700}
                color={theme.palette.text.primary}
                fontFamily="var(--font-sans)"
              >
                {t("previewReviewOrder", { defaultValue: "Review Your Order" })}
              </Typography>
              <Typography textAlign="center" fontSize={11.5} color={theme.palette.text.secondary} fontFamily="var(--font-sans)" mt={0.25}>
                {clientName
                  ? t("previewGreeting", { defaultValue: `Hi ${clientName}, complete your payment`, name: clientName })
                  : t("previewGreetingGeneric", { defaultValue: "Complete your payment" })}
              </Typography>

              {(description || clientName) && (
                <Box
                  mt={1.5}
                  p={1.25}
                  borderRadius="10px"
                  sx={{
                    border: cardBorder,
                    backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                    textAlign: "left",
                  }}
                >
                  <Typography fontSize={10} fontWeight={600} letterSpacing={0.5} color={theme.palette.text.secondary} fontFamily="var(--font-sans)" textTransform="uppercase" mb={0.5}>
                    {t("previewOrderDetails", { defaultValue: "Order details" })}
                  </Typography>
                  {description && (
                    <Typography
                      fontSize={12}
                      color={theme.palette.text.primary}
                      fontFamily="var(--font-sans)"
                      sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {description}
                    </Typography>
                  )}
                  {clientName && (
                    <Typography fontSize={11.5} color={theme.palette.text.secondary} fontFamily="var(--font-sans)" mt={0.25}>
                      <Icon icon="mdi:account-outline" width={12} style={{ verticalAlign: "-2px", marginRight: 3 }} />
                      {clientName}
                    </Typography>
                  )}
                </Box>
              )}

              <Box
                mt={1.5}
                p={1.25}
                borderRadius="10px"
                sx={{ border: cardBorder, textAlign: "left" }}
              >
                <Box display="flex" justifyContent="space-between">
                  <Typography fontSize={12} color={theme.palette.text.secondary} fontFamily="var(--font-sans)">
                    {t("previewTotal", { defaultValue: "Total" })}
                  </Typography>
                  <Typography fontSize={13} fontWeight={700} color={theme.palette.text.primary} fontFamily="var(--font-sans)" sx={{ fontVariantNumeric: "tabular-nums" }} data-testid="preview-standard-total">
                    {Number.isFinite(amountNum) && amountNum > 0 ? fmt(amountNum) : `${symbol}0.00`} {currency}
                  </Typography>
                </Box>
              </Box>

              <Box
                mt={1.5}
                sx={{
                  borderRadius: "9px",
                  py: 1.1,
                  textAlign: "center",
                  backgroundColor: theme.palette.primary.main,
                  color: "#0A0A0B",
                  fontWeight: 700,
                  fontSize: 13.5,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {t("previewPayCrypto", { defaultValue: "Cryptocurrency" })}
              </Box>
            </>
          )}

          <Typography fontSize={10.5} color={theme.palette.text.disabled} fontFamily="var(--font-sans)" textAlign="center" mt={1}>
            <Icon icon="mdi:shield-check-outline" width={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
            {acceptedCount > 0
              ? t("previewCoins", { defaultValue: `${acceptedCount} cryptocurrencies accepted`, count: acceptedCount })
              : t("previewSecure", { defaultValue: "Secure payment by Dynopay" })}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LivePreviewPanel;
