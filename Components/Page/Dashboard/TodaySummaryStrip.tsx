import { brandFg } from "@/constants/theme";
import { TrendingUp, TrendingDown, TrendingFlat, AccessTime, PendingActions } from "@mui/icons-material";
import { Box, Typography, useTheme, Skeleton } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface TodaySummaryProps {
  todaySummary?: {
    volumeToday: number;
    volumeTodayFormatted: string;
    volumeYesterday: number;
    volumeYesterdayFormatted: string;
    volumeChangePercent: number;
    transactionsToday: number;
    transactionsYesterday: number;
    transactionsChangePercent: number;
    pendingCount: number;
    currency: string;
  };
  loading: boolean;
}

const TrendIcon = ({ value }: { value: number }) => {
  if (value > 0) return <TrendingUp sx={{ fontSize: 16 }} />;
  if (value < 0) return <TrendingDown sx={{ fontSize: 16 }} />;
  return <TrendingFlat sx={{ fontSize: 16 }} />;
};

const TodaySummaryStrip: React.FC<TodaySummaryProps> = ({ todaySummary, loading }) => {
  const theme = useTheme();
  const { t } = useTranslation("dashboardLayout");

  const cards = [
    {
      label: t("volumeToday"),
      value: todaySummary?.volumeTodayFormatted ?? "$0.00",
      change: todaySummary?.volumeChangePercent ?? 0,
      subLabel: t("vsYesterday"),
      icon: <TrendingUp sx={{ fontSize: 18, color: brandFg(theme.palette.mode === "dark") }} />,
    },
    {
      label: t("volumeYesterday"),
      value: todaySummary?.volumeYesterdayFormatted ?? "$0.00",
      change: null,
      subLabel: "",
      icon: <AccessTime sx={{ fontSize: 18, color: theme.palette.text.secondary }} />,
    },
    {
      label: t("transactionsToday"),
      value: String(todaySummary?.transactionsToday ?? 0),
      change: todaySummary?.transactionsChangePercent ?? 0,
      subLabel: t("vsYesterday"),
      icon: <TrendingUp sx={{ fontSize: 18, color: brandFg(theme.palette.mode === "dark") }} />,
    },
    {
      label: t("pendingLabel"),
      value: String(todaySummary?.pendingCount ?? 0),
      change: null,
      subLabel: t("awaitingPayment"),
      icon: <PendingActions sx={{ fontSize: 18, color: "#F59E0B" }} />,
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        gap: { xs: "8px", md: "16px" },
        mb: 2.5,
        px: { xs: "16px", md: "0px" },
      }}
    >
      {cards.map((card, index) => (
        <Box
          key={index}
          sx={{
            p: { xs: "12px", md: "16px 20px" },
            borderRadius: "12px",
            bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#fff",
            border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#E9ECF2"}`,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            transition: "border-color 0.2s, box-shadow 0.2s",
            "&:hover": {
              borderColor: theme.palette.primary.main + "40",
              boxShadow: `0 2px 8px ${theme.palette.primary.main}10`,
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography
              sx={{
                fontSize: { xs: "11px", md: "12px" },
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.secondary,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {card.label}
            </Typography>
            {card.icon}
          </Box>

          <Typography
            sx={{
              fontSize: { xs: "18px", md: "22px" },
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              color: theme.palette.text.primary,
              lineHeight: 1.2,
            }}
          >
            {loading ? <Skeleton width={80} /> : card.value}
          </Typography>

          {card.change !== null && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  px: "6px",
                  py: "2px",
                  borderRadius: "4px",
                  bgcolor: card.change > 0
                    ? "rgba(16, 185, 129, 0.1)"
                    : card.change < 0
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(107, 114, 128, 0.1)",
                  color: card.change > 0
                    ? "#10B981"
                    : card.change < 0
                    ? "#EF4444"
                    : theme.palette.text.secondary,
                }}
              >
                {loading ? (
                  <Skeleton width={30} />
                ) : (
                  <>
                    <TrendIcon value={card.change} />
                    <Typography sx={{ fontSize: "11px", fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                      {card.change > 0 ? "+" : ""}{card.change.toFixed(1)}%
                    </Typography>
                  </>
                )}
              </Box>
              <Typography
                sx={{
                  fontSize: "11px",
                  fontFamily: "var(--font-sans)",
                  color: theme.palette.text.secondary,
                }}
              >
                {card.subLabel}
              </Typography>
            </Box>
          )}

          {card.change === null && card.subLabel && (
            <Typography
              sx={{
                fontSize: "11px",
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.secondary,
              }}
            >
              {card.subLabel}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
};

export default React.memo(TodaySummaryStrip);
