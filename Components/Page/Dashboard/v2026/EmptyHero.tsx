import React from "react";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { SurfaceCard, Eyebrow, CB_TOKENS } from "../coinbase/styled";
import { Icon } from "@/styles/uiKit";

/**
 * EmptyHero — shown when a merchant has an account but zero lifetime volume
 * (and isn't in the activation-checklist flow). Preserves the encouraging
 * "make your first sale" nudge that used to live inside VolumeHero.
 */
const EmptyHero: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const { t } = useTranslation(["dashboardLayout", "common"]);

  return (
    <SurfaceCard
      data-testid="dash2026-hero-empty"
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: { xs: 260, md: 320 },
      }}
    >
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: { xs: 1.5, md: 2 }, maxWidth: 460 }}
      >
        <Box
          sx={{
            width: { xs: 46, md: 52 },
            height: { xs: 46, md: 52 },
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
            backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow,
          }}
        >
          <Icon name="rocket" size={isMobile ? 22 : 26} />
        </Box>
        <Eyebrow>{t("heroEmptyEyebrow", { defaultValue: "Welcome to Dynopay" })}</Eyebrow>
        <Box
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            fontSize: { xs: 24, md: 30 },
            lineHeight: 1.15,
            color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
          }}
        >
          {t("heroEmptyTitle", { defaultValue: "Make your first sale" })}
        </Box>
        <Box
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: { xs: 14, md: 15 },
            lineHeight: 1.55,
            color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
          }}
        >
          {t("heroEmptyDesc", {
            defaultValue:
              "Create a payment link or set up your storefront — your volume, payments and growth will show up here in real time.",
          })}
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.25,
            mt: 0.5,
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <CustomButton
            label={t("heroEmptyCta", { defaultValue: "Create your first payment link" })}
            variant="primary"
            size="medium"
            fullWidth={isMobile}
            startIcon={<Icon name="plus" size={18} />}
            data-testid="dash2026-hero-empty-cta"
            onClick={() => router.push("/create-pay-link")}
          />
          <CustomButton
            label={t("heroEmptyCta2", { defaultValue: "Set up storefront" })}
            variant="outlined"
            size="medium"
            fullWidth={isMobile}
            data-testid="dash2026-hero-empty-cta2"
            onClick={() => router.push("/creator")}
          />
        </Box>
      </Box>
    </SurfaceCard>
  );
};

export default EmptyHero;
