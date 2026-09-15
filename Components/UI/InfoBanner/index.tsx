import InfoIcon from "@/assets/Icons/info-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React from "react";
import { WarningIconContainer } from "../AddWalletModal/styled";

export type InfoBannerProps = {
  /** Message to display (e.g. "Please add a USDT/USDC payout address first.") */
  message: string;
  /** Optional custom content instead of message */
  children?: React.ReactNode;
  /** Optional sx for the root container */
  sx?: object;
};

/**
 * Info banner with rounded corners, light blue/lavender background,
 * dark circle with info icon on the left, and message text.
 * Use for prerequisites or informational callouts.
 */
export default function InfoBanner({ message, children, sx }: InfoBannerProps) {
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: "12px",
        px: 2,
        borderRadius: "8px",
        // Theme-aware: the old hardcoded light lavender (#E8EBFB) made the
        // near-white dark-mode text unreadable (session 15 fix).
        bgcolor: isDark ? "rgba(122,139,255,0.14)" : "#E8EBFB",
        border: isDark ? "1px solid rgba(122,139,255,0.25)" : "none",
        width: "fit-content",
        ...sx,
      }}
    >
      <WarningIconContainer>
        <Image
          src={InfoIcon}
          alt="info icon"
          width={16}
          height={16}
          draggable={false}
          style={{ marginTop: "-2px" }}
          className="themed-icon"
        />
      </WarningIconContainer>
      {children ?? (
        <Typography
          variant="body2"
          sx={{
            color: "text.primary",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
            lineHeight: "16px",
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
}
