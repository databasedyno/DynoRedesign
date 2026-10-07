import React from "react";
import { Box, Button, ButtonProps, Typography, useTheme } from "@mui/material";

/* ============================================================================
 * Landing "Operations Console" kit (2026-10 Trust & Clarity rebuild).
 *
 * The public homepage adopts the signed-in app's Mercury-style design system:
 * calm, dark-first, LEFT-ALIGNED, almost flat, separated by hairline borders
 * and whitespace — no aurora glows, no gradient text, no centered hero.
 *
 * Fonts map to the app's own CSS variables so the landing always matches the
 * chrome: Manrope display (--font-hero), IBM Plex Sans body (--font-body),
 * IBM Plex Mono for figures/IDs (--font-tech). Gold (#FFD100) is reserved for
 * primary actions and a single key highlight — never a general wash.
 * Tokens mirror /app/design_guidelines.json exactly.
 * ========================================================================== */

export const FONT_DISPLAY = "var(--font-hero)"; // Manrope
export const FONT_BODY = "var(--font-body)"; // IBM Plex Sans
export const FONT_MONO = "var(--font-tech)"; // IBM Plex Mono

export const GOLD = "#FFD100";
export const GOLD_HOVER = "#FFDC3D";
export const ON_GOLD = "#1A1A19";

export interface ConsoleTokens {
  dark: boolean;
  canvas: string;
  surface: string;
  raised: string;
  line: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  ink3: string;
  /** Brand-tinted text/icon colour legible on the current surface. */
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  successSoft: string;
}

const DARK: ConsoleTokens = {
  dark: true,
  canvas: "#131312",
  surface: "#1A1A19",
  raised: "#222221",
  line: "rgba(255,255,255,0.07)",
  lineStrong: "rgba(255,255,255,0.15)",
  ink: "#F2F2F0",
  ink2: "#A3A3A0",
  ink3: "#8A8A86",
  accent: "#FFD100",
  accentSoft: "rgba(255,209,0,0.10)",
  onAccent: "#1A1A19",
  success: "#4ADE80",
  successSoft: "rgba(74,222,128,0.12)",
};

const LIGHT: ConsoleTokens = {
  dark: false,
  canvas: "#F9F9F8",
  surface: "#FFFFFF",
  raised: "#FFFFFF",
  line: "rgba(0,0,0,0.08)",
  lineStrong: "rgba(0,0,0,0.14)",
  ink: "#1A1A19",
  ink2: "#666664",
  ink3: "#6E6E6C",
  accent: "#8A6D00", // gold is unreadable on white — use a deep gold for text/icons
  accentSoft: "rgba(255,209,0,0.16)",
  onAccent: "#1A1A19",
  success: "#2E7D32",
  successSoft: "rgba(46,125,50,0.10)",
};

export const useConsole = (): ConsoleTokens => (useTheme().palette.mode === "dark" ? DARK : LIGHT);

/* ── Eyebrow: small uppercase mono tag (accent ink) ───────────────────────── */
export const Eyebrow: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => {
  const s = useConsole();
  return (
    <Typography
      component="p"
      sx={{
        fontFamily: FONT_MONO,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: s.accent,
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        ...sx,
      }}
    >
      <Box component="span" sx={{ width: 16, height: 1, background: s.accent, opacity: 0.6 }} />
      {children}
    </Typography>
  );
};

/* ── Display headline (hero / final CTA) ──────────────────────────────────── */
export const Display: React.FC<{ children: React.ReactNode; component?: React.ElementType; sx?: object; testId?: string }> = ({
  children,
  component = "h1",
  sx,
  testId,
}) => {
  const s = useConsole();
  return (
    <Typography
      component={component}
      data-testid={testId}
      sx={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 500,
        fontSize: "clamp(36px, 5vw, 58px)",
        lineHeight: 1.05,
        letterSpacing: "-0.025em",
        color: s.ink,
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
};

/* ── Section wrapper: left-aligned, hairline-separated, airy ──────────────── */
export const Section: React.FC<
  React.PropsWithChildren<{ id?: string; testId?: string; alt?: boolean; divider?: boolean; sx?: object }>
> = ({ id, testId, alt, divider = true, children, sx }) => {
  const s = useConsole();
  return (
    <Box
      component="section"
      id={id}
      data-testid={testId}
      sx={{
        background: alt ? s.surface : s.canvas,
        borderTop: divider ? `1px solid ${s.line}` : "none",
        scrollMarginTop: "80px",
        py: { xs: 7, md: 11 },
        ...sx,
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 3, md: 6 } }}>{children}</Box>
    </Box>
  );
};

/* ── Section head: eyebrow → h2 (Manrope) → lead; left-aligned by default ─── */
export const SectionHead: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  lead?: string;
  maxWidth?: number;
  testId?: string;
  sx?: object;
}> = ({ eyebrow, title, lead, maxWidth = 680, testId, sx }) => {
  const s = useConsole();
  return (
    <Box data-testid={testId} sx={{ maxWidth, mb: { xs: 4, md: 6 }, ...sx }}>
      {eyebrow ? <Eyebrow sx={{ mb: 2 }}>{eyebrow}</Eyebrow> : null}
      <Typography
        component="h2"
        sx={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 500,
          fontSize: { xs: 26, md: 34 },
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: s.ink,
        }}
      >
        {title}
      </Typography>
      {lead ? (
        <Typography
          sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 15.5, md: 16.5 }, lineHeight: 1.6, mt: 2 }}
        >
          {lead}
        </Typography>
      ) : null}
    </Box>
  );
};

/* ── Buttons: flat, 10px radius, functional motion on specific props ──────── */
const btnBase = {
  textTransform: "none" as const,
  fontFamily: FONT_BODY,
  fontWeight: 600,
  letterSpacing: 0,
  lineHeight: 1.4,
  borderRadius: "10px",
  boxShadow: "none",
  px: 2.75,
  py: 1.25,
  fontSize: 15,
  minWidth: 0,
};

export const PrimaryBtn: React.FC<ButtonProps & { component?: React.ElementType }> = ({ sx, ...rest }) => (
  <Button
    disableElevation
    {...rest}
    sx={{
      ...btnBase,
      color: ON_GOLD,
      background: GOLD,
      transition: "background-color 160ms ease, transform 160ms ease",
      "& .MuiButton-endIcon": { transition: "transform 200ms cubic-bezier(0.2,0.8,0.2,1)" },
      "&:hover": { background: GOLD_HOVER, color: ON_GOLD, boxShadow: "none" },
      "&:hover .MuiButton-endIcon": { transform: "translateX(3px)" },
      "&:active": { transform: "scale(0.99)" },
      "@media (prefers-reduced-motion: reduce)": { "&:hover .MuiButton-endIcon": { transform: "none" } },
      ...sx,
    }}
  />
);

export const SecondaryBtn: React.FC<ButtonProps & { component?: React.ElementType }> = ({ sx, ...rest }) => {
  const s = useConsole();
  return (
    <Button
      disableElevation
      {...rest}
      sx={{
        ...btnBase,
        color: s.ink,
        background: "transparent",
        border: `1px solid ${s.lineStrong}`,
        transition: "border-color 160ms ease, background-color 160ms ease",
        "&:hover": { background: s.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderColor: s.ink3 },
        ...sx,
      }}
    />
  );
};

/* ── Quiet "label →" link (accent, arrow nudges on hover) ─────────────────── */
export const ArrowLink: React.FC<{ href: string; children: React.ReactNode; testId?: string; sx?: object }> = ({
  href,
  children,
  testId,
  sx,
}) => {
  const s = useConsole();
  return (
    <Box
      component="a"
      href={href}
      data-testid={testId}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        fontFamily: FONT_BODY,
        fontSize: 14.5,
        fontWeight: 600,
        color: s.accent,
        textDecoration: "none",
        whiteSpace: "nowrap",
        "& .arr": { transition: "transform 200ms cubic-bezier(0.2,0.8,0.2,1)" },
        "&:hover .arr": { transform: "translateX(3px)" },
        "@media (prefers-reduced-motion: reduce)": { "& .arr": { transition: "none" } },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

/* ── Hairline card recipe — flat surface, hairline border, calm hover ─────── */
export const cardSx = (s: ConsoleTokens, opts?: { hover?: boolean }) => ({
  background: s.surface,
  border: `1px solid ${s.line}`,
  borderRadius: "14px",
  ...(opts?.hover === false
    ? {}
    : {
        transition: "border-color 200ms ease, background-color 200ms ease",
        "&:hover": { borderColor: s.lineStrong },
      }),
});

export const goStart = (router: { push: (p: string) => unknown }, ref: string): void => {
  const tk = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  void router.push(tk ? "/dashboard" : `/auth/register?ref=${ref}`);
};
