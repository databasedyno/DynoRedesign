import { Box, styled } from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * SurfaceCard — the shared rounded card used across every fold outside the
 * dashboard v2026 shell (which has its own local `SurfaceCard`). Lifted here
 * so pages in `pages/*` — auth split-screens, invoice editor drawer, wallet
 * tiles, product-catalog cards, admin tables — all sit on the same surface.
 *
 * Design tokens (radius 20, hairline border, subtle inset glow on dark)
 * mirror the shipped v2026 primitive by re-using CB_TOKENS. The only reason
 * this file exists is to give pages outside the dashboard folder a
 * dependency-free import path so they don't reach into
 * `Components/Page/Dashboard/coinbase/styled` — that would be an inversion
 * (dashboard-internal primitives leaking into unrelated pages).
 */
export const SurfaceCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "elevated" && prop !== "accent",
})<{ elevated?: boolean; accent?: "indigo" | "violet" | "volt" | "coral" }>(
  ({ theme, elevated, accent }) => {
    const dark = theme.palette.mode === "dark";
    const accentColor =
      accent === "violet"
        ? "#7C5CFF"
        : accent === "volt"
          ? (dark ? "#CCFF00" : "#5A6B00")
          : accent === "coral"
            ? "#FF5B49"
            : (dark ? "#818CF8" : BRAND_ACCENT); // indigo default

    return {
      position: "relative",
      borderRadius: 20,
      padding: theme.spacing(3),
      backgroundColor: dark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
      border: `1px solid ${dark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
      boxShadow: elevated
        ? (dark
            ? "0 12px 40px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.03) inset"
            : "0 12px 32px rgba(10,10,15,0.06)")
        : (dark
            ? "0 1px 0 rgba(255,255,255,0.02) inset"
            : "0 1px 3px rgba(10,10,15,0.04)"),
      transition: "border-color 200ms ease, box-shadow 200ms ease",
      // Aurora accent top-bar — only rendered when `accent` prop is passed.
      ...(accent && {
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: accentColor,
        },
      }),
      [theme.breakpoints.down("sm")]: {
        padding: theme.spacing(2.25),
        borderRadius: 16,
      },
    };
  }
);
