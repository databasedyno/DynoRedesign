import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

interface RateFreshnessProps {
  /** Epoch ms when the rate was last fetched/locked. Null → renders nothing. */
  updatedAt: number | null;
  /** Optional text color override (checkout uses a muted tone). */
  color?: string;
  /** Optional sx spacing overrides for the wrapper. */
  mt?: number;
}

function formatAgo(secs: number): string {
  if (secs < 3) return "Rate updated just now";
  if (secs < 60) return `Rate updated ${secs}s ago`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `Rate updated ${m}m ${s}s ago`;
}

/**
 * Subtle "Rate updated Xs ago" freshness hint with a live green pulse dot.
 * Ticks every second so the customer can trust the displayed rate is live.
 */
const RateFreshness: React.FC<RateFreshnessProps> = ({ updatedAt, color, mt = 0.5 }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!updatedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  if (!updatedAt) return null;

  const secs = Math.max(0, Math.floor((now - updatedAt) / 1000));

  return (
    <Box
      data-testid="rate-freshness"
      sx={{ display: "flex", alignItems: "center", gap: 0.6, mt }}
    >
      <Box
        component="span"
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: "#22c55e",
          boxShadow: "0 0 0 3px rgba(34,197,94,0.18)",
          flexShrink: 0,
          "@keyframes rateFreshnessPulse": {
            "0%": { opacity: 1 },
            "50%": { opacity: 0.35 },
            "100%": { opacity: 1 },
          },
          animation: "rateFreshnessPulse 1.6s ease-in-out infinite",
        }}
      />
      <Typography
        sx={{ fontSize: 11.5, color: color || "text.secondary", lineHeight: 1 }}
      >
        {formatAgo(secs)}
      </Typography>
    </Box>
  );
};

export default RateFreshness;
