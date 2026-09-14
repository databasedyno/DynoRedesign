import { brandFg } from "@/constants/theme";
import React, { memo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
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
          First-payment-free used — you&apos;re on standard pricing now.
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
          <Icon icon="mdi:gift-outline" width={isMobile ? 18 : 20} color={brandFg(theme.palette.mode === "dark")} />
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
            color: brandFg(theme.palette.mode === "dark"),
            bgcolor: `${theme.palette.primary.main}15`,
            px: 1,
            py: 0.3,
            borderRadius: 1,
          }}
        >
          {t("active", { defaultValue: "Active" })}
        </Typography>
      </Box>

      {/* First-payment-free explainer */}
      <Typography
        sx={{
          fontSize: isMobile ? 15 : 17,
          fontWeight: 800,
          color: theme.palette.text.primary,
          lineHeight: 1.3,
          mb: 0.5,
        }}
      >
        {t("feeFree.widgetTitle")}
      </Typography>
      <Typography sx={{ fontSize: isMobile ? 12 : 13, color: theme.palette.text.secondary, lineHeight: 1.5 }}>
        {t("feeFree.widgetBody")}
      </Typography>
    </Box>
  );
};

export default memo(FeeFreeWidget);
