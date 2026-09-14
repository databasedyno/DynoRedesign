import React from "react";
import { Box, Typography } from "@mui/material";
import { getAssetColor } from "@/helpers/assetColor";

/**
 * CoinChips — renders one or more accepted crypto currencies as small,
 * coin-tinted pills (a colour dot + the ticker). Used to "coin-tint" list
 * cells like the Payment Links crypto column so they match the Transactions
 * table's coin colouring. Caps the visible count and shows a "+N" overflow.
 */
export interface CoinChipsProps {
  value?: string | string[] | null;
  max?: number;
  size?: "sm" | "xs";
}

const CoinChips = ({ value, max = 3, size = "sm" }: CoinChipsProps) => {
  const coins = (Array.isArray(value) ? value.join(",") : String(value || ""))
    .split(/[,\s/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (coins.length === 0) {
    return (
      <Box component="span" sx={{ color: "text.secondary", fontFamily: "var(--font-sans)" }}>
        —
      </Box>
    );
  }

  const shown = coins.slice(0, max);
  const extra = coins.length - shown.length;
  const fs = size === "xs" ? 10 : 12;

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
      {shown.map((c) => {
        const color = getAssetColor(c);
        return (
          <Box
            key={c}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              px: "8px",
              py: "3px",
              borderRadius: 999,
              backgroundColor: `${color}14`,
              border: `1px solid ${color}2E`,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
            <Typography
              component="span"
              sx={{
                fontSize: fs,
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                lineHeight: 1,
                color: "text.primary",
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </Typography>
          </Box>
        );
      })}
      {extra > 0 && (
        <Typography
          component="span"
          sx={{ fontSize: fs, fontWeight: 600, fontFamily: "var(--font-sans)", color: "text.secondary" }}
        >
          +{extra}
        </Typography>
      )}
    </Box>
  );
};

export default CoinChips;
