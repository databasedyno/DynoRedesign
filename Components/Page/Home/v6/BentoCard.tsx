import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "../v3/theme.v3";

interface Props {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  /** Grid span on desktop (12-col). */
  span?: number;
  testId?: string;
  children?: React.ReactNode;
}

/** Stripe-style bento product card: copy on top, a real UI vignette below, whole card is the link. */
export const BentoCard: React.FC<Props> = ({ eyebrow, title, body, cta, href, span = 6, testId, children }) => {
  const s = useAurora();
  const accent = s.dark ? "#2BD4C4" : BRAND_ACCENT;
  return (
    <Box
      component="a"
      href={href}
      className="bento"
      data-testid={testId}
      sx={{
        gridColumn: { xs: "1 / -1", md: `span ${span}` },
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        borderRadius: "24px",
        background: s.surface,
        border: `1px solid ${s.line}`,
        p: { xs: 2.5, md: 3.25 },
        transition: "transform 320ms cubic-bezier(.16,1,.3,1), border-color 240ms ease, box-shadow 320ms ease",
        "&:hover": { transform: "translateY(-4px)", borderColor: `${BRAND_ACCENT}55`, boxShadow: s.dark ? "0 40px 80px -48px rgba(0,0,0,0.9)" : "0 40px 80px -48px rgba(30,27,75,0.35)" },
        "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 },
      }}
    >
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: accent, mb: 1.5 }}>{eyebrow}</Typography>
      <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 22, md: 26 }, letterSpacing: "-0.025em", lineHeight: 1.1, color: s.ink, mb: 1 }}>{title}</Typography>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.55, color: s.ink2, maxWidth: 520, mb: 3 }}>{body}</Typography>
      <Box sx={{ mt: "auto" }}>{children}</Box>
      <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: accent, "& svg": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" }, ".bento:hover & svg": { transform: "translate(2px,-2px)" } }}>
        {cta} <ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />
      </Typography>
    </Box>
  );
};

export default memo(BentoCard);
