import React from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/**
 * DashboardPreview — wraps the REAL dashboard widgets for a merchant who has
 * not been paid yet: faded, non-interactive (pointer-events off + inert) and
 * softly masked towards the bottom, with one label explaining what it is.
 */
const DashboardPreview: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;

  return (
    <Box data-testid="gs-dashboard-preview" sx={{ position: "relative" }}>
      <Box
        data-testid="gs-dashboard-preview-label"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.5,
          py: 0.625,
          mb: 1.5,
          borderRadius: 999,
          border: `1px dashed ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
          fontFamily: "var(--font-sans)",
          fontSize: 12.5,
          fontWeight: 600,
          color: muted,
          maxWidth: "100%",
        }}
      >
        <Icon name="eye" size={14} />
        <Box component="span" sx={{ minWidth: 0 }}>
          {t("gs.previewLabel", {
            defaultValue: "Preview — your live numbers appear here after your first payment",
          })}
        </Box>
      </Box>
      <Box
        data-testid="gs-dashboard-preview-content"
        aria-hidden
        {...({ inert: "" } as Record<string, unknown>)}
        sx={{
          pointerEvents: "none",
          userSelect: "none",
          opacity: isDark ? 0.42 : 0.5,
          filter: "saturate(0.55)",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, md: 2.5 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default DashboardPreview;
