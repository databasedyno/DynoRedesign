import React from "react";
import { Box, Button, ButtonProps, Typography } from "@mui/material";
import { FONT_BODY, useAurora, type AuroraTokens } from "../v3/theme.v3";
import { Eyebrow, HeadlineL } from "../v3/styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** One section grammar for the whole landing: eyebrow → h2 → one body line, left-aligned. Cascades in on scroll. */
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

const pill = { borderRadius: "999px", textTransform: "none", fontFamily: FONT_BODY, fontWeight: 600, letterSpacing: 0 } as const;
// Arrow nudges right on hover (Hostinger CTA micro-interaction).
const iconNudge = {
  "& .MuiButton-endIcon": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" },
  "&:hover .MuiButton-endIcon": { transform: "translateX(3px)" },
  "@media (prefers-reduced-motion: reduce)": { "& .MuiButton-endIcon": { transition: "none" }, "&:hover .MuiButton-endIcon": { transform: "none" } },
} as const;

export const PrimaryBtn: React.FC<ButtonProps & { small?: boolean }> = ({ small, sx, ...rest }) => (
  <Button
    {...rest}
    sx={{
      ...pill,
      ...iconNudge,
      px: small ? 2.5 : 3.5,
      py: small ? 1.1 : 1.5,
      fontSize: small ? 14.5 : 16,
      color: "#fff",
      background: BRAND_ACCENT,
      boxShadow: "0 12px 30px -12px rgba(79,70,229,0.6)",
      transition: "background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
      "&:hover": { background: "#4338CA", transform: "translateY(-1px)", boxShadow: "0 16px 34px -12px rgba(79,70,229,0.7)" },
      "&:active": { transform: "translateY(0) scale(0.99)" },
      ...sx,
    }}
  />
);

export const SecondaryBtn: React.FC<ButtonProps & { small?: boolean; onDark?: boolean }> = ({ small, onDark, sx, ...rest }) => {
  const s = useAurora();
  return (
    <Button
      {...rest}
      sx={{
        ...pill,
        fontWeight: 500,
        px: small ? 2.25 : 3,
        py: small ? 1.05 : 1.45,
        fontSize: small ? 14.5 : 15.5,
        color: onDark ? "#F5F5F5" : s.ink,
        border: `1px solid ${onDark ? "rgba(255,255,255,0.28)" : s.lineStrong}`,
        background: "transparent",
        transition: "border-color 180ms ease, color 180ms ease, background-color 180ms ease",
        "&:hover": onDark
          ? { background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.5)" }
          : { borderColor: BRAND_ACCENT, color: s.dark ? "#A5B4FC" : BRAND_ACCENT, background: "transparent" },
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

/** One card recipe for every public page: 18px radius, surface + hairline, lifts on hover. */
export const cardSx = (s: AuroraTokens, opts?: { hover?: boolean; radius?: number }) => ({
  background: s.surface,
  border: `1px solid ${s.line}`,
  borderRadius: `${opts?.radius ?? 18}px`,
  ...(opts?.hover === false
    ? {}
    : {
        transition: "border-color 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms ease",
        "&:hover": { borderColor: `${BRAND_ACCENT}55`, transform: "translateY(-3px)", boxShadow: `0 24px 48px -32px ${BRAND_ACCENT}66` },
        "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
      }),
});

export const goStart = (router: { push: (p: string) => unknown }, ref: string) => {
  const tk = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  router.push(tk ? "/dashboard" : `/auth/register?ref=${ref}`);
};
