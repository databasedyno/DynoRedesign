import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import Logo from "@/assets/Icons/Logo";

/**
 * PageUnavailable — a single, reusable, on-brand screen shown whenever a
 * public page can't be displayed: an unpublished creator page, a disabled
 * product storefront, a product that no longer exists, a bad URL (404), or
 * any other error surfaced by _error.tsx.
 *
 * One unified message everywhere ("This page isn't available"), fully
 * dark/light aware (reads the active MUI theme), with the Dynopay brand mark
 * and a subtle "Powered by Dynopay" link to the marketing site.
 *
 * Rendered with `layout="none"` so it never inherits auth/app chrome.
 */

// Marketing site — falls back to the canonical domain when NEXT_PUBLIC_SERVER_URL
// is empty (as it is in preview, where browser calls are relative).
const MARKETING_URL =
  (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "") || "https://dynopay.com";

export interface PageUnavailableProps {
  /** Optional override — defaults to the unified brand message. */
  title?: string;
  description?: string;
}

const PageUnavailable = ({
  title = "This page isn't available",
  description = "The page you're looking for may have been moved, unpublished, or no longer exists.",
}: PageUnavailableProps) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Theme-aware tokens (work across the app's home/auth/app palettes).
  const ink = isDark ? "#F5F5F5" : "#0A0A0A";
  const muted = isDark ? "rgba(245,245,245,0.62)" : "rgba(10,10,10,0.58)";
  const faint = isDark ? "rgba(245,245,245,0.42)" : "rgba(10,10,10,0.42)";
  const surface = isDark ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.03)";
  const border = isDark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.10)";
  const accent = theme.palette.primary?.main || "#5A6BEF";
  const bg = theme.palette.background?.default || (isDark ? "#08080A" : "#FAFAFA");

  return (
    <Box
      data-testid="page-unavailable"
      sx={{
        position: "relative",
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 6,
        bgcolor: bg,
        color: ink,
        fontFamily: "var(--font-sans)",
        overflow: "hidden",
      }}
    >
      {/* Soft brand glow behind the hero — subtle, premium, non-distracting */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "34%",
          left: "50%",
          width: 520,
          height: 520,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}1F 0%, ${accent}00 70%)`,
          filter: "blur(8px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Brand wordmark */}
      <Box
        component="a"
        href={MARKETING_URL}
        aria-label="Dynopay home"
        sx={{
          position: "absolute",
          top: { xs: 24, md: 32 },
          left: "50%",
          transform: "translateX(-50%)",
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          textDecoration: "none",
          zIndex: 2,
        }}
      >
        <Logo width={26} height={31} />
        <Typography
          component="span"
          sx={{
            color: ink,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          dynopay
          <Typography component="sup" sx={{ fontSize: 9, fontWeight: 600, ml: "1px", color: faint }}>
            ™
          </Typography>
        </Typography>
      </Box>

      {/* Hero content */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 460,
        }}
      >
        {/* Glyph — "hidden / not visible" eye-off, relevant to unpublished pages */}
        <Box
          sx={{
            width: 84,
            height: 84,
            borderRadius: "22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: surface,
            border: `1px solid ${border}`,
            mb: 3.5,
            boxShadow: isDark ? "none" : "0 1px 2px rgba(10,10,10,0.04)",
          }}
        >
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        </Box>

        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 26, md: 30 },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: ink,
            mb: 1.25,
          }}
        >
          {title}
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: 15, md: 16 },
            lineHeight: 1.55,
            color: muted,
            maxWidth: 380,
          }}
        >
          {description}
        </Typography>
      </Box>

      {/* Subtle "Powered by Dynopay" marketing link */}
      <Box
        component="a"
        href={MARKETING_URL}
        data-testid="page-unavailable-powered-by"
        sx={{
          position: "absolute",
          bottom: { xs: 28, md: 36 },
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          textDecoration: "none",
          color: faint,
          fontSize: 13,
          whiteSpace: "nowrap",
          transition: "color 0.15s ease",
          "&:hover": { color: muted },
        }}
      >
        <Box
          aria-hidden
          sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: accent, flexShrink: 0 }}
        />
        <Typography component="span" sx={{ fontSize: 13, color: "inherit" }}>
          Powered by{" "}
          <Typography component="span" sx={{ fontWeight: 700, color: isDark ? "#F5F5F5" : "#0A0A0A" }}>
            Dynopay
          </Typography>{" "}
          — Accept crypto payments
        </Typography>
      </Box>
    </Box>
  );
};

export default PageUnavailable;
