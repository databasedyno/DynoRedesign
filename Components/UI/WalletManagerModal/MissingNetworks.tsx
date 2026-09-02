import type { Cryptocurrency } from "@/utils/types/wallet";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React from "react";
import { Tw, tone } from "./types";

interface Props {
  missing: Cryptocurrency[];
  onPick: (code: string) => void;
  tw: Tw;
}

export const MissingNetworks: React.FC<Props> = ({ missing, onPick, tw }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const border = theme.palette.border?.main || theme.palette.divider;
  if (missing.length === 0) return null;

  return (
    <Box data-testid="wallet-manager-missing" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
        {tw("missingHint", "Not set up yet — tap to add:")}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {missing.map((m) => (
          <Box
            key={m.code}
            component="button"
            type="button"
            onClick={() => onPick(m.code)}
            data-testid={`wallet-manager-missing-${m.code}`}
            sx={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              height: 30,
              px: 1.25,
              borderRadius: "6px",
              border: `1px solid ${border}`,
              backgroundColor: theme.palette.background.paper,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: theme.palette.text.primary,
              transition: "border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease",
              "&:hover": { borderColor: c.indigo, backgroundColor: c.indigoSoft, transform: "translateY(-1px)" },
              "&:focus-visible": { boxShadow: `0 0 0 2px ${c.indigo}` },
            }}
          >
            <Image src={m.icon} alt={m.name} width={14} height={14} draggable={false} />
            {m.code}
          </Box>
        ))}
      </Box>
    </Box>
  );
};
