import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

export const StepHeader: React.FC<{ eyebrow: string; title: string; subtitle: string }> = ({ eyebrow, title, subtitle }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box sx={{ mb: { xs: 2.5, md: 3 } }}>
      <Box
        sx={{
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
        }}
      >
        {eyebrow}
      </Box>
      <Box
        component="h2"
        data-testid="gs-step-title"
        sx={{
          m: 0,
          mt: 0.75,
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontSize: { xs: 20, md: 24 },
          lineHeight: 1.2,
          color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
        }}
      >
        {title}
      </Box>
      <Box
        sx={{
          mt: 0.75,
          maxWidth: 620,
          fontFamily: "var(--font-sans)",
          fontSize: { xs: 13.5, md: 14.5 },
          lineHeight: 1.55,
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
        borderTop: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
        display: "flex",
        flexDirection: { xs: "column-reverse", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        gap: 1.5,
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
              px: 1.5,
              border: 0,
              borderRadius: 999,
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 600,
              color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
              "&:hover, &:focus-visible": {
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.035)",
                outline: "none",
              },
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
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.25, "& button": { minHeight: 46 } }}>
        {secondaryLabel && onSecondary && (
          <CustomButton label={secondaryLabel} variant="secondary" onClick={onSecondary} data-testid={secondaryTestId} />
        )}
        <CustomButton
          label={primaryLabel}
          variant="primary"
          onClick={onPrimary}
          disabled={primaryDisabled}
          loading={primaryLoading}
          data-testid={primaryTestId}
        />
      </Box>
    </Box>
  );
};
