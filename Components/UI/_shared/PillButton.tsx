import { Button, styled } from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/**
 * PillButton — the timeframe / filter / segment chip pattern used across the
 * app (e.g. `7D · 30D · 90D · 1Y · Custom` on the dashboard hero, filter
 * chips on `/transactions`, product-category chips on `/hostbay/shop`).
 *
 * Re-exported at the shared UI level so pages outside the dashboard folder
 * don't reach into `Components/Page/Dashboard/coinbase/styled` for this
 * primitive.
 *
 * `active` toggles the aurora indigo fill; unstyled chips stay hairline.
 */
export const PillButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => {
  const dark = theme.palette.mode === "dark";
  return {
    minWidth: 0,
    padding: "6px 14px",
    borderRadius: 999,
    fontFamily: "var(--font-sans), var(--font-body)",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "none",
    lineHeight: 1,
    letterSpacing: 0.1,
    color: active
      ? "#FFFFFF"
      : (dark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight),
    backgroundColor: active
      ? (dark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light)
      : "transparent",
    border: `1px solid ${
      active
        ? "transparent"
        : (dark ? CB_TOKENS.border.dark : CB_TOKENS.border.light)
    }`,
    boxShadow: "none",
    transition: "background-color 160ms ease, color 160ms ease, border-color 160ms ease",
    "&:hover": {
      backgroundColor: active
        ? (dark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light)
        : (dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)"),
      borderColor: active
        ? "transparent"
        : (dark ? "rgba(255,255,255,0.18)" : "rgba(10,10,15,0.18)"),
    },
    "&:focus-visible": {
      outline: `2px solid ${dark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`,
      outlineOffset: 2,
    },
  };
});
