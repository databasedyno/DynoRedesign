import React, { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import HomeButton from "@/Components/Layout/HomeButton";
import FeeCalculator from "@/Components/UI/FeeCalculator";

const competitors = [
  { name: "Dynopay", fee: "0.5%–1.5%", extra: "By volume · first $500 free", highlight: true },
  { name: "PayPal", fee: "2.9%", extra: "+ $0.30", highlight: false },
  { name: "Stripe", fee: "2.9%", extra: "+ $0.30", highlight: false },
];

const FeeSection = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("fees");
  const { t: tLanding } = useTranslation("landing");
  const theme = useTheme();
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
      id="fee-calculator"
      style={{
        padding: isMobile ? "80px 0" : "140px 0",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <HomeSectionTitle
        type="small"
        badgeText={t("feeSectionBadge")}
        title={t("feeSectionTitle")}
        highlightText={t("feeSectionHighlight")}
        subtitle={t("feeSectionSubtitle")}
        sx={{ maxWidth: "100%" }}
      />

      {/* $500 Fee-Free Promotion Banner */}
      <Box
        sx={{
          maxWidth: 720,
          mx: "auto",
          mb: isMobile ? 4 : 5,
          mt: isMobile ? 4 : 6,
          position: "relative",
          borderRadius: "20px",
          overflow: "hidden",
          border: `1px solid ${isDark ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.2)"}`,
          bgcolor: isDark ? "rgba(16,185,129,0.04)" : "rgba(16,185,129,0.03)",
          p: isMobile ? 3 : 4,
          transition: "all 0.4s ease",
          transform: isVisible ? "translateY(0)" : "translateY(15px)",
          opacity: isVisible ? 1 : 0,
          transitionDelay: "300ms",
        }}
      >
        {/* Glow accent */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "linear-gradient(90deg, #10B981, #34D399, #10B981)",
            borderRadius: "20px 20px 0 0",
          }}
        />

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? 2 : 3,
          }}
        >
          {/* Gift icon */}
          <Box
            sx={{
              width: 56,
              height: 56,
              minWidth: 56,
              borderRadius: "16px",
              background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              boxShadow: `0 8px 24px ${isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)"}`,
            }}
          >
            🎁
          </Box>

          {/* Text content */}
          <Box sx={{ flex: 1 }}>
            <Typography
              sx={{
                fontSize: isMobile ? "18px" : "20px",
                fontFamily: "var(--font-sans)",
                fontWeight: 800,
                color: theme.palette.text.primary,
                lineHeight: 1.3,
                mb: 0.5,
              }}
            >
              {t("feeFreeBannerTitle")}
            </Typography>
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.secondary,
                lineHeight: 1.5,
              }}
            >
              {t("feeFreeBannerDescription")}
            </Typography>
          </Box>

          {/* CTA */}
          <Box sx={{ flexShrink: 0 }}>
            <HomeButton
              variant="primary"
              label={t("feeFreeBannerCta")}
              navigateTo="/auth/register"
              sx={{
                background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                },
                whiteSpace: "nowrap",
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Fee Comparison */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: isMobile ? 1.5 : 2.5,
          mt: isMobile ? 4 : 6,
          mb: isMobile ? 4 : 5,
          flexWrap: "wrap",
        }}
      >
        {competitors.map((c, idx) => (
          <Box
            key={c.name}
            sx={{
              px: isMobile ? 2.5 : 4,
              py: isMobile ? 2 : 2.5,
              borderRadius: "16px",
              border: c.highlight
                ? "2px solid"
                : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              borderColor: c.highlight
                ? isDark
                  ? "#6A7BFF"
                  : "#4F46E5"
                : undefined,
              bgcolor: c.highlight
                ? isDark
                  ? "rgba(106,123,255,0.08)"
                  : "rgba(0,4,255,0.04)"
                : isDark
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(0,0,0,0.015)",
              textAlign: "center",
              minWidth: isMobile ? 100 : 150,
              transition: "all 0.4s ease",
              transform: isVisible ? "translateY(0)" : "translateY(15px)",
              opacity: isVisible ? 1 : 0,
              transitionDelay: `${idx * 100}ms`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {c.highlight && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "60%",
                  height: "2px",
                  background: "linear-gradient(90deg, #4F46E5, #6A4DFF)",
                  borderRadius: "0 0 2px 2px",
                }}
              />
            )}
            <Typography
              sx={{
                fontSize: "13px",
                fontFamily: "var(--font-sans)",
                color: c.highlight ? theme.palette.primary.main : theme.palette.text.secondary,
                mb: 0.5,
                fontWeight: c.highlight ? 600 : 400,
              }}
            >
              {c.name}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "22px" : "28px",
                fontFamily: "OutfitSemiBold",
                fontWeight: 700,
                color: c.highlight ? theme.palette.text.primary : theme.palette.text.secondary,
                lineHeight: 1.1,
              }}
            >
              {c.fee}
            </Typography>
            {c.extra && (
              <Typography
                sx={{
                  fontSize: "12px",
                  fontFamily: "var(--font-sans)",
                  color: c.highlight ? "#10B981" : theme.palette.text.secondary,
                  fontWeight: c.highlight ? 500 : 400,
                  mt: 0.3,
                }}
              >
                {c.extra}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Calculator */}
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <FeeCalculator compact />

        {/* Fee-free note below calculator */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            mt: 2,
            px: 2,
            py: 1.2,
            borderRadius: "12px",
            bgcolor: isDark ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.04)",
            border: `1px solid ${isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.12)"}`,
          }}
        >
          <Typography sx={{ fontSize: "14px", lineHeight: 1 }}>✨</Typography>
          <Typography
            sx={{
              fontSize: "13px",
              fontFamily: "var(--font-sans)",
              color: "#10B981",
              lineHeight: 1.4,
            }}
          >
            {t("feeCalcFeeFreeNote")}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <HomeButton
          variant="outlined"
          label={t("viewFullBreakdown")}
          navigateTo="/fees"
          showIcon
        />
      </Box>
    </section>
  );
};

export default memo(FeeSection);
