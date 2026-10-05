import React from "react";
import { Box, Typography } from "@mui/material";
import { useConsole, NUM_SX, STATUS_PALETTE, type StatusTone } from "./tokens";
import InfoHint from "@/Components/UI/InfoHint";

export interface SummaryItem {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Colours the value (use sparingly — only when the figure itself carries meaning). */
  tone?: StatusTone;
  testid?: string;
  /** Tooltip explaining exactly what the figure counts. */
  hint?: string;
}

interface SummaryStripProps {
  items: SummaryItem[];
  testid?: string;
}

/** A calm band of headline figures — large tabular numbers, hairline-separated. */
const SummaryStrip: React.FC<SummaryStripProps> = ({ items, testid = "summary-strip" }) => {
  const t = useConsole();
  return (
    <Box
      data-testid={testid}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` },
        border: `1px solid ${t.hairline}`,
        borderRadius: "12px",
        bgcolor: t.surface,
        overflow: "hidden",
        mb: 3,
      }}
    >
      {items.map((it, i) => {
        const toneColor = it.tone ? (t.isDark ? STATUS_PALETTE[it.tone].dark : STATUS_PALETTE[it.tone].light) : t.ink;
        // Shrink long figures to fit their tile (≈0.56em per tabular glyph).
        const em = (typeof it.value === "string" || typeof it.value === "number" ? String(it.value).length : 6) * 0.56;
        return (
          <Box
            key={it.testid || i}
            data-testid={it.testid || `summary-tile-${i}`}
            sx={{
              p: { xs: 1.75, sm: 2.75 },
              minWidth: 0,
              containerType: "inline-size",
              borderLeft: i > 0 ? { sm: `1px solid ${t.hairline}` } : "none",
              borderTop: { xs: i >= 2 ? `1px solid ${t.hairline}` : "none", sm: "none" },
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: t.inkSecondary,
                mb: 0.75,
              }}
            >
              {it.label}
              {it.hint && <InfoHint text={it.hint} testId={it.testid ? `${it.testid}-hint` : undefined} size={12} />}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: `min(24px, calc(100cqi / ${em.toFixed(2)}))`, sm: `min(30px, calc(100cqi / ${em.toFixed(2)}))` },
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                color: toneColor,
                ...NUM_SX,
              }}
            >
              {it.value}
            </Typography>
            {it.sub != null && (
              <Typography sx={{ fontSize: 12.5, color: t.inkMuted, mt: 0.5 }}>{it.sub}</Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default SummaryStrip;
