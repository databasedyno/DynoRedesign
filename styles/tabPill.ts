import type { Theme } from "@mui/material";

/** The ONE "selected tab / filter chip" look (dark pill) — tabs, status chips, segment filters. */
export const tabPillActive = (theme: Theme) => {
  const dark = theme.palette.mode === "dark";
  return {
    backgroundColor: dark ? "rgba(255,255,255,0.12)" : "#111214",
    color: dark ? theme.palette.text.primary : "#FFFFFF",
    borderColor: "transparent",
  };
};

/** Hover tint for an idle tab / chip. */
export const tabPillHover = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#E7E8EE");
