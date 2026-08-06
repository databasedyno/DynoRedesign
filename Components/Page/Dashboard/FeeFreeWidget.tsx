import React, { memo } from "react";
import { Box, Typography, LinearProgress, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { useFeeFreeStatus } from "@/hooks/useFeeFreeStatus";

const FeeFreeWidget: React.FC = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { data, loading } = useFeeFreeStatus();

  // Don't render if no data or still loading
  if (loading || !data) return null;

  const remaining = data.fee_free_remaining_usd;
  const total = data.fee_free_total_usd;
  const used = data.fee_free_used_usd;
  const pctUsed = data.percentage_used;
  const isFree = data.is_fee_free;

  // If fee-free is exhausted, show a subtle completed banner
  if (!isFree) {
    return (
      <Box
        sx={{
          p: isMobile ? 1.5 : 2,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
          mb: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Icon icon="mdi:check-circle" width={20} color={theme.palette.success.main} />
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
          Fee-free promotion complete. ${total.toFixed(0)} processed fee-free.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: isMobile ? 2 : 2.5,
        borderRadius: 2,
        border: `1px solid ${theme.palette.primary.main}30`,
        background: `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.background.paper} 100%)`,
        mb: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Icon icon="mdi:gift-outline" width={isMobile ? 18 : 20} color={theme.palette.primary.main} />
          <Typography
            sx={{
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              color: theme.palette.text.primary,
            }}
          >
            {t("feeFreePromotion")}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: isMobile ? 11 : 12,
            fontWeight: 600,
            color: theme.palette.primary.main,
            bgcolor: `${theme.palette.primary.main}15`,
            px: 1,
            py: 0.3,
            borderRadius: 1,
          }}
        >
          {pctUsed.toFixed(0)}% used
        </Typography>
      </Box>

      {/* Amount remaining */}
      <Typography
        sx={{
          fontSize: isMobile ? 22 : 26,
          fontWeight: 800,
          color: theme.palette.text.primary,
          lineHeight: 1.2,
          mb: 0.5,
        }}
      >
        ${remaining.toFixed(2)}
        <Typography
          component="span"
          sx={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: theme.palette.text.secondary, ml: 0.5 }}
        >
          remaining
        </Typography>
      </Typography>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={pctUsed}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: `${theme.palette.primary.main}15`,
          mb: 1,
          "& .MuiLinearProgress-bar": {
            borderRadius: 4,
            bgcolor: pctUsed > 80 ? theme.palette.warning.main : theme.palette.primary.main,
          },
        }}
      />

      {/* Footer stats */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography sx={{ fontSize: isMobile ? 11 : 12, color: theme.palette.text.secondary }}>
          ${used.toFixed(2)} of ${total.toFixed(0)} used
        </Typography>
        <Typography sx={{ fontSize: isMobile ? 11 : 12, color: theme.palette.text.secondary }}>
          Total volume: ${(data.cumulative_volume_usd ?? 0).toFixed(2)}
        </Typography>
      </Box>
    </Box>
  );
};

export default memo(FeeFreeWidget);
