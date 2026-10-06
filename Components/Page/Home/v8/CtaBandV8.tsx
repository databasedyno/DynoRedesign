import React, { memo } from "react";
import { useRouter } from "next/router";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, GradientText, GRID_BG, PANEL, PANEL_GLOW, PrimaryBtn, Reveal, goStart } from "./kit";

/* ============================================================================
 * CtaBandV8 — reusable closing conversion band (near-black, gold glow + grid).
 * Inner marketing pages drop this in with their own copy; the primary action
 * routes into the existing Start-free flow via goStart() unless a href is given.
 * ========================================================================== */

interface Props {
  badge?: string;
  title: React.ReactNode;
  highlight?: string;
  body?: React.ReactNode;
  primaryLabel?: string;
  primaryRef?: string;
  /** Explicit primary destination (e.g. attributed signup URL) instead of goStart(). */
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  trust?: string[];
  testId?: string;
}

const CtaBandV8: React.FC<Props> = ({
  badge,
  title,
  highlight,
  body,
  primaryLabel = "Start free",
  primaryRef = "cta",
  primaryHref,
  secondaryLabel,
  secondaryHref,
  trust = [],
  testId = "cta-band",
}) => {
  const router = useRouter();
  return (
    <Box component="section" data-testid={testId} sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 9, md: 14 } }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, pointerEvents: "none" }} />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRID_BG,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(70% 70% at 50% 50%, #000, transparent 72%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 50% 50%, #000, transparent 72%)",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
      <Reveal sx={{ position: "relative", zIndex: 1, maxWidth: 820, mx: "auto", px: { xs: 3, md: 6 }, textAlign: "center" }}>
        {badge ? (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 1.5, py: 0.6, mb: 3.5, borderRadius: "999px", border: `1px solid ${PANEL.lineStrong}`, background: PANEL.surface }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.green }} />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.04em", color: PANEL.ink2 }}>{badge}</Typography>
          </Box>
        ) : null}
        <Typography component="h2" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 32, md: 54 }, lineHeight: 1.05, letterSpacing: "-0.03em", color: PANEL.ink }}>
          {title}
          {highlight ? (
            <>
              {" "}
              <GradientText>{highlight}</GradientText>
            </>
          ) : null}
        </Typography>
        {body ? (
          <Typography sx={{ fontFamily: FONT_BODY, color: PANEL.ink2, fontSize: { xs: 16, md: 18.5 }, lineHeight: 1.6, mt: 3, maxWidth: 560, mx: "auto" }}>
            {body}
          </Typography>
        ) : null}
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5, mt: 5 }}>
          <PrimaryBtn data-testid={`${testId}-primary`} {...(primaryHref ? { href: primaryHref } : { onClick: () => goStart(router, primaryRef) })} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3.5, py: 1.6, fontSize: 16.5 }}>
            {primaryLabel}
          </PrimaryBtn>
          {secondaryLabel && secondaryHref ? (
            <Box
              component="a"
              href={secondaryHref}
              data-testid={`${testId}-secondary`}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 3.5,
                py: 1.6,
                borderRadius: "10px",
                border: `1px solid ${PANEL.lineStrong}`,
                color: PANEL.ink,
                textDecoration: "none",
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 16.5,
                transition: "background-color 160ms ease, border-color 160ms ease",
                "&:hover": { background: "rgba(255,255,255,0.05)", borderColor: PANEL.ink3 },
              }}
            >
              {secondaryLabel}
            </Box>
          ) : null}
        </Box>
        {trust.length ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: { xs: 2, md: 3 }, mt: 4 }}>
            {trust.map((x) => (
              <Box key={x} sx={{ display: "inline-flex", alignItems: "center", gap: 0.7 }}>
                <Icon icon="mdi:check-circle" width={15} height={15} color={PANEL.gold} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: PANEL.ink2 }}>{x}</Typography>
              </Box>
            ))}
          </Box>
        ) : null}
      </Reveal>
    </Box>
  );
};

export default memo(CtaBandV8);
