import { Box, Typography, useTheme } from "@mui/material";
import { FC, memo } from "react";
import useIsMobile from "@/hooks/useIsMobile";

const badges = [
  {
    icon: "🔒",
    title: "256-bit Encryption",
    description: "Bank-grade security for every transaction",
  },
  {
    icon: "⚡",
    title: "Instant Settlement",
    description: "Funds reach your wallet in real time",
  },
  {
    icon: "🚫",
    title: "Zero Chargebacks",
    description: "Crypto payments are irreversible — no fraud risk",
  },
  {
    icon: "🔗",
    title: "Multi-Chain Support",
    description: "BTC, ETH, USDT, SOL, XRP and 15+ coins",
  },
  {
    icon: "🌍",
    title: "Global Reach",
    description: "Take payments from anywhere — no borders",
  },
  {
    icon: "💱",
    title: "Auto Stablecoin Conversion",
    description: "We protect your revenue from volatility, automatically",
  },
];

const TrustBadgesSection: FC = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        py: isMobile ? 6 : 10,
        px: isMobile ? 2 : 4,
        maxWidth: 1280,
        mx: "auto",
        position: "relative",
      }}
    >
      {/* Section header */}
      <Box sx={{ textAlign: "center", mb: isMobile ? 4 : 6 }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 0.75,
            borderRadius: "20px",
            bgcolor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
            border: `1px solid ${isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)"}`,
            mb: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: "12px",
              fontFamily: "UrbanistSemibold",
              fontWeight: 600,
              color: "#10B981",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            Why Merchants Trust Us
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: isMobile ? "28px" : "40px",
            fontFamily: "UrbanistSemibold",
            fontWeight: 700,
            color: theme.palette.text.primary,
            lineHeight: 1.15,
            mb: 1.5,
          }}
        >
          Built for security{isMobile ? <br /> : " "}and peace of mind
        </Typography>
        <Typography
          sx={{
            fontSize: isMobile ? "14px" : "16px",
            fontFamily: "UrbanistMedium",
            color: theme.palette.text.secondary,
            maxWidth: 560,
            mx: "auto",
            lineHeight: 1.5,
          }}
        >
          Every feature is designed to protect your business and make crypto payments simple.
        </Typography>
      </Box>

      {/* Badges grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 2 : 3,
          maxWidth: 1080,
          mx: "auto",
        }}
      >
        {badges.map((badge) => (
          <Box
            key={badge.title}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 2,
              p: isMobile ? 2.5 : 3,
              borderRadius: "16px",
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              transition: "all 0.25s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: isDark ? "rgba(0,4,255,0.3)" : "rgba(0,4,255,0.15)",
                bgcolor: isDark ? "rgba(0,4,255,0.04)" : "rgba(0,4,255,0.02)",
                boxShadow: isDark
                  ? "0 8px 32px rgba(0,4,255,0.08)"
                  : "0 8px 32px rgba(0,4,255,0.06)",
              },
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                minWidth: 48,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                bgcolor: isDark ? "rgba(0,4,255,0.08)" : "rgba(0,4,255,0.05)",
                border: `1px solid ${isDark ? "rgba(0,4,255,0.15)" : "rgba(0,4,255,0.1)"}`,
              }}
            >
              {badge.icon}
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: isMobile ? "15px" : "16px",
                  fontFamily: "UrbanistSemibold",
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  lineHeight: 1.3,
                  mb: 0.5,
                }}
              >
                {badge.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: isMobile ? "13px" : "14px",
                  fontFamily: "UrbanistMedium",
                  color: theme.palette.text.secondary,
                  lineHeight: 1.5,
                }}
              >
                {badge.description}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(TrustBadgesSection);
