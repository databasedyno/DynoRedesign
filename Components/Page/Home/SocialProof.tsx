import { Box, Typography, useTheme } from "@mui/material";
import { FC, memo, useEffect, useRef, useState } from "react";
import useIsMobile from "@/hooks/useIsMobile";

const stats = [
  {
    value: "$2M+",
    label: "Processed",
    gradient: "linear-gradient(135deg, #4F46E5 0%, #4D50FF 100%)",
  },
  {
    value: "500+",
    label: "Merchants",
    gradient: "linear-gradient(135deg, #1C993D 0%, #47B464 100%)",
  },
  {
    value: "15+",
    label: "Cryptos",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  },
  {
    value: "99.9%",
    label: "Uptime",
    gradient: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
  },
];

const trustFeatures = [
  { icon: "🔒", text: "256-bit Encryption" },
  { icon: "⚡", text: "Instant Settlement" },
  { icon: "🚫", text: "Zero Chargebacks" },
  { icon: "🔗", text: "Multi-Chain Support" },
];

const SocialProofSection: FC = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={sectionRef}
      sx={{
        py: isMobile ? 6 : 9,
        px: isMobile ? 2 : 4,
        maxWidth: 1100,
        mx: "auto",
      }}
    >
      {/* Stats row */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: isMobile ? 2 : 4,
          mb: isMobile ? 3 : 4,
        }}
      >
        {stats.map((stat, idx) => (
          <Box
            key={stat.label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: isMobile ? 2 : 3,
              py: isMobile ? 1.5 : 2,
              borderRadius: "14px",
              bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              transition: "all 0.4s ease",
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
              opacity: isVisible ? 1 : 0,
              transitionDelay: `${idx * 100}ms`,
              flex: isMobile ? "1 1 40%" : "0 1 auto",
              minWidth: isMobile ? 140 : "auto",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: isDark
                  ? "0 8px 24px rgba(0,0,0,0.15)"
                  : "0 8px 24px rgba(0,0,0,0.06)",
              },
            }}
          >
            <Typography
              sx={{
                fontSize: isMobile ? "24px" : "28px",
                fontFamily: "OutfitSemiBold",
                fontWeight: 700,
                background: stat.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.1,
              }}
            >
              {stat.value}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "13px" : "14px",
                fontFamily: "OutfitMedium",
                color: theme.palette.text.secondary,
                lineHeight: 1.2,
              }}
            >
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Compact trust features row */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: isMobile ? 1.5 : 3,
        }}
      >
        {trustFeatures.map((feature, idx) => (
          <Box
            key={feature.text}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              opacity: isVisible ? 0.7 : 0,
              transition: "all 0.4s ease",
              transitionDelay: `${400 + idx * 80}ms`,
              "&:hover": {
                opacity: 1,
              },
            }}
          >
            <Typography sx={{ fontSize: "16px" }}>{feature.icon}</Typography>
            <Typography
              sx={{
                fontSize: "13px",
                fontFamily: "OutfitMedium",
                color: theme.palette.text.secondary,
                whiteSpace: "nowrap",
              }}
            >
              {feature.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(SocialProofSection);
