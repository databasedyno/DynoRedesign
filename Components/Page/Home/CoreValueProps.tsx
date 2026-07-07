import React, { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";

interface ValueProp {
  icon: string;
  gradient: string;
  glowColor: string;
  titleKey: string;
  descriptionKey: string;
  stat: string;
  statLabel: string;
}

const valueProps: ValueProp[] = [
  {
    icon: "🔄",
    gradient: "linear-gradient(135deg, #CCFF00 0%, #9EDB00 100%)",
    glowColor: "rgba(204,255,0,0.18)",
    titleKey: "coreValue1Title",
    descriptionKey: "coreValue1Description",
    stat: "<5s",
    statLabel: "conversion time",
  },
  {
    icon: "🔗",
    gradient: "linear-gradient(135deg, #7C8BFF 0%, #5865F2 100%)",
    glowColor: "rgba(88,101,242,0.18)",
    titleKey: "coreValue2Title",
    descriptionKey: "coreValue2Description",
    stat: "30s",
    statLabel: "to create a link",
  },
  {
    icon: "📋",
    gradient: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
    glowColor: "rgba(16,185,129,0.16)",
    titleKey: "coreValue3Title",
    descriptionKey: "coreValue3Description",
    stat: "100%",
    statLabel: "automated",
  },
];

const CoreValueProps: React.FC = () => {
  const { t } = useTranslation("landing");
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="features"
      style={{
        padding: isMobile ? "80px 0" : "140px 0",
      }}
    >
      <HomeSectionTitle
        type="small"
        badgeText={t("coreValueBadge")}
        title={t("coreValueTitle")}
        highlightText={t("coreValueHighlight")}
        subtitle={t("coreValueSubtitle")}
        sx={{ maxWidth: "100%" }}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 3 : 4,
          mt: isMobile ? 5 : 8,
          px: isMobile ? 1 : 0,
        }}
      >
        {valueProps.map((prop, idx) => (
          <Box
            key={prop.titleKey}
            sx={{
              position: "relative",
              borderRadius: "24px",
              bgcolor: isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.72)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
              p: isMobile ? 3 : 4,
              overflow: "hidden",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: isVisible ? "translateY(0)" : "translateY(30px)",
              opacity: isVisible ? 1 : 0,
              transitionDelay: `${idx * 150}ms`,
              cursor: "default",
              "&:hover": {
                transform: "translateY(-6px)",
                borderColor: isDark ? "rgba(204,255,0,0.45)" : "rgba(10,10,10,0.28)",
                boxShadow: isDark
                  ? `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${prop.glowColor}`
                  : `0 20px 60px rgba(10,10,10,0.08), 0 0 40px ${prop.glowColor}`,
              },
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "3px",
                background: prop.gradient,
                borderRadius: "24px 24px 0 0",
                opacity: 0,
                transition: "opacity 0.3s ease",
              },
              "&:hover::before": {
                opacity: 1,
              },
            }}
          >
            {/* Subtle glow background */}
            <Box
              sx={{
                position: "absolute",
                top: "-40px",
                right: "-40px",
                width: 160,
                height: 160,
                borderRadius: "50%",
                background: prop.glowColor,
                filter: "blur(60px)",
                pointerEvents: "none",
                opacity: 0.5,
              }}
            />

            {/* Icon */}
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "16px",
                background: prop.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                mb: 3,
                position: "relative",
                zIndex: 1,
                boxShadow: `0 4px 16px ${prop.glowColor}`,
              }}
            >
              {prop.icon}
            </Box>

            {/* Title */}
            <Typography
              sx={{
                fontSize: isMobile ? "20px" : "22px",
                fontFamily: "OutfitMedium",
                fontWeight: 600,
                color: theme.palette.text.primary,
                lineHeight: 1.3,
                mb: 1.5,
                position: "relative",
                zIndex: 1,
              }}
            >
              {t(prop.titleKey)}
            </Typography>

            {/* Description */}
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "OutfitRegular",
                color: theme.palette.text.secondary,
                lineHeight: 1.6,
                mb: 3,
                position: "relative",
                zIndex: 1,
              }}
            >
              {t(prop.descriptionKey)}
            </Typography>

            {/* Stat chip */}
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 0.75,
                borderRadius: "10px",
                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                position: "relative",
                zIndex: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: "16px",
                  fontFamily: "OutfitSemiBold",
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                }}
              >
                {prop.stat}
              </Typography>
              <Typography
                sx={{
                  fontSize: "12px",
                  fontFamily: "OutfitRegular",
                  color: theme.palette.text.secondary,
                }}
              >
                {prop.statLabel}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </section>
  );
};

export default memo(CoreValueProps);
