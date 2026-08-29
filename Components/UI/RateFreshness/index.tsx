import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

interface RateFreshnessProps {
  /** Epoch ms when the rate was last fetched/locked. Null → renders nothing. */
  updatedAt: number | null;
  /** Optional text color override (checkout uses a muted tone). */
  color?: string;
  /** Optional sx spacing overrides for the wrapper. */
  mt?: number;
}

/**
 * Subtle "Rate updated Xs ago" freshness hint with a live green pulse dot.
 * Ticks every second so the customer can trust the displayed rate is live.
 */
const RateFreshness: React.FC<RateFreshnessProps> = ({ updatedAt, color, mt = 0.5 }) => {
  const { t } = useTranslation("common");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!updatedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  if (!updatedAt) return null;

  const secs = Math.max(0, Math.floor((now - updatedAt) / 1000));
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  const label =
    secs < 3
      ? t("relativeTime.rateJustNow", { defaultValue: "Rate updated just now" })
      : secs < 60
        ? t("relativeTime.rateSecondsAgo", { count: secs, defaultValue: `Rate updated ${secs}s ago` })
        : t("relativeTime.rateMinutesSecondsAgo", {
            m: mins,
            s: rem,
            defaultValue: `Rate updated ${mins}m ${rem}s ago`,
          });

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
        {label}
      </Typography>
    </Box>
  );
};

export default RateFreshness;
