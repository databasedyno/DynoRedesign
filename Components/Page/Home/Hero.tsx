import HomeButton from "@/Components/Layout/HomeButton";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import useIsMobile from "@/hooks/useIsMobile";
import BTC from "@/assets/Icons/coins/BTC";
import USDT from "@/assets/Icons/coins/USDT";
import { Box, Typography, useTheme } from "@mui/material";
import { Bolt } from "@mui/icons-material";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ButtonsRow, Root, TopSection } from "./styled";

const HeroSection = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("landing");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Step icons — real coin SVGs / chain-native icons (not generic emoji)
  const steps = [
    {
      iconNode: <BTC width={28} height={28} />,
      gradient: "linear-gradient(135deg, #F7931A 0%, #FF9500 100%)",
      title: t("heroStep1"),
      sub: t("heroStep1Sub"),
    },
    {
      iconNode: <Bolt sx={{ fontSize: 30, color: "#fff" }} />,
      gradient: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
      title: t("heroStep2"),
      sub: t("heroStep2Sub"),
    },
    {
      iconNode: <USDT width={28} height={28} />,
      gradient: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
      title: t("heroStep3"),
      sub: t("heroStep3Sub"),
    },
  ];

  return (
    <Root>
      <TopSection>
        <HomeSectionTitle
          type="large"
          headingAs="h1"
          badgeText={t("heroBadge")}
          title={t("heroTitle")}
          highlightText={t("heroHighlight")}
          subtitle={t("heroSubtitle")}
        />

        <ButtonsRow>
          <HomeButton variant="primary" label={t("startAcceptingCrypto")} navigateTo="/auth/register" />
          <HomeButton variant="outlined" label="View Documentation" navigateTo="/documentation" showIcon={false} />
        </ButtonsRow>

        {/* Trust micro-copy */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            mt: 2,
            opacity: 0.7,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: "#10B981",
            }}
          />
          <Typography
            sx={{
              fontSize: "13px",
              fontFamily: "OutfitRegular",
              color: theme.palette.text.secondary,
            }}
          >
            {t("heroTrust")}
          </Typography>
        </Box>

        {/* Fee-free promotion badge */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mt: 1.5,
          }}
        >
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.8,
              px: 2,
              py: 0.8,
              borderRadius: "20px",
              border: `1px solid ${isDark ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.25)"}`,
              bgcolor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
              transition: "all 0.3s ease",
              "&:hover": {
                bgcolor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.1)",
                transform: "translateY(-1px)",
              },
            }}
          >
            <Typography
              sx={{
                fontSize: "13px",
                lineHeight: 1,
              }}
            >
              🎉
            </Typography>
            <Typography
              sx={{
                fontSize: "13px",
                fontFamily: "OutfitMedium",
                fontWeight: 500,
                color: "#10B981",
                lineHeight: 1,
              }}
            >
              {t("heroFeeFree")}
            </Typography>
          </Box>
        </Box>
      </TopSection>

      {/* 3-Step Flow Visual */}
      <Box
        sx={{
          mt: isMobile ? 5 : 8,
          mb: isMobile ? 3 : 6,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: isMobile ? 3 : 2,
          position: "relative",
        }}
      >
        {steps.map((step, idx) => (
          <Box
            key={step.title}
            sx={{
              display: "flex",
              flexDirection: isMobile ? "row" : "column",
              alignItems: "center",
              gap: isMobile ? 2.5 : 1.5,
              flex: isMobile ? undefined : 1,
              maxWidth: isMobile ? "100%" : 280,
              width: isMobile ? "100%" : undefined,
            }}
          >
            {/* Arrow between steps (desktop) */}
            {idx > 0 && !isMobile && (
              <Box
                sx={{
                  position: "absolute",
                  top: "28px",
                  left: `calc(${(idx * 100) / 3}% + ${idx === 1 ? "2%" : "2%"})`,
                  transform: "translateX(-50%)",
                  color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                  fontSize: "28px",
                  fontWeight: 300,
                  userSelect: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                →
              </Box>
            )}

            {/* Icon circle — chain-native SVG instead of plain emoji */}
            <Box
              sx={{
                width: 56,
                height: 56,
                minWidth: 56,
                borderRadius: "16px",
                background: step.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: `0 8px 24px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.1)"}`,
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                "& > *": {
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
                },
                "&:hover": {
                  transform: "scale(1.08) translateY(-2px)",
                  boxShadow: `0 12px 32px ${isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.15)"}`,
                },
              }}
            >
              {step.iconNode}
            </Box>

            {/* Text */}
            <Box
              sx={{
                textAlign: isMobile ? "left" : "center",
              }}
            >
              <Typography
                sx={{
                  fontSize: isMobile ? "16px" : "17px",
                  fontFamily: "OutfitSemiBold",
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                  lineHeight: 1.3,
                }}
              >
                {step.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  fontFamily: "OutfitRegular",
                  color: theme.palette.text.secondary,
                  mt: 0.3,
                  lineHeight: 1.4,
                }}
              >
                {step.sub}
              </Typography>
            </Box>

            {/* Arrow between steps (mobile) */}
            {idx < steps.length - 1 && isMobile && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  width: "100%",
                  color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                  fontSize: "20px",
                  transform: "rotate(90deg)",
                  mt: -1,
                  mb: -1,
                }}
              >
                →
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Root>
  );
};

export default memo(HeroSection);
