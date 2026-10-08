import { useMediaQuery } from "@mui/material";
import { SHELL_Q } from "@/styles/shellTokens";

export type ShellMode = "phone" | "tablet" | "desktop";

export interface ShellState {
  mode: ShellMode;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Touch-first pointer (phones, iPads, Android tablets). */
  coarse: boolean;
  /** Viewport height ≤ 860px — the sidebar switches to compact rows. */
  short: boolean;
  /** Touch tablets get a labelled rail (icon + caption) instead of hover-only tooltips. */
  labelledRail: boolean;
}

/** Single source of truth for which app frame to render (shellTokens.ts). */
export default function useShellMode(): ShellState {
  const isPhone = useMediaQuery(SHELL_Q.phone, { noSsr: true });
  const isTablet = useMediaQuery(SHELL_Q.tablet, { noSsr: true });
  const coarse = useMediaQuery(SHELL_Q.coarse, { noSsr: true });
  const short = useMediaQuery(SHELL_Q.short, { noSsr: true });
  const mode: ShellMode = isPhone ? "phone" : isTablet ? "tablet" : "desktop";
  return {
    mode,
    isPhone,
    isTablet,
    isDesktop: mode === "desktop",
    coarse,
    short,
    labelledRail: isTablet && coarse,
  };
}
