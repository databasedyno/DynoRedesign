import { Box, Typography, useTheme } from "@mui/material";
import React from "react";

interface Props {
  label: string;
  count?: number;
  hint?: string;
  action?: React.ReactNode;
  testId?: string;
}

export const SectionLabel: React.FC<Props> = ({ label, count, hint, action, testId }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.25 }} data-testid={testId}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography
          sx={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
        >
          {label}
        </Typography>
        {typeof count === "number" && (
          <Typography sx={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: theme.palette.text.secondary }}>{count}</Typography>
        )}
      </Box>
      {action ||
        (hint && (
          <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>{hint}</Typography>
        ))}
    </Box>
  );
};
