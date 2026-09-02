import CustomButton from "@/Components/UI/Buttons";
import { Icon } from "@/styles/uiKit";
import { Box, Typography, useTheme } from "@mui/material";
import React from "react";
import { Tw, tone } from "./types";

interface Props {
  remaining: number;
  totalSecs: number;
  lowTime: boolean;
  onLock: () => void;
  tw: Tw;
}

export const SessionStrip: React.FC<Props> = ({ remaining, totalSecs, lowTime, onLock, tw }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const c = tone(dark);
  const accent = lowTime ? c.amber : c.emerald;
  const soft = lowTime ? c.amberSoft : c.emeraldSoft;
  const pct = Math.max(0, Math.min(100, (remaining / Math.max(totalSecs, 1)) * 100));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <Box
      data-testid="wallet-manager-session-banner"
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        px: { xs: 2, sm: 3 },
        py: 1.25,
        backgroundColor: c.surface,
        borderBottom: `1px solid ${theme.palette.border?.main || theme.palette.divider}`,
        transition: "background-color 0.3s ease",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            backgroundColor: soft,
            color: accent,
            flexShrink: 0,
            transition: "background-color 0.3s ease, color 0.3s ease",
          }}
        >
          <Icon name={lowTime ? "clock" : "lock-open"} size={14} color={accent} />
          {/* icon-bundle literals: <Icon name="clock" /> <Icon name="lock-open" /> */}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)", lineHeight: 1.2, color: lowTime ? accent : theme.palette.text.primary }}
          >
            {lowTime ? tw("sudoEndingSoonBanner", "Ending soon") : tw("sudoUnlockedBanner", "Unlocked")}
          </Typography>
          <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
            <Box component="span" data-testid="wallet-manager-countdown" sx={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: lowTime ? accent : theme.palette.text.primary }}>
              {mm}:{ss}
            </Box>{" "}
            {tw("sudoRemaining", "remaining")} · {tw("sudoNoMoreCodes", "no more codes needed")}
          </Typography>
        </Box>
      </Box>
      <CustomButton
        label={tw("sudoLockNow", "Lock now")}
        variant="outlined"
        size="small"
        onClick={onLock}
        startIcon={<Icon name="lock" size={13} />}
        data-testid="wallet-manager-lock-btn"
        sx={{ height: 32, px: 1.5, fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          left: 0,
          bottom: -1,
          height: 2,
          width: `${pct}%`,
          backgroundColor: accent,
          transition: "width 1s linear, background-color 0.3s ease",
        }}
      />
    </Box>
  );
};
