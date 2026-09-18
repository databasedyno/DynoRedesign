import React from "react";
import { Box, useTheme } from "@mui/material";
import { statusTone, statusLabel, toneColors, Tone } from "./escrowUtils";
import type { EscrowDeal } from "@/api/escrow";

/** Pill that renders a deal status (or an arbitrary tone/label) consistently. */
export default function StatusChip({
  deal,
  tone,
  label,
  size = "md",
  testId,
}: {
  deal?: Pick<EscrowDeal, "status" | "status_label">;
  tone?: Tone;
  label?: string;
  size?: "sm" | "md";
  testId?: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const resolvedTone: Tone = tone || (deal ? statusTone(deal.status) : "neutral");
  const resolvedLabel = label || (deal ? statusLabel(deal) : "");
  const c = toneColors(resolvedTone, isDark);
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: size === "sm" ? 0.9 : 1.2,
        py: size === "sm" ? 0.25 : 0.4,
        borderRadius: 999,
        fontSize: size === "sm" ? 11 : 12.5,
        fontWeight: 600,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        color: c.fg,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      {resolvedLabel}
    </Box>
  );
}
