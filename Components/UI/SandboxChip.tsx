import React from "react";
import { Box, Tooltip, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

/** Marks a simulated (sandbox) payment so it is never mistaken for real money. */
export const SandboxChip: React.FC<{ size?: "sm" | "md"; "data-testid"?: string }> = ({ size = "sm", ...rest }) => {
  const theme = useTheme();
  const { t } = useTranslation("transactions");
  const isDark = theme.palette.mode === "dark";
  return (
    <Tooltip title={t("sandboxTooltip", { defaultValue: "Simulated test payment — no crypto moved and nothing was forwarded to your wallet." })} arrow>
      <Box
        component="span"
        data-testid={rest["data-testid"] || "sandbox-chip"}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          px: size === "sm" ? 0.75 : 1,
          py: size === "sm" ? "1px" : "3px",
          borderRadius: "999px",
          fontFamily: "var(--font-sans)",
          fontSize: size === "sm" ? 10 : 11.5,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
          border: `1px dashed ${isDark ? "rgba(255,255,255,0.35)" : "rgba(15,15,20,0.35)"}`,
          color: theme.palette.text.secondary,
          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,15,20,0.04)",
        }}
      >
        {t("sandbox", { defaultValue: "Sandbox" })}
      </Box>
    </Tooltip>
  );
};

export default SandboxChip;
