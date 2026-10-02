import React from "react";
import { Box, Typography } from "@mui/material";
import { useConsole } from "./tokens";

interface PageHeaderProps {
  title: string;
  /** Short context line beneath the title. */
  subtitle?: React.ReactNode;
  /** Right-aligned primary action (and any secondary controls). */
  action?: React.ReactNode;
  testid?: string;
}

/** The one page-header pattern used on every console page: title · context · primary action. */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, testid = "page-header" }) => {
  const t = useConsole();
  return (
    <Box
      data-testid={testid}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
        pb: 2.5,
        mb: 3,
        borderBottom: `1px solid ${t.hairline}`,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{
            fontFamily: "Manrope, var(--font-hero), sans-serif",
            fontSize: { xs: 20, sm: 24 },
            fontWeight: 600,
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            color: t.ink,
          }}
        >
          {title}
        </Typography>
        {subtitle != null && (
          <Typography sx={{ fontSize: 13.5, color: t.inkSecondary, mt: 0.5, maxWidth: 680 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action != null && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>{action}</Box>
      )}
    </Box>
  );
};

export default PageHeader;
