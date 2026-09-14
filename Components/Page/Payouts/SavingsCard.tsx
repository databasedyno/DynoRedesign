import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Divider, Stack, Typography, useTheme } from "@mui/material";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import Sparkline from "@/Components/UI/Sparkline";
import useApiSWR from "@/hooks/useApiSWR";
import { SUCCESS_GREEN } from "@/constants/theme";
import { CardSx, fmtUsd } from "./payoutsHelpers";

interface Props {
  companyId: number | null;
  cardSx: CardSx;
}

/** Auto-convert "volatility protection" — value locked into stablecoins (GET /company/conversion-savings). */
const SavingsCard: React.FC<Props> = ({ companyId, cardSx }) => {
  const theme = useTheme();
  const { t } = useTranslation("common");

  const { data: savings } = useApiSWR<any>(
    companyId ? `/company/conversion-savings/${companyId}` : null,
    { select: (raw) => raw?.data ?? raw },
  );
  const monthUsd: number = Number(savings?.month_converted_usd) || 0;
  const monthCount: number = Number(savings?.month_count) || 0;
  const inProgress: number = Number(savings?.in_progress_count) || 0;
  const allTimeCount: number = Number(savings?.all_time_count) || 0;
  const monthly: number[] = Array.isArray(savings?.monthly) ? savings.monthly.map((v: unknown) => Number(v) || 0) : [];

  const description =
    allTimeCount === 1 && monthUsd > 0
      ? t("payouts.savingsFirst", { defaultValue: "Your first payment was just auto-converted to a stablecoin \u2014 locked in against volatility" })
      : monthUsd > 0
        ? t("payouts.savingsMonth", { defaultValue: "Locked into stablecoins this month across {{count}} {{noun}} — shielded from crypto volatility", count: monthCount, noun: monthCount === 1 ? t("payouts.payment", { defaultValue: "payment" }) : t("payouts.payments", { defaultValue: "payments" }) })
        : inProgress > 0
          ? t("payouts.savingsInProgress", { defaultValue: "{{count}} {{noun}} in progress — protecting your revenue", count: inProgress, noun: inProgress === 1 ? t("payouts.conversion", { defaultValue: "conversion" }) : t("payouts.conversions", { defaultValue: "conversions" }) })
          : t("payouts.savingsOff", { defaultValue: "Turn on auto-convert to lock incoming crypto into stablecoins" });

  return (
    <Box sx={{ ...cardSx }} data-testid="payouts-autoconvert-savings-card">
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: `${SUCCESS_GREEN}1A`, color: SUCCESS_GREEN, flexShrink: 0 }}>
            <ShieldRounded fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography sx={{ fontWeight: 700 }}>
                {t("payouts.autoConvertProtection", { defaultValue: "Auto-convert protection" })}
              </Typography>
              {allTimeCount === 1 && (
                <Chip
                  size="small"
                  icon={<AutoAwesomeRounded sx={{ fontSize: 14 }} />}
                  label={t("payouts.firstConversion", { defaultValue: "First conversion!" })}
                  data-testid="payouts-first-conversion-badge"
                  sx={{
                    height: 22,
                    fontWeight: 700,
                    fontSize: 11,
                    color: SUCCESS_GREEN,
                    bgcolor: `${SUCCESS_GREEN}1A`,
                    "& .MuiChip-icon": { color: SUCCESS_GREEN, ml: 0.5 },
                    animation: "payoutsCelebratePulse 1.6s ease-in-out 3",
                    "@keyframes payoutsCelebratePulse": {
                      "0%, 100%": { transform: "scale(1)" },
                      "50%": { transform: "scale(1.06)" },
                    },
                  }}
                />
              )}
            </Stack>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {description}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography
            data-testid="payouts-savings-month"
            sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, lineHeight: 1.1, color: monthUsd > 0 ? SUCCESS_GREEN : theme.palette.text.primary }}
          >
            {fmtUsd(monthUsd)}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>
            {t("payouts.thisMonth", { defaultValue: "This month" })}
          </Typography>
        </Box>
      </Stack>
      {(monthly.some((v) => v > 0) || allTimeCount > 0) && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={1}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
              {t("payouts.last6Months", { defaultValue: "Last 6 months" })}
            </Typography>
            <Sparkline
              points={monthly}
              width={168}
              height={36}
              color={SUCCESS_GREEN}
              ariaLabel={t("payouts.savingsSparklineAria", { defaultValue: "Stablecoin conversions over the last 6 months" })}
              data-testid="payouts-savings-sparkline"
            />
          </Stack>
        </>
      )}
    </Box>
  );
};

export default SavingsCard;
