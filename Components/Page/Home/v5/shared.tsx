import React from "react";
import { Box, Button, ButtonProps, Typography } from "@mui/material";
import { FONT_BODY, useAurora, type AuroraTokens } from "../v3/theme.v3";
import { Eyebrow, HeadlineL } from "../v3/styled.v3";
import { BTN_RADIUS, CARD_RADIUS, ON_YELLOW, YELLOW, YELLOW_HOVER, YELLOW_PRESSED } from "@/constants/publicTheme";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** One section grammar for the whole landing: eyebrow → h2 → one body line. Cascades in on scroll. */
export const SectionHead: React.FC<{ eyebrow?: string; headline: React.ReactNode; body?: string; center?: boolean; maxWidth?: number; testId?: string }> = ({
  eyebrow,
  headline,
  body,
  center = false,
  maxWidth = 680,
  testId,
}) => {
  const s = useAurora();
  return (
    <Stagger step={0.09} data-testid={testId} sx={{ maxWidth, mb: { xs: 5, md: 7 }, mx: center ? "auto" : 0, textAlign: center ? "center" : "left" }}>
      {eyebrow ? <StaggerItem i={0} y={12}><Eyebrow component="p" sx={{ mb: 2 }}>{eyebrow}</Eyebrow></StaggerItem> : null}
      <StaggerItem i={1} y={16}><HeadlineL component="h2" sx={{ color: s.ink }}>{headline}</HeadlineL></StaggerItem>
      {body ? (
        <StaggerItem i={2} y={14}>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16, md: 17.5 }, lineHeight: 1.55, mt: 2.5 }}>{body}</Typography>
        </StaggerItem>
      ) : null}
    </Stagger>
  );
};

/* Bybit button grammar: 8px radius, 11×24 padding, semibold 16, flat (no glow). */
const base = { borderRadius: `${BTN_RADIUS}px`, textTransform: "none", fontFamily: FONT_BODY, fontWeight: 600, letterSpacing: 0, lineHeight: 1.5, boxShadow: "none" } as const;
const iconNudge = {
  "& .MuiButton-endIcon": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" },
  "&:hover .MuiButton-endIcon": { transform: "translateX(3px)" },
  "@media (prefers-reduced-motion: reduce)": { "& .MuiButton-endIcon": { transition: "none" }, "&:hover .MuiButton-endIcon": { transform: "none" } },
} as const;

export const PrimaryBtn: React.FC<ButtonProps & { small?: boolean }> = ({ small, sx, ...rest }) => (
  <Button
    {...rest}
    sx={{
      ...base,
      ...iconNudge,
      px: small ? 2.25 : 3,
      py: small ? 1 : 1.375,
      fontSize: small ? 14.5 : 16,
      color: ON_YELLOW,
      background: YELLOW,
      transition: "background-color 160ms ease, transform 160ms ease",
      "&:hover": { background: YELLOW_HOVER, color: ON_YELLOW, boxShadow: "none" },
      "&:active": { background: YELLOW_PRESSED, transform: "scale(0.99)" },
      ...sx,
    }}
  />
);

export const SecondaryBtn: React.FC<ButtonProps & { small?: boolean; onDark?: boolean }> = ({ small, onDark, sx, ...rest }) => {
  const s = useAurora();
  const dark = onDark || s.dark;
  return (
    <Button
      {...rest}
      sx={{
        ...base,
        fontWeight: 600,
        px: small ? 2.25 : 3,
        py: small ? 1 : 1.375,
        fontSize: small ? 14.5 : 16,
        color: dark ? "#FFFFFF" : s.ink,
        border: `1px solid ${dark ? "#404347" : s.lineStrong}`,
        background: "transparent",
        transition: "border-color 160ms ease, color 160ms ease, background-color 160ms ease",
        "&:hover": { background: dark ? "rgba(255,255,255,0.06)" : "rgba(18,18,20,0.04)", borderColor: dark ? "#595D61" : s.ink3 },
        ...sx,
      }}
    />
  );
};

/** Section wrapper — consistent vertical rhythm + max width. */
export const Section: React.FC<React.PropsWithChildren<{ id?: string; alt?: boolean; testId?: string; narrow?: boolean; sx?: object }>> = ({ id, alt, testId, narrow, children, sx }) => {
  const s = useAurora();
  return (
    <Box component="section" id={id} data-testid={testId} sx={{ background: alt ? s.bgAlt : s.bg, py: { xs: 9, md: 13 }, scrollMarginTop: "88px", ...sx }}>
      <Box sx={{ maxWidth: narrow ? 1080 : 1280, mx: "auto", px: { xs: 3, md: 5 } }}>{children}</Box>
    </Box>
  );
};

/** One card recipe for every public page: 16px radius, card surface + hairline, quiet lift on hover. */
export const cardSx = (s: AuroraTokens, opts?: { hover?: boolean; radius?: number }) => ({
  background: s.surface,
  border: `1px solid ${s.line}`,
  borderRadius: `${opts?.radius ?? CARD_RADIUS}px`,
  ...(opts?.hover === false
    ? {}
    : {
        transition: "border-color 200ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)",
        "&:hover": { borderColor: s.lineStrong, transform: "translateY(-2px)" },
        "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
      }),
});

export const goStart = (router: { push: (p: string) => unknown }, ref: string) => {
  const tk = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  router.push(tk ? "/dashboard" : `/auth/register?ref=${ref}`);
};
