import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

const HERO = "var(--font-hero), var(--font-sans)";
const MONO = "var(--font-tech), var(--font-mono, monospace)";
const GOLD = "#FFD100";

export const StepHeader: React.FC<{ eyebrow: string; title: string; subtitle: string }> = ({ eyebrow, title, subtitle }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box sx={{ mb: { xs: 2.5, md: 3.5 } }}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
          "&::before": { content: '""', width: 6, height: 6, borderRadius: "50%", backgroundColor: GOLD, boxShadow: `0 0 10px ${GOLD}` },
        }}
      >
        {eyebrow}
      </Box>
      <Box
        component="h2"
        data-testid="gs-step-title"
        sx={{
          m: 0,
          mt: 1,
          fontFamily: HERO,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          fontSize: { xs: 22, md: 28 },
          lineHeight: 1.15,
          color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
        }}
      >
        {title}
      </Box>
      <Box
        sx={{
          mt: 1,
          maxWidth: 620,
          fontFamily: "var(--font-sans)",
          fontSize: { xs: 13.5, md: 14.5 },
          lineHeight: 1.6,
          color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
        }}
      >
        {subtitle}
      </Box>
    </Box>
  );
};

interface FooterProps {
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTestId?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryTestId?: string;
  note?: string;
}

export const StepFooter: React.FC<FooterProps> = ({
  onBack,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  primaryTestId = "gs-step-primary",
  secondaryLabel,
  onSecondary,
  secondaryTestId = "gs-step-secondary",
  note,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  return (
    <Box
      sx={{
        mt: { xs: 3, md: 4 },
        pt: { xs: 2.5, md: 3 },
        borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.07)"}`,
        display: "flex",
        flexDirection: { xs: "column-reverse", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        gap: 1.5,
        // G: on short viewports the primary CTA was below the fold — pin the
        // footer to the bottom of the card so it's always reachable without
        // scrolling. Spans to the card edges (card padding is 2.5 / 4.5).
        "@media (max-height: 820px)": {
          position: "sticky",
          bottom: 0,
          zIndex: 3,
          mt: { xs: 2, md: 2.5 },
          mx: { xs: -2.5, md: -4.5 },
          px: { xs: 2.5, md: 4.5 },
          pb: { xs: 2, md: 2.5 },
          background: isDark ? "rgba(20,20,26,0.92)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: isDark ? "0 -8px 24px rgba(0,0,0,0.4)" : "0 -8px 24px rgba(0,0,0,0.08)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {onBack && (
          <Box
            component="button"
            type="button"
            data-testid="gs-step-back"
            onClick={onBack}
            sx={{
              minHeight: 44,
              px: 1.75,
              border: `1px solid ${isDark ? "rgba(255,255,255,0.09)" : "rgba(18,18,20,0.08)"}`,
              borderRadius: 999,
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 600,
              color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
              transition: "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
              "&:hover": {
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(18,18,20,0.035)",
                borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(18,18,20,0.16)",
                transform: "translateY(-1px)",
              },
              "&:focus-visible": { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
            }}
          >
            ← {t("gs.back", { defaultValue: "Back" })}
          </Box>
        )}
        {note && (
          <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight }}>
            {note}
          </Box>
        )}
      </Box>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.25, "& button": { minHeight: 48 } }}>
        {secondaryLabel && onSecondary && (
          <CustomButton label={secondaryLabel} variant="secondary" pill onClick={onSecondary} data-testid={secondaryTestId} sx={{ height: 48, minHeight: 48, px: 3 }} />
        )}
        <CustomButton
          label={primaryLabel}
          variant="primary"
          pill
          onClick={onPrimary}
          disabled={primaryDisabled}
          loading={primaryLoading}
          data-testid={primaryTestId}
          sx={{ height: 48, minHeight: 48, px: 3.5 }}
        />
      </Box>
    </Box>
  );
};
